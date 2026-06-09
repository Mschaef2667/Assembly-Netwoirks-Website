'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2, AlertTriangle, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PainPoint {
  index: number
  title: string
  description: string
}

interface ByPainPointEntry {
  index: number
  content: string
}

interface ByPainPointContent {
  by_pain_point: ByPainPointEntry[]
}

interface StageSummary {
  stage_number: number
  stage_name: string
  summary: string
}

interface IcpRecord {
  segment_name: string
  buyer_type: string
  job_titles: string[]
  primary_challenges: string[]
  the_big_win: string | null
  buying_urgency_trigger: string | null
  common_objections: Array<{ objection: string; overcomes: string }>
}

interface OfferRecord {
  offer_name: string
  key_outcome: string | null
  primary_differentiator: string | null
}

interface CopilotResult {
  draft: string
  confidence: number
  sources: string[]
  assumptions: string[]
  open_questions: string[]
  verification_checks: string[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Competitor {
  name: string
  description: string
  why_relevant: string
}

interface DiscoveryResult {
  known_validators: Competitor[]
  adjacent_competitors: Competitor[]
  emerging_threats: Competitor[]
}

export interface PainPointStepEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
  autoApply?: boolean
  autoGenerate?: boolean
  tabLabel?: string
  showUpstreamContext?: boolean
  onContentChange?: (hasNonEmptyContent: boolean) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 800

const PANEL_CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  padding: '20px',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '6px',
  display: 'block',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again. If it persists, check status.anthropic.com"
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return "The request took too long to complete. Try again or shorten your content."
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

function safeTitle(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s || s === 'undefined' || s === 'null') return ''
  if (s.startsWith('{') || s.startsWith('[')) return ''
  return s
}

function extractDraft(raw: string): string {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    const obj = JSON.parse(stripped) as Record<string, unknown>
    if (typeof obj['draft'] === 'string') return obj['draft']
  } catch { /* not JSON — use as-is */ }
  return stripped
}

// Extracts a clean plain-text title from any raw value, handling JSON blobs and markdown fences
function extractTitle(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s || s === 'undefined' || s === 'null') return ''
  const extracted = extractDraft(s)
  if (!extracted || extracted.startsWith('{') || extracted.startsWith('[') || extracted.startsWith('`')) return ''
  return extracted
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280' }}>
      <Loader2 size={12} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return <span style={{ fontSize: '12px', color: '#16A34A' }}>Saved</span>
  return <span style={{ fontSize: '12px', color: '#EF4444' }}>Save failed</span>
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 71 ? '#16A34A' : score >= 41 ? '#D97706' : '#DC2626'
  const bg = score >= 71 ? '#DCFCE7' : score >= 41 ? '#FEF3C7' : '#FEE2E2'
  const label = score >= 71 ? 'High' : score >= 41 ? 'Medium' : 'Low'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px',
      backgroundColor: bg, color, fontSize: '12px', fontWeight: 700,
    }}>
      {label} confidence — {score}/100
    </span>
  )
}

// ── ICP / Offer helpers ───────────────────────────────────────────────────────

function parseIcpRow(row: Record<string, unknown>): IcpRecord {
  const toStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).map(x => String(x)) : []
  const rawObjs = row['common_objections']
  return {
    segment_name: String(row['segment_name'] ?? ''),
    buyer_type: String(row['buyer_type'] ?? ''),
    job_titles: toStringArray(row['job_titles']),
    primary_challenges: toStringArray(row['primary_challenges']),
    the_big_win: row['the_big_win'] != null ? String(row['the_big_win']) : null,
    buying_urgency_trigger: row['buying_urgency_trigger'] != null ? String(row['buying_urgency_trigger']) : null,
    common_objections: Array.isArray(rawObjs)
      ? (rawObjs as Array<Record<string, unknown>>).map(o => ({
          objection: String(o['objection'] ?? ''),
          overcomes: String(o['overcomes'] ?? ''),
        }))
      : [],
  }
}

function parseOfferRow(row: Record<string, unknown>): OfferRecord {
  return {
    offer_name: String(row['offer_name'] ?? ''),
    key_outcome: row['key_outcome'] != null ? String(row['key_outcome']) : null,
    primary_differentiator: row['primary_differentiator'] != null ? String(row['primary_differentiator']) : null,
  }
}

function buildIcpOfferContext(icps: IcpRecord[], offers: OfferRecord[]): string {
  const parts: string[] = []

  if (icps.length === 0) {
    parts.push('TARGET MARKET ICPs:\nNo ICPs defined yet — generate them in Target Markets & Offers first')
  } else {
    const lines: string[] = ['TARGET MARKET ICPs:']
    for (const icp of icps) {
      lines.push('')
      lines.push(`Segment: ${icp.segment_name}`)
      if (icp.buyer_type) lines.push(`Buyer Type: ${icp.buyer_type}`)
      if (icp.job_titles.length > 0) lines.push(`Job Titles: ${icp.job_titles.join(', ')}`)
      if (icp.primary_challenges.length > 0) lines.push(`Primary Challenges: ${icp.primary_challenges.join(', ')}`)
      if (icp.the_big_win) lines.push(`The Big Win: ${icp.the_big_win}`)
      if (icp.buying_urgency_trigger) lines.push(`Buying Urgency Trigger: ${icp.buying_urgency_trigger}`)
      if (icp.common_objections.length > 0) {
        lines.push(`Common Objections: ${icp.common_objections.map(o => `${o.objection} → ${o.overcomes}`).join('; ')}`)
      }
    }
    parts.push(lines.join('\n'))
  }

  if (offers.length > 0) {
    const lines: string[] = ['OFFERS:']
    for (const offer of offers) {
      lines.push('')
      lines.push(`Offer: ${offer.offer_name}`)
      if (offer.key_outcome) lines.push(`Key Outcome: ${offer.key_outcome}`)
      if (offer.primary_differentiator) lines.push(`Primary Differentiator: ${offer.primary_differentiator}`)
    }
    parts.push(lines.join('\n'))
  }

  return parts.join('\n\n')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PainPointStepEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
  autoApply = false,
  autoGenerate = false,
  tabLabel,
  showUpstreamContext = false,
  onContentChange,
}: PainPointStepEditorProps) {
  const [loading, setLoading] = useState(true)
  const [step4Found, setStep4Found] = useState(false)
  const [painPoints, setPainPoints] = useState<PainPoint[]>([])
  const [activeCount, setActiveCount] = useState(0)
  const [activeTab, setActiveTab] = useState(1)
  const [contentMap, setContentMap] = useState<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' })
  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [dcpSummaries, setDcpSummaries] = useState<StageSummary[]>([])
  const [icpRecords, setIcpRecords] = useState<IcpRecord[]>([])
  const [offerRecords, setOfferRecords] = useState<OfferRecord[]>([])
  const [upstreamContextMap, setUpstreamContextMap] = useState<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' })

  const [copilotStreaming, setCopilotStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [copilotOutput, setCopilotOutput] = useState<CopilotResult | null>(null)
  const [copilotError, setCopilotError] = useState<string | null>(null)
  const [showAppliedFlash, setShowAppliedFlash] = useState(false)

  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult | null>(null)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [addedCompetitors, setAddedCompetitors] = useState<Set<string>>(new Set())
  const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null)

  const [autoGenerating, setAutoGenerating] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoGenerateStartedRef = useRef(false)

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [step4Result, outputResult, dcpResult, icpResult, offerResult] = await Promise.all([
          supabase
            .from('step_output')
            .select('content')
            .eq('workspace_id', workspaceId)
            .eq('step_id', '4')
            .order('version', { ascending: false })
            .limit(1),
          supabase
            .from('step_output')
            .select('id, content, version')
            .eq('workspace_id', workspaceId)
            .eq('step_id', stepId)
            .order('version', { ascending: false })
            .limit(1),
          supabase
            .from('dcp_analysis')
            .select('stage_summaries')
            .eq('org_id', workspaceId)
            .maybeSingle(),
          supabase
            .from('icp_definition')
            .select('segment_name, buyer_type, job_titles, primary_challenges, the_big_win, buying_urgency_trigger, common_objections')
            .eq('org_id', workspaceId)
            .order('segment_index'),
          supabase
            .from('offer_definition')
            .select('offer_name, key_outcome, primary_differentiator')
            .eq('org_id', workspaceId),
        ])

        // Step 4 pain points
        if (step4Result.data && step4Result.data.length > 0) {
          const c = (step4Result.data[0] as Record<string, unknown>)['content'] as Record<string, unknown> | null
          const pts = c?.['pain_points']
          if (Array.isArray(pts)) {
            const parsed: PainPoint[] = (pts as Array<Record<string, unknown>>).map((pp, i) => ({
              index: Number(pp['index'] ?? i + 1),
              title: extractTitle(pp['title']),
              description: String(pp['description'] ?? ''),
            }))
            setPainPoints(parsed)
            setActiveCount(Math.max(1, Math.min(4, Number(c?.['active_count'] ?? parsed.length))))
            setStep4Found(true)
          }
        }

        // Current step output
        if (outputResult.data && outputResult.data.length > 0) {
          const row = outputResult.data[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          const bpp = c?.['by_pain_point']
          if (Array.isArray(bpp)) {
            const map: Record<number, string> = { 1: '', 2: '', 3: '', 4: '' }
            for (const entry of bpp as Array<Record<string, unknown>>) {
              const idx = Number(entry['index'])
              if (idx >= 1 && idx <= 4) map[idx] = String(entry['content'] ?? '')
            }
            setContentMap(map)
          }
        }

        // DCP stage summaries
        if (dcpResult.data) {
          const summaries = (dcpResult.data as Record<string, unknown>)['stage_summaries']
          if (Array.isArray(summaries)) {
            setDcpSummaries(
              (summaries as Array<Record<string, unknown>>).map(s => ({
                stage_number: Number(s['stage_number'] ?? 0),
                stage_name: String(s['stage_name'] ?? ''),
                summary: String(s['summary'] ?? ''),
              })),
            )
          }
        }

        // ICP definitions
        if (icpResult.data) {
          setIcpRecords((icpResult.data as Array<Record<string, unknown>>).map(parseIcpRow))
        }

        // Offer definitions
        if (offerResult.data) {
          setOfferRecords((offerResult.data as Array<Record<string, unknown>>).map(parseOfferRow))
        }

        // Upstream context — for Step 12, fetch Step 11 by_pain_point content
        if (showUpstreamContext && stepId === '12') {
          const { data: s11Data } = await supabase
            .from('step_output')
            .select('content')
            .eq('workspace_id', workspaceId)
            .eq('step_id', '11')
            .order('version', { ascending: false })
            .limit(1)
          if (s11Data && s11Data.length > 0) {
            const c = (s11Data[0] as Record<string, unknown>)['content'] as Record<string, unknown> | null
            const bpp = c?.['by_pain_point']
            if (Array.isArray(bpp)) {
              const map: Record<number, string> = { 1: '', 2: '', 3: '', 4: '' }
              for (const entry of bpp as Array<Record<string, unknown>>) {
                const idx = Number(entry['index'])
                if (idx >= 1 && idx <= 4) map[idx] = String(entry['content'] ?? '')
              }
              setUpstreamContextMap(map)
            }
          }
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [workspaceId, stepId, showUpstreamContext])

  // Notify parent whenever contentMap has any non-empty value so its hasContent
  // gate can re-evaluate (needed after Copilot auto-apply, where the parent's
  // cached rawContent does not see the new draft).
  useEffect(() => {
    if (!onContentChange) return
    const hasNonEmpty = Object.values(contentMap).some(v => (v ?? '').trim().length > 0)
    onContentChange(hasNonEmpty)
  }, [contentMap, onContentChange])

  // ── Auto-generation on first load ───────────────────────────────────────────
  // Sequentially drafts content for each empty pain point tab when autoGenerate is on
  // and upstream Step 4 data exists. Guarded by a ref so it never re-fires.
  useEffect(() => {
    if (!autoGenerate) return
    if (loading) return
    if (!step4Found) return
    if (activeCount === 0) return
    if (autoGenerateStartedRef.current) return
    if (activeCount < 1) return

    const emptyTabs = [1, 2, 3, 4]
      .filter(idx => idx <= activeCount)
      .filter(idx => !(contentMap[idx] ?? '').trim())

    if (emptyTabs.length === 0) return

    autoGenerateStartedRef.current = true
    setAutoGenerating(true)

    void (async () => {
      const dcpBlock = dcpSummaries.length > 0
        ? dcpSummaries.map(s => `Stage ${s.stage_number} — ${s.stage_name}:\n${s.summary}`).join('\n\n')
        : 'No DCP buyer research data available yet.'
      const icpOfferBlock = buildIcpOfferContext(icpRecords, offerRecords)

      for (const tabIdx of emptyTabs) {
        try {
          const activePP = painPoints.find(pp => pp.index === tabIdx)
          const cvpForTab = (upstreamContextMap[tabIdx] ?? '').trim()
          const cvpLines = showUpstreamContext && stepId === '12' && cvpForTab
            ? [`CVP ${tabIdx} PROMISE (from Step 11):`, cvpForTab, '']
            : []
          const extraContext = [
            `IMPORTANT: This is Pain Point ${tabIdx} of ${activeCount}. Generate UNIQUE content specifically for this pain point number. Do NOT repeat content from other pain points. Each pain point should represent a different aspect of the endemic problem.`,
            '',
            ...cvpLines,
            'PAIN POINT CONTEXT (from Step 4 — The Problem):',
            `Title: ${activePP?.title?.trim() || `Pain Point ${tabIdx}`}`,
            `Description: ${activePP?.description?.trim() || 'Not yet defined.'}`,
            '',
            'DCP STAGE SUMMARIES (buyer journey research):',
            dcpBlock,
            '',
            icpOfferBlock,
          ].join('\n')

          const res = await fetch('/api/copilot/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stepId,
              workspaceId,
              stepTitle,
              stepDescription: `Generate content specifically for the pain point: "${activePP?.title?.trim() || `Pain Point ${tabIdx}`}"`,
              currentContent: '',
              preferredModel,
              extraContext,
            }),
          })

          if (!res.ok || !res.body) continue

          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let accumulated = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            accumulated += decoder.decode(value, { stream: true })
          }
          if (accumulated.includes('__STREAM_ERROR__')) continue

          let draftText = ''
          try {
            const stripped = accumulated
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/i, '')
              .replace(/```\s*$/i, '')
              .trim()
            const parsed = JSON.parse(stripped) as CopilotResult
            draftText = extractDraft(parsed.draft)
          } catch {
            draftText = extractDraft(accumulated)
          }
          if (!draftText.trim()) continue

          // Never overwrite existing content — only fill if still empty
          setContentMap(prev => {
            if ((prev[tabIdx] ?? '').trim()) return prev
            return { ...prev, [tabIdx]: draftText }
          })
          scheduleSave()
        } catch {
          // skip this tab on error; continue with the next
        }
        await new Promise(r => setTimeout(r, 400))
      }
      setAutoGenerating(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, loading, step4Found, activeCount])

  // ── Save ────────────────────────────────────────────────────────────────────

  const persistContent = useCallback(async (map: Record<number, string>) => {
    setSaveState('saving')
    try {
      const contentPayload: ByPainPointContent = {
        by_pain_point: [1, 2, 3, 4].map(idx => ({ index: idx, content: map[idx] ?? '' })),
      }
      const now = new Date().toISOString()

      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content: contentPayload, last_saved_at: now, last_updated_at: now })
          .eq('id', outputId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('step_output')
          .insert({
            workspace_id: workspaceId,
            step_id: stepId,
            version: outputVersion,
            status: 'draft',
            content: contentPayload,
            copilot_assisted: false,
            last_saved_at: now,
            last_updated_at: now,
          })
          .select('id')
          .single()
        if (error) throw error
        if (data) setOutputId((data as Record<string, unknown>)['id'] as string)
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }, [outputId, outputVersion, stepId, workspaceId])

  // Re-assigned every render so the debounced timeout always closes over latest state
  saveRef.current = async () => { await persistContent(contentMap) }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_MS)
  }

  function handleContentChange(index: number, value: string) {
    setContentMap(prev => ({ ...prev, [index]: value }))
    scheduleSave()
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void saveRef.current()
  }

  function handleTabChange(tab: number) {
    setActiveTab(tab)
    setCopilotOutput(null)
    setCopilotError(null)
    setStreamBuffer('')
  }

  // ── Copilot ─────────────────────────────────────────────────────────────────

  async function runCopilot() {
    if (copilotStreaming) return

    const existing = (contentMap[activeTab] ?? '').trim()
    if (existing.length > 50) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('This will replace your current content for this pain point. Continue?')
        : true
      if (!ok) return
    }

    setCopilotStreaming(true)
    setCopilotOutput(null)
    setCopilotError(null)
    setStreamBuffer('')

    const activePP = painPoints.find(pp => pp.index === activeTab)
    const dcpBlock = dcpSummaries.length > 0
      ? dcpSummaries.map(s => `Stage ${s.stage_number} — ${s.stage_name}:\n${s.summary}`).join('\n\n')
      : 'No DCP buyer research data available yet.'

    const icpOfferBlock = buildIcpOfferContext(icpRecords, offerRecords)

    const cvpForTab = (upstreamContextMap[activeTab] ?? '').trim()
    const cvpLines = showUpstreamContext && stepId === '12' && cvpForTab
      ? [`CVP ${activeTab} PROMISE (from Step 11):`, cvpForTab, '']
      : []

    const extraContext = [
      ...cvpLines,
      'PAIN POINT CONTEXT (from Step 4 — The Problem):',
      `Title: ${activePP?.title?.trim() || `Pain Point ${activeTab}`}`,
      `Description: ${activePP?.description?.trim() || 'Not yet defined.'}`,
      '',
      'DCP STAGE SUMMARIES (buyer journey research):',
      dcpBlock,
      '',
      icpOfferBlock,
    ].join('\n')

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          workspaceId,
          stepTitle,
          stepDescription: `Generate content specifically for the pain point: "${activePP?.title?.trim() || `Pain Point ${activeTab}`}"`,
          currentContent: contentMap[activeTab] ?? '',
          preferredModel,
          extraContext,
        }),
      })

      if (!res.ok || !res.body) {
        setCopilotError(copilotErrorMessage(res.status))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamBuffer(accumulated)
      }

      if (accumulated.includes('__STREAM_ERROR__')) {
        const match = accumulated.match(/__STREAM_ERROR__:(\w+)/)
        setCopilotError(copilotErrorMessage(match ? match[1] : 0))
        return
      }

      let draftText = ''
      let parsedResult: CopilotResult | null = null
      try {
        const strippedForParse = accumulated
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim()
        const parsed = JSON.parse(strippedForParse) as CopilotResult
        parsedResult = {
          ...parsed,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence ?? 0),
          draft: extractDraft(parsed.draft),
        }
        draftText = parsedResult.draft
      } catch {
        draftText = extractDraft(accumulated)
        parsedResult = {
          draft: draftText,
          confidence: 0,
          sources: [],
          assumptions: [],
          open_questions: [],
          verification_checks: [],
        }
      }

      if (autoApply) {
        setContentMap(prev => ({ ...prev, [activeTab]: draftText }))
        scheduleSave()
        setShowAppliedFlash(true)
        setTimeout(() => setShowAppliedFlash(false), 2000)
      } else {
        setCopilotOutput(parsedResult)
      }
      setStreamBuffer('')
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      setCopilotError(
        msg.includes('timeout') || msg.includes('aborted')
          ? 'The request took too long to complete. Try again or shorten your content.'
          : copilotErrorMessage(0),
      )
    } finally {
      setCopilotStreaming(false)
    }
  }

  function applyDraft() {
    if (!copilotOutput) return
    setContentMap(prev => ({ ...prev, [activeTab]: copilotOutput!.draft }))
    scheduleSave()
    setCopilotOutput(null)
  }

  // ── Competitive Discovery (Step 17 only) ─────────────────────────────────────

  function showAddedMessage(ppTitle: string) {
    setAddSuccessMsg(`Added to ${ppTitle} ✓`)
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    // Fade message only — card stays open
    dismissTimer.current = setTimeout(() => {
      setAddSuccessMsg(null)
      dismissTimer.current = null
    }, 1500)
  }

  function dismissCard() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    setDiscoveryResults(null)
    setAddedCompetitors(new Set())
    setAddSuccessMsg(null)
  }

  function addCompetitorToTab(comp: Competitor) {
    const tabKey = activeTab
    console.log('Adding competitor to tab:', tabKey, comp.name)
    const line = `• ${comp.name} — ${comp.description}`
    const current = contentMap[tabKey] ?? ''
    const updated = current ? `${current}\n${line}` : line
    const newMap: Record<number, string> = { ...contentMap, [tabKey]: updated }
    setContentMap(newMap)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void persistContent(newMap) }, AUTOSAVE_MS)

    setAddedCompetitors(prev => new Set(prev).add(comp.name))
    const ppTitle = painPoints.find(pp => pp.index === tabKey)?.title || `Pain Point ${tabKey}`
    // Show success message but keep card open so user can add more
    showAddedMessage(ppTitle)
  }

  function addAllToTab(competitors: Competitor[]) {
    const tabKey = activeTab
    const lines = competitors.map(c => `• ${c.name} — ${c.description}`).join('\n')
    const current = contentMap[tabKey] ?? ''
    const updated = current ? `${current}\n${lines}` : lines
    const newMap: Record<number, string> = { ...contentMap, [tabKey]: updated }
    setContentMap(newMap)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void persistContent(newMap) }, AUTOSAVE_MS)

    setAddedCompetitors(prev => {
      const s = new Set(prev)
      competitors.forEach(c => s.add(c.name))
      return s
    })
    const ppTitle = painPoints.find(pp => pp.index === tabKey)?.title || `Pain Point ${tabKey}`
    setAddSuccessMsg(`Added to ${ppTitle} ✓`)
    // Auto-dismiss after Add All — all competitors in section added at once
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => { dismissCard() }, 2000)
  }

  async function runDiscovery() {
    if (discoveryLoading) return
    setDiscoveryLoading(true)
    setDiscoveryResults(null)
    setDiscoveryError(null)

    try {
      const [s1, s2, s3, s11, icpFirm] = await Promise.all([
        supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '1').order('version', { ascending: false }).limit(1),
        supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '2').order('version', { ascending: false }).limit(1),
        supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '3').order('version', { ascending: false }).limit(1),
        supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '11').order('version', { ascending: false }).limit(1),
        supabase.from('icp_definition').select('segment_name, industry_verticals, company_size_range, job_titles').eq('org_id', workspaceId),
      ] as const)

      function getStepText(data: Array<Record<string, unknown>> | null): string {
        if (!data || data.length === 0) return 'Not provided.'
        const c = data[0]['content']
        return c ? JSON.stringify(c, null, 2) : 'Not provided.'
      }

      const companyContext = [
        'STEP 1 - PRODUCT/SERVICE PROFILE:\n' + getStepText(s1.data as Array<Record<string, unknown>> | null),
        'STEP 2 - TARGET SEGMENTS:\n' + getStepText(s2.data as Array<Record<string, unknown>> | null),
        'STEP 3 - DECISION MAKERS:\n' + getStepText(s3.data as Array<Record<string, unknown>> | null),
      ].join('\n\n')

      const cvpContext = 'STEP 11 - CUSTOMER VALUE PROPOSITIONS:\n' + getStepText(s11.data as Array<Record<string, unknown>> | null)

      const icpLines: string[] = []
      if (icpFirm.data) {
        for (const rawRow of icpFirm.data) {
          const row = rawRow as Record<string, unknown>
          const verticals = Array.isArray(row['industry_verticals'])
            ? (row['industry_verticals'] as unknown[]).map(String).join(', ')
            : ''
          const size = row['company_size_range'] != null ? String(row['company_size_range']) : ''
          const titles = Array.isArray(row['job_titles'])
            ? (row['job_titles'] as unknown[]).map(String).join(', ')
            : ''
          icpLines.push(`Segment: ${String(row['segment_name'] ?? '')} | Industries: ${verticals} | Size: ${size} | Titles: ${titles}`)
        }
      }
      const icpContext = icpLines.length > 0 ? icpLines.join('\n') : 'Not provided.'

      const activePP = painPoints.find(pp => pp.index === activeTab)
      const painPointContext = [
        `Pain Point: ${activePP?.title ?? ''}`,
        `Description: ${activePP?.description ?? ''}`,
        `Step 17 Content: ${contentMap[activeTab] ?? ''}`,
      ].join('\n')

      const res = await fetch('/api/copilot/competitive-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          companyContext,
          icpContext,
          painPointContext,
          cvpContext,
          preferredModel,
        }),
      })

      if (!res.ok) {
        let errMsg = `Error ${res.status}`
        try {
          const errBody = (await res.json()) as Record<string, unknown>
          errMsg = String(errBody['error'] ?? errMsg)
        } catch { /* ignore */ }
        setDiscoveryError(res.status === 422 ? 'Could not parse competitor data. Please try again.' : errMsg)
        return
      }

      const data = (await res.json()) as DiscoveryResult
      setDiscoveryResults(data)
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'An error occurred during discovery.')
    } finally {
      setDiscoveryLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  if (!step4Found) {
    return (
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#FEF3C7',
        border: '1px solid #FCD34D',
        borderRadius: '10px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}>
        <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400E', margin: '0 0 2px' }}>
            Complete Step 4 first to define your pain points
          </p>
          <p style={{ fontSize: '12px', color: '#78350F', margin: 0 }}>
            This step organises content by pain point. Go to Step 4 — The Problem to define them first.
          </p>
        </div>
      </div>
    )
  }

  const activePainPoint = painPoints.find(pp => pp.index === activeTab)
  const activeTabLabel = activePainPoint?.title?.trim() || `${tabLabel ?? 'Pain Point'} ${activeTab}`

  const DISCOVERY_SECTIONS: Array<{ key: keyof DiscoveryResult; label: string }> = [
    { key: 'known_validators', label: 'Known Players' },
    { key: 'adjacent_competitors', label: 'Adjacent Competitors' },
    { key: 'emerging_threats', label: 'Emerging Threats' },
  ]

  return (
    <>
    {/* ── Auto-generation indicator ──────────────────────────────────────── */}
    {autoGenerating && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 14px', marginBottom: '16px',
        backgroundColor: '#FEF3C7', border: '1px solid #FCD34D',
        borderRadius: '8px',
        fontSize: '13px', fontWeight: 600, color: '#92400E',
      }}>
        <Loader2 size={14} className="animate-spin" />
        Copilot is generating content for your pain points…
      </div>
    )}

    {/* ── Step 17: Competitive Discovery ─────────────────────────────────── */}
    {stepId === '17' && (
      <div id="step-competitive" style={{ marginBottom: '24px' }}>
        <button
          onClick={() => void runDiscovery()}
          disabled={discoveryLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', minHeight: '44px',
            backgroundColor: discoveryLoading ? '#F3F4F6' : '#0A1628',
            color: discoveryLoading ? '#9CA3AF' : '#FFFFFF',
            border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600, cursor: discoveryLoading ? 'not-allowed' : 'pointer',
            marginBottom: discoveryError || discoveryResults ? '16px' : '0',
          }}
        >
          {discoveryLoading
            ? <><Loader2 size={15} className="animate-spin" /> Searching for competitors…</>
            : <><Search size={15} /> Discover Competitors</>
          }
        </button>

        {discoveryError && !discoveryLoading && (
          <div style={{
            padding: '12px 16px', backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5', borderRadius: '8px', marginBottom: '16px',
          }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#991B1B' }}>{discoveryError}</p>
          </div>
        )}

        {discoveryResults && !discoveryLoading && (
          <div style={{ backgroundColor: '#0A1628', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
                Competitive Landscape
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => dismissCard()}
                  style={{
                    background: 'none', border: '1px solid #374151', borderRadius: '6px',
                    color: '#9CA3AF', fontSize: '12px', padding: '4px 10px',
                    cursor: 'pointer', minHeight: '28px',
                  }}
                >
                  Dismiss
                </button>
                <button
                  onClick={() => dismissCard()}
                  style={{
                    backgroundColor: '#E8520A', border: 'none', borderRadius: '6px',
                    color: '#FFFFFF', fontSize: '12px', fontWeight: 600,
                    padding: '4px 12px', cursor: 'pointer', minHeight: '28px',
                  }}
                >
                  Done
                </button>
              </div>
            </div>

            {DISCOVERY_SECTIONS.map(section => {
              const items = discoveryResults[section.key]
              if (!items || items.length === 0) return null
              const allAdded = items.every(c => addedCompetitors.has(c.name))
              return (
                <div key={section.key} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h4 style={{
                      margin: 0, fontSize: '11px', fontWeight: 700, color: '#E8520A',
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                    }}>
                      {section.label}
                    </h4>
                    <button
                      onClick={() => { if (!allAdded) addAllToTab(items) }}
                      disabled={allAdded}
                      style={{
                        background: 'none', border: '1px solid #374151', borderRadius: '6px',
                        color: allAdded ? '#4B5563' : '#9CA3AF', fontSize: '11px', padding: '3px 8px',
                        cursor: allAdded ? 'default' : 'pointer', minHeight: '28px',
                      }}
                    >
                      {allAdded ? 'All Added ✓' : 'Add All'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map((comp, i) => {
                      const isAdded = addedCompetitors.has(comp.name)
                      return (
                        <div key={i} style={{
                          backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px',
                          padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                              {comp.name}
                            </p>
                            <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#D1D5DB', lineHeight: '1.45' }}>
                              {comp.description}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' }}>
                              {comp.why_relevant}
                            </p>
                          </div>
                          <button
                            onClick={() => { if (!isAdded) addCompetitorToTab(comp) }}
                            disabled={isAdded}
                            style={{
                              flexShrink: 0, minHeight: '32px', padding: '0 12px',
                              backgroundColor: isAdded ? '#6B7280' : '#E8520A', color: '#FFFFFF',
                              border: 'none', borderRadius: '6px',
                              fontSize: '12px', fontWeight: 600,
                              cursor: isAdded ? 'default' : 'pointer',
                            }}
                          >
                            {isAdded ? 'Added ✓' : 'Add'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )}

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

      {/* ── Left: tabs + textarea ─────────────────────────────────────────── */}
      <div>
        {/* Success message after adding from discovery */}
        {addSuccessMsg && (
          <div style={{
            padding: '8px 12px', backgroundColor: '#DCFCE7',
            border: '1px solid #86EFAC', borderRadius: '6px', marginBottom: '12px',
            fontSize: '13px', fontWeight: 600, color: '#16A34A',
          }}>
            {addSuccessMsg}
          </div>
        )}
        {/* Auto-apply flash */}
        {showAppliedFlash && (
          <div style={{
            padding: '8px 12px', backgroundColor: '#DCFCE7',
            border: '1px solid #86EFAC', borderRadius: '6px', marginBottom: '12px',
            fontSize: '13px', fontWeight: 600, color: '#16A34A',
          }}>
            Applied to editor ✓
          </div>
        )}
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map(idx => {
            const pp = painPoints.find(p => p.index === idx)
            const baseLabel = tabLabel ?? 'Pain Point'
            const fullLabel = pp?.title?.trim() || `${baseLabel} ${idx}`
            const label = `${baseLabel} ${idx}`
            const isActive = idx === activeTab
            const isEnabled = idx <= activeCount
            return (
              <button
                key={idx}
                onClick={() => { if (isEnabled) handleTabChange(idx) }}
                disabled={!isEnabled}
                title={!isEnabled ? 'This pain point is not active in Step 4' : fullLabel}
                style={{
                  padding: '6px 14px',
                  minHeight: '36px',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  backgroundColor: isActive ? '#E8520A' : isEnabled ? '#FFFFFF' : '#F3F4F6',
                  color: isActive ? '#FFFFFF' : isEnabled ? '#0D0D0D' : '#9CA3AF',
                  border: `1px solid ${isActive ? '#E8520A' : '#E5E7EB'}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isEnabled ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Content card */}
        <div style={PANEL_CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <label style={LABEL_STYLE}>{activeTabLabel}</label>
            <SaveIndicator state={saveState} />
          </div>
          {showUpstreamContext && stepId === '12' && (upstreamContextMap[activeTab] ?? '').trim() && (
            <div style={{
              padding: '12px 14px',
              marginBottom: '12px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
            }}>
              <p style={{
                fontSize: '11px', fontWeight: 700, color: '#1E40AF',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                margin: '0 0 6px',
              }}>
                CVP Promise
              </p>
              <p style={{
                fontSize: '13px', color: '#1E3A8A', lineHeight: '1.55',
                margin: 0, whiteSpace: 'pre-wrap',
              }}>
                {upstreamContextMap[activeTab]}
              </p>
            </div>
          )}
          <textarea
            value={contentMap[activeTab] ?? ''}
            onChange={e => handleContentChange(activeTab, e.target.value)}
            onBlur={handleBlur}
            placeholder={`Write your response for "${activeTabLabel}" in the context of ${stepTitle}…`}
            rows={12}
            style={{
              width: '100%',
              padding: '14px',
              border: '1px solid #9CA3AF',
              borderRadius: '8px',
              fontSize: '14px',
              lineHeight: '1.65',
              color: '#0D0D0D',
              backgroundColor: '#FFFFFF',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Right: Copilot ────────────────────────────────────────────────── */}
      <div id="step-cvp-copilot-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Draft button */}
        <div style={PANEL_CARD}>
          <p style={LABEL_STYLE}>Copilot</p>
          <button
            onClick={() => void runCopilot()}
            disabled={copilotStreaming}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              minHeight: '44px',
              backgroundColor: copilotStreaming ? '#F3F4F6' : '#E8520A',
              color: copilotStreaming ? '#9CA3AF' : '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: copilotStreaming ? 'not-allowed' : 'pointer',
            }}
          >
            {copilotStreaming
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><Wand2 size={15} /> Draft</>
            }
          </button>
          <p style={{ fontSize: '11px', color: '#6B7280', margin: '8px 0 0', lineHeight: '1.5' }}>
            Uses the pain point description and DCP buyer research to draft a tailored response.
          </p>
        </div>

        {/* Streaming buffer */}
        {copilotStreaming && streamBuffer && (
          <div style={{ ...PANEL_CARD, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: '#E8520A', flexShrink: 0, marginTop: '2px' }} />
            <p style={{
              fontSize: '12px', color: '#0D0D0D', fontFamily: 'monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              maxHeight: '120px', overflowY: 'auto', margin: 0,
            }}>
              {streamBuffer.slice(-300)}
            </p>
          </div>
        )}

        {/* Error */}
        {copilotError && (
          <div style={{ ...PANEL_CARD, border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2' }}>
            <p style={{ fontSize: '13px', color: '#991B1B', margin: '0 0 8px' }}>{copilotError}</p>
            <a
              href="https://status.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: '#991B1B', textDecoration: 'underline' }}
            >
              Check AI Status ↗
            </a>
          </div>
        )}

        {/* Output */}
        {copilotOutput && !copilotStreaming && (
          <>
            <div style={PANEL_CARD}>
              <div style={{ marginBottom: '10px' }}>
                <ConfidenceBadge score={copilotOutput.confidence} />
              </div>
              <p style={{ ...LABEL_STYLE, marginBottom: '6px' }}>Proposed draft</p>
              <div style={{
                fontSize: '13px', color: '#0D0D0D', lineHeight: '1.6',
                backgroundColor: '#F8F6F1', borderRadius: '8px', padding: '12px',
                marginBottom: '12px', whiteSpace: 'pre-wrap',
                maxHeight: '260px', overflowY: 'auto',
              }}>
                {copilotOutput.draft}
              </div>
              {!autoApply && (
                <button
                  onClick={applyDraft}
                  style={{
                    width: '100%', minHeight: '44px',
                    backgroundColor: '#E8520A', color: '#FFFFFF',
                    border: 'none', borderRadius: '8px',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Apply to editor
                </button>
              )}
            </div>

          </>
        )}
      </div>
    </div>
    </>
  )
}
