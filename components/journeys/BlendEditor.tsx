'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PainPoint {
  index: number
  title: string
  description: string
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

interface StageSummary {
  stage_number: number
  stage_name: string
  summary: string
}

interface CopilotResult {
  draft: string
  confidence: number
  sources: string[]
  assumptions: string[]
  open_questions: string[]
  verification_checks: string[]
}

type Mode = 'per_pain_point' | 'blended'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface BlendEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 800

const UPSTREAM_STEP_IDS = ['4', '5', '6', '7', '8', '10', '11', '12', '13', '15', '16', '17', '18']

const STEP_LABELS: Record<string, string> = {
  '5': 'Cause',
  '6': 'Effect',
  '7': 'Impact',
  '8': 'Solution',
  '10': 'Market Trigger',
  '11': 'CVP',
  '12': 'Proof Points',
  '13': 'Critical Success Formula',
  '15': 'Key Selling Point',
  '16': 'Offer Alignment',
  '17': 'Competitive Landscape',
  '18': 'Competitive Advantage',
  '19': 'Customer Success Story',
  '20': 'Customer Evidence',
  '22': 'Strategic Positioning',
  '23': 'Value Narrative',
  '24': 'Differentiation',
  '25': 'Competitive Opportunity',
  '26': 'Unique Mechanism',
}

const REFERENCE_STEP_IDS = ['5', '6', '8', '11', '15']

// ── Helpers ───────────────────────────────────────────────────────────────────

function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again. If it persists, check status.anthropic.com"
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return 'The request took too long to complete. Try again.'
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

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

function buildIcpBlock(icps: IcpRecord[]): string {
  if (icps.length === 0) return 'No ICPs defined yet.'
  return icps.map(icp => {
    const lines: string[] = [`Segment: ${icp.segment_name}`, `Buyer Type: ${icp.buyer_type}`]
    if (icp.job_titles.length > 0) lines.push(`Job Titles: ${icp.job_titles.join(', ')}`)
    if (icp.primary_challenges.length > 0) lines.push(`Primary Challenges: ${icp.primary_challenges.join(', ')}`)
    if (icp.the_big_win) lines.push(`The Big Win: ${icp.the_big_win}`)
    if (icp.buying_urgency_trigger) lines.push(`Buying Urgency Trigger: ${icp.buying_urgency_trigger}`)
    if (icp.common_objections.length > 0) {
      lines.push(`Common Objections: ${icp.common_objections.map(o => `${o.objection} → ${o.overcomes}`).join('; ')}`)
    }
    return lines.join('\n')
  }).join('\n\n')
}

function buildOfferBlock(offers: OfferRecord[]): string {
  if (offers.length === 0) return 'No offers defined yet.'
  return offers.map(offer => {
    const lines: string[] = [`Offer: ${offer.offer_name}`]
    if (offer.key_outcome) lines.push(`Key Outcome: ${offer.key_outcome}`)
    if (offer.primary_differentiator) lines.push(`Primary Differentiator: ${offer.primary_differentiator}`)
    return lines.join('\n')
  }).join('\n\n')
}

// ── Sub-components ────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  margin: '0 0 6px',
  display: 'block',
}

const CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  padding: '16px',
}

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function BlendEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
}: BlendEditorProps) {
  const [loading, setLoading] = useState(true)
  const [painPoints, setPainPoints] = useState<PainPoint[]>([])
  const [activeCount, setActiveCount] = useState(0)
  const [upstreamData, setUpstreamData] = useState<Record<string, Record<number, string>>>({})
  const [icpRecords, setIcpRecords] = useState<IcpRecord[]>([])
  const [offerRecords, setOfferRecords] = useState<OfferRecord[]>([])
  const [dcpSummaries, setDcpSummaries] = useState<StageSummary[]>([])

  const [mode, setMode] = useState<Mode>('per_pain_point')
  const [perPPContent, setPerPPContent] = useState<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' })
  const [blendedContent, setBlendedContent] = useState('')
  const [activeTab, setActiveTab] = useState(1)

  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>({ 1: true })

  const [copilotLoading, setCopilotLoading] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [copilotOutput, setCopilotOutput] = useState<CopilotResult | null>(null)
  const [copilotError, setCopilotError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const modeRef = useRef<Mode>('per_pain_point')
  const perPPRef = useRef<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' })
  const blendedRef = useRef('')

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const upstreamQueries = UPSTREAM_STEP_IDS.map(sid =>
          supabase
            .from('step_output')
            .select('content')
            .eq('workspace_id', workspaceId)
            .eq('step_id', sid)
            .order('version', { ascending: false })
            .limit(1),
        )

        // Both Promise.all calls are created before any await, so all queries run in parallel
        const fixedPromise = Promise.all([
          supabase
            .from('step_output')
            .select('id, content, version')
            .eq('workspace_id', workspaceId)
            .eq('step_id', stepId)
            .order('version', { ascending: false })
            .limit(1),
          supabase
            .from('icp_definition')
            .select('segment_name, buyer_type, job_titles, primary_challenges, the_big_win, buying_urgency_trigger, common_objections')
            .eq('org_id', workspaceId)
            .order('segment_index'),
          supabase
            .from('offer_definition')
            .select('offer_name, key_outcome, primary_differentiator')
            .eq('org_id', workspaceId),
          supabase
            .from('dcp_analysis')
            .select('stage_summaries')
            .eq('org_id', workspaceId)
            .maybeSingle(),
        ] as const)
        const upstreamPromise = Promise.all(upstreamQueries)

        const [[currentResult, icpResult, offerResult, dcpResult], upstreamResults] =
          await Promise.all([fixedPromise, upstreamPromise])

        // Parse upstream data
        const newUpstream: Record<string, Record<number, string>> = {}
        upstreamResults.forEach((result, i) => {
          const sid = UPSTREAM_STEP_IDS[i]
          if (!sid) return
          newUpstream[sid] = {}
          if (!result.data || result.data.length === 0) return
          const row = result.data[0] as Record<string, unknown>
          const c = row['content'] as Record<string, unknown> | null
          if (!c) return

          if (sid === '4') {
            const pts = c['pain_points']
            if (Array.isArray(pts)) {
              const parsed: PainPoint[] = (pts as Array<Record<string, unknown>>).map(pp => ({
                index: Number(pp['index'] ?? 0),
                title: String(pp['title'] ?? ''),
                description: String(pp['description'] ?? ''),
              }))
              setPainPoints(parsed)
              setActiveCount(Math.max(1, Math.min(4, Number(c['active_count'] ?? parsed.length))))
              parsed.forEach(pp => { newUpstream[sid][pp.index] = pp.description })
            }
          } else {
            const bpp = c['by_pain_point']
            if (Array.isArray(bpp)) {
              for (const entry of bpp as Array<Record<string, unknown>>) {
                const idx = Number(entry['index'])
                if (idx >= 1 && idx <= 4) newUpstream[sid][idx] = String(entry['content'] ?? '')
              }
            } else if (typeof c['text'] === 'string' && c['text']) {
              for (let idx = 1; idx <= 4; idx++) newUpstream[sid][idx] = String(c['text'])
            }
          }
        })
        setUpstreamData(newUpstream)

        // Parse current step output
        if (currentResult.data && currentResult.data.length > 0) {
          const row = currentResult.data[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          if (c) {
            if (c['mode'] === 'blended' || c['mode'] === 'per_pain_point') {
              const m = c['mode'] as Mode
              setMode(m)
              modeRef.current = m
            }
            if (typeof c['blended'] === 'string') {
              setBlendedContent(c['blended'])
              blendedRef.current = c['blended']
            }
            const ppp = c['per_pain_point']
            if (Array.isArray(ppp)) {
              const map: Record<number, string> = { 1: '', 2: '', 3: '', 4: '' }
              for (const entry of ppp as Array<Record<string, unknown>>) {
                const idx = Number(entry['index'])
                if (idx >= 1 && idx <= 4) map[idx] = String(entry['content'] ?? '')
              }
              setPerPPContent(map)
              perPPRef.current = map
            }
          }
        }

        // Parse ICP
        if (icpResult.data) {
          setIcpRecords((icpResult.data as Array<Record<string, unknown>>).map(parseIcpRow))
        }

        // Parse offers
        if (offerResult.data) {
          setOfferRecords((offerResult.data as Array<Record<string, unknown>>).map(parseOfferRow))
        }

        // Parse DCP summaries
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
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [workspaceId, stepId])

  // ── Save ──────────────────────────────────────────────────────────────────

  const persist = useCallback(async (
    m: Mode,
    ppp: Record<number, string>,
    bld: string,
  ) => {
    setSaveState('saving')
    try {
      const contentPayload = {
        mode: m,
        per_pain_point: [1, 2, 3, 4].map(i => ({ index: i, content: ppp[i] ?? '' })),
        blended: bld,
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

  // Re-assigned every render so debounced callback always closes over latest state
  saveRef.current = () => persist(modeRef.current, perPPRef.current, blendedRef.current)

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_MS)
  }

  function handleModeChange(m: Mode) {
    setMode(m)
    modeRef.current = m
    setCopilotOutput(null)
    setCopilotError(null)
    setStreamBuffer('')
    scheduleSave()
  }

  function handlePerPPChange(idx: number, value: string) {
    setPerPPContent(prev => {
      const next = { ...prev, [idx]: value }
      perPPRef.current = next
      return next
    })
    scheduleSave()
  }

  function handleBlendedChange(value: string) {
    setBlendedContent(value)
    blendedRef.current = value
    scheduleSave()
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void saveRef.current()
  }

  function handleTabChange(idx: number) {
    setActiveTab(idx)
    setCopilotOutput(null)
    setCopilotError(null)
    setStreamBuffer('')
  }

  // ── Copilot ───────────────────────────────────────────────────────────────

  async function runCopilot() {
    if (copilotLoading) return
    setCopilotLoading(true)
    setCopilotOutput(null)
    setCopilotError(null)
    setStreamBuffer('')

    const dcpBlock = dcpSummaries.length > 0
      ? dcpSummaries.map(s => `Stage ${s.stage_number} — ${s.stage_name}:\n${s.summary}`).join('\n\n')
      : 'No DCP buyer research available.'

    const icpBlock = buildIcpBlock(icpRecords)
    const offerBlock = buildOfferBlock(offerRecords)

    let extraContext: string
    let currentContent: string
    let stepDescription: string

    const activePainPoints = painPoints.filter(pp => pp.index <= activeCount)

    if (mode === 'per_pain_point') {
      const pp = painPoints.find(p => p.index === activeTab)
      const upstreamLines: string[] = []
      UPSTREAM_STEP_IDS.filter(sid => sid !== '4').forEach(sid => {
        const val = upstreamData[sid]?.[activeTab]
        if (val?.trim()) upstreamLines.push(`${STEP_LABELS[sid] ?? `Step ${sid}`}:\n${val}`)
      })

      extraContext = [
        `STRATEGIC MESSAGE TYPE: ${stepTitle}`,
        '',
        `PAIN POINT ${activeTab}: ${pp?.title?.trim() ?? `Pain Point ${activeTab}`}`,
        pp?.description?.trim() || 'Not yet defined.',
        '',
        'UPSTREAM CONTEXT FOR THIS PAIN POINT:',
        upstreamLines.length > 0 ? upstreamLines.join('\n\n') : 'No upstream content available yet.',
        '',
        'TARGET MARKET ICPs:',
        icpBlock,
        '',
        'OFFERS:',
        offerBlock,
        '',
        'DCP STAGE SUMMARIES:',
        dcpBlock,
      ].join('\n')

      currentContent = perPPRef.current[activeTab] ?? ''
      stepDescription = `Generate a strategic message for Pain Point ${activeTab}: "${pp?.title?.trim() ?? `Pain Point ${activeTab}`}"`
    } else {
      const ppLines: string[] = []
      for (const pp of activePainPoints) {
        const upstreamLines: string[] = []
        UPSTREAM_STEP_IDS.filter(sid => sid !== '4').forEach(sid => {
          const val = upstreamData[sid]?.[pp.index]
          if (val?.trim()) upstreamLines.push(`  ${STEP_LABELS[sid] ?? `Step ${sid}`}: ${val}`)
        })
        ppLines.push(
          `Pain Point ${pp.index}: ${pp.title?.trim() || `Pain Point ${pp.index}`}\n${pp.description?.trim() || 'Not defined.'}`,
        )
        if (upstreamLines.length > 0) ppLines.push(upstreamLines.join('\n'))
      }

      extraContext = [
        `STRATEGIC MESSAGE TYPE: ${stepTitle}`,
        '',
        'ALL ACTIVE PAIN POINTS WITH UPSTREAM CONTEXT:',
        ppLines.join('\n\n'),
        '',
        'TARGET MARKET ICPs:',
        icpBlock,
        '',
        'OFFERS:',
        offerBlock,
        '',
        'DCP STAGE SUMMARIES:',
        dcpBlock,
      ].join('\n')

      currentContent = blendedRef.current
      stepDescription = 'Generate a blended strategic message that weaves all active pain points together into a unified narrative.'
    }

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          workspaceId,
          stepTitle,
          stepDescription,
          currentContent,
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
        accumulated += decoder.decode(value, { stream: true })
        setStreamBuffer(accumulated)
      }

      if (accumulated.includes('__STREAM_ERROR__')) {
        const match = accumulated.match(/__STREAM_ERROR__:(\w+)/)
        setCopilotError(copilotErrorMessage(match ? match[1] : 0))
        return
      }

      try {
        const parsed = JSON.parse(accumulated) as CopilotResult
        setCopilotOutput(parsed)
      } catch {
        setCopilotOutput({
          draft: accumulated,
          confidence: 0,
          sources: [],
          assumptions: [],
          open_questions: [],
          verification_checks: [],
        })
      }
      setStreamBuffer('')
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      setCopilotError(
        msg.includes('timeout') || msg.includes('aborted')
          ? 'The request took too long to complete. Try again.'
          : copilotErrorMessage(0),
      )
    } finally {
      setCopilotLoading(false)
    }
  }

  function applyDraft() {
    if (!copilotOutput) return
    if (mode === 'per_pain_point') {
      handlePerPPChange(activeTab, copilotOutput.draft)
    } else {
      handleBlendedChange(copilotOutput.draft)
    }
    setCopilotOutput(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  const activePainPoints = painPoints.filter(pp => pp.index <= activeCount)
  const activePP = painPoints.find(p => p.index === activeTab)
  const copilotButtonLabel = mode === 'per_pain_point'
    ? `Draft for ${activePP?.title?.trim() || `Pain Point ${activeTab}`}`
    : 'Generate Blended Message'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>

      {/* ── LEFT: Pain Point Reference ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={LABEL_STYLE}>Pain Point Reference</span>

        {activePainPoints.length === 0 ? (
          <div style={{
            padding: '14px 16px', backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D', borderRadius: '10px',
            display: 'flex', gap: '10px', alignItems: 'flex-start',
          }}>
            <AlertTriangle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '13px', color: '#92400E', margin: 0 }}>
              Complete Step 4 to define your pain points.
            </p>
          </div>
        ) : activePainPoints.map(pp => {
          const isOpen = openAccordions[pp.index] ?? false
          const hasContent = pp.description?.trim() ||
            REFERENCE_STEP_IDS.some(sid => upstreamData[sid]?.[pp.index]?.trim())
          return (
            <div key={pp.index} style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setOpenAccordions(prev => ({ ...prev, [pp.index]: !prev[pp.index] }))}
                style={{
                  width: '100%', minHeight: '44px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0D0D0D' }}>
                  {pp.title?.trim() || `Pain Point ${pp.index}`}
                </span>
                {isOpen
                  ? <ChevronUp size={15} style={{ color: '#6B7280', flexShrink: 0 }} />
                  : <ChevronDown size={15} style={{ color: '#6B7280', flexShrink: 0 }} />
                }
              </button>

              {isOpen && (
                <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pp.description?.trim() && (
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>Description</p>
                      <p style={{ fontSize: '12px', color: '#0D0D0D', lineHeight: '1.6', margin: 0 }}>{pp.description}</p>
                    </div>
                  )}
                  {REFERENCE_STEP_IDS.map(sid => {
                    const val = upstreamData[sid]?.[pp.index]
                    if (!val?.trim()) return null
                    return (
                      <div key={sid}>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>
                          {STEP_LABELS[sid]}
                        </p>
                        <p style={{ fontSize: '12px', color: '#0D0D0D', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{val}</p>
                      </div>
                    )
                  })}
                  {!hasContent && (
                    <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>No upstream content yet.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── RIGHT: Strategic Message ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Mode toggle + save indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{
            display: 'flex', backgroundColor: '#F3F4F6',
            borderRadius: '8px', padding: '3px', gap: '2px',
          }}>
            {(['per_pain_point', 'blended'] as const).map(m => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                style={{
                  padding: '6px 16px', minHeight: '36px',
                  backgroundColor: mode === m ? '#FFFFFF' : 'transparent',
                  color: mode === m ? '#0D0D0D' : '#6B7280',
                  border: 'none', borderRadius: '6px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'per_pain_point' ? 'Per Pain Point' : 'Blended'}
              </button>
            ))}
          </div>
          <SaveIndicator state={saveState} />
        </div>

        {mode === 'per_pain_point' ? (
          <>
            {activePainPoints.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {activePainPoints.map(pp => (
                  <button
                    key={pp.index}
                    onClick={() => handleTabChange(pp.index)}
                    style={{
                      padding: '6px 14px', minHeight: '36px',
                      maxWidth: '200px', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      backgroundColor: activeTab === pp.index ? '#E8520A' : '#FFFFFF',
                      color: activeTab === pp.index ? '#FFFFFF' : '#0D0D0D',
                      border: `1px solid ${activeTab === pp.index ? '#E8520A' : '#E5E7EB'}`,
                      borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', transition: 'background-color 0.15s, color 0.15s',
                    }}
                  >
                    {pp.title?.trim() || `Pain Point ${pp.index}`}
                  </button>
                ))}
              </div>
            )}

            <div style={CARD}>
              <span style={LABEL_STYLE}>
                Strategic Message — {activePP?.title?.trim() || `Pain Point ${activeTab}`}
              </span>
              <textarea
                value={perPPContent[activeTab] ?? ''}
                onChange={e => handlePerPPChange(activeTab, e.target.value)}
                onBlur={handleBlur}
                placeholder="Write the strategic message for this pain point, or use Copilot to generate a draft…"
                rows={10}
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid #9CA3AF', borderRadius: '8px',
                  fontSize: '14px', lineHeight: '1.65',
                  color: '#0D0D0D', backgroundColor: '#FFFFFF',
                  resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
          </>
        ) : (
          <>
            {activePainPoints.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Blending:</span>
                {activePainPoints.map(pp => (
                  <span key={pp.index} style={{
                    fontSize: '11px', fontWeight: 600,
                    padding: '3px 10px', borderRadius: '999px',
                    backgroundColor: '#F3F4F6', color: '#0D0D0D',
                  }}>
                    {pp.title?.trim() || `Pain Point ${pp.index}`}
                  </span>
                ))}
              </div>
            )}

            <div style={CARD}>
              <span style={LABEL_STYLE}>Blended Strategic Message</span>
              <textarea
                value={blendedContent}
                onChange={e => handleBlendedChange(e.target.value)}
                onBlur={handleBlur}
                placeholder="Write a unified strategic message weaving all pain points together, or use Copilot to generate a blended draft…"
                rows={10}
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid #9CA3AF', borderRadius: '8px',
                  fontSize: '14px', lineHeight: '1.65',
                  color: '#0D0D0D', backgroundColor: '#FFFFFF',
                  resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
          </>
        )}

        {/* Copilot button */}
        <div style={CARD}>
          <button
            onClick={() => void runCopilot()}
            disabled={copilotLoading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', minHeight: '44px',
              backgroundColor: copilotLoading ? '#F3F4F6' : '#E8520A',
              color: copilotLoading ? '#9CA3AF' : '#FFFFFF',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600,
              cursor: copilotLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {copilotLoading
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><Wand2 size={15} /> {copilotButtonLabel}</>
            }
          </button>
          <p style={{ fontSize: '11px', color: '#6B7280', margin: '8px 0 0', lineHeight: '1.5' }}>
            {mode === 'per_pain_point'
              ? 'Uses all upstream content for this pain point plus ICP, offer, and buyer intelligence.'
              : 'Blends all active pain points into a unified message using ICP, offer, and buyer intelligence.'
            }
          </p>
        </div>

        {/* Streaming buffer */}
        {copilotLoading && streamBuffer && (
          <div style={{ ...CARD, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
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
          <div style={{ ...CARD, border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2' }}>
            <p style={{ fontSize: '13px', color: '#991B1B', margin: '0 0 6px' }}>{copilotError}</p>
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
        {copilotOutput && !copilotLoading && (
          <div style={CARD}>
            {copilotOutput.confidence > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '3px 10px', borderRadius: '999px',
                  backgroundColor: copilotOutput.confidence >= 71 ? '#DCFCE7' : copilotOutput.confidence >= 41 ? '#FEF3C7' : '#FEE2E2',
                  color: copilotOutput.confidence >= 71 ? '#16A34A' : copilotOutput.confidence >= 41 ? '#D97706' : '#DC2626',
                  fontSize: '12px', fontWeight: 700,
                }}>
                  {copilotOutput.confidence >= 71 ? 'High' : copilotOutput.confidence >= 41 ? 'Medium' : 'Low'} confidence — {copilotOutput.confidence}/100
                </span>
              </div>
            )}

            <span style={LABEL_STYLE}>Proposed draft</span>
            <div style={{
              fontSize: '13px', color: '#0D0D0D', lineHeight: '1.6',
              backgroundColor: '#F8F6F1', borderRadius: '8px', padding: '12px',
              marginBottom: '12px', whiteSpace: 'pre-wrap',
              maxHeight: '260px', overflowY: 'auto',
            }}>
              {copilotOutput.draft}
            </div>

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

            {copilotOutput.assumptions.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <span style={{ ...LABEL_STYLE, marginBottom: '4px' }}>Assumptions</span>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  {copilotOutput.assumptions.map((a, i) => (
                    <li key={i} style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {copilotOutput.open_questions.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <span style={{ ...LABEL_STYLE, marginBottom: '4px' }}>Open Questions</span>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  {copilotOutput.open_questions.map((q, i) => (
                    <li key={i} style={{ fontSize: '12px', color: '#0D0D0D', marginBottom: '2px' }}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
