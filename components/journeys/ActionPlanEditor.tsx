'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import TipsPanel, { type Tip } from '@/components/ui/TipsPanel'

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
}

interface OfferRecord {
  offer_name: string
  key_outcome: string | null
  primary_differentiator: string | null
}

interface BlendEntry {
  index: number
  content: string
}

interface BlendStepOutput {
  mode: 'per_pain_point' | 'blended'
  per_pain_point: BlendEntry[]
  blended: string
}

interface CopilotResult {
  draft: string
  confidence: number
  sources: string[]
  assumptions: string[]
  open_questions: string[]
  verification_checks: string[]
}

type ActiveTab = number | 'summary'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface ActionPlanEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
  tips?: Tip[]
  tabLabel?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 800

const BLEND_STEP_IDS = ['27', '28', '29', '30']

const BLEND_STEP_TITLES: Record<string, string> = {
  '27': 'The Set-Up',
  '28': 'The Jab',
  '29': 'Knock-Out',
  '30': 'Clean-Up',
}

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

function safeTitle(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s || s === 'undefined' || s === 'null') return ''
  // Guard: if the title is a JSON blob, it was stored wrong — discard it
  if (s.startsWith('{') || s.startsWith('[')) return ''
  return s
}

function parseBlendOutput(c: Record<string, unknown> | null): BlendStepOutput | null {
  if (!c) return null
  const mode: BlendStepOutput['mode'] = c['mode'] === 'blended' ? 'blended' : 'per_pain_point'
  const ppp = c['per_pain_point']
  return {
    mode,
    per_pain_point: Array.isArray(ppp)
      ? (ppp as Array<Record<string, unknown>>).map(e => ({
          index: Number(e['index'] ?? 0),
          content: String(e['content'] ?? ''),
        }))
      : [],
    blended: typeof c['blended'] === 'string' ? c['blended'] : '',
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  display: 'block',
  margin: 0,
}

const CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  padding: '20px',
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActionPlanEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
  tips,
  tabLabel = 'Action',
}: ActionPlanEditorProps) {
  const [loading, setLoading] = useState(true)
  const [step4Found, setStep4Found] = useState(false)
  const [painPoints, setPainPoints] = useState<PainPoint[]>([])
  const [activeCount, setActiveCount] = useState(0)
  const [blendData, setBlendData] = useState<Record<string, BlendStepOutput | null>>({})
  const [icpRecords, setIcpRecords] = useState<IcpRecord[]>([])
  const [offerRecords, setOfferRecords] = useState<OfferRecord[]>([])

  const [activeTab, setActiveTab] = useState<ActiveTab>(1)
  const [perPPContent, setPerPPContent] = useState<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' })
  const [summaryContent, setSummaryContent] = useState('')

  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [copilotLoading, setCopilotLoading] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [copilotError, setCopilotError] = useState<string | null>(null)
  const [showAppliedFlash, setShowAppliedFlash] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const perPPRef = useRef<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' })
  const summaryRef = useRef('')

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const blendQueries = BLEND_STEP_IDS.map(sid =>
          supabase
            .from('step_output')
            .select('content')
            .eq('workspace_id', workspaceId)
            .eq('step_id', sid)
            .order('version', { ascending: false })
            .limit(1),
        )

        const fixedPromise = Promise.all([
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
            .from('icp_definition')
            .select('segment_name, buyer_type, job_titles, primary_challenges, the_big_win')
            .eq('org_id', workspaceId)
            .order('segment_index'),
          supabase
            .from('offer_definition')
            .select('offer_name, key_outcome, primary_differentiator')
            .eq('org_id', workspaceId),
        ] as const)
        const blendPromise = Promise.all(blendQueries)

        const [[step4Result, currentResult, icpResult, offerResult], blendResults] =
          await Promise.all([fixedPromise, blendPromise])

        // Step 4
        if (step4Result.data && step4Result.data.length > 0) {
          const c = (step4Result.data[0] as Record<string, unknown>)['content'] as Record<string, unknown> | null
          const pts = c?.['pain_points']
          if (Array.isArray(pts)) {
            const parsed: PainPoint[] = (pts as Array<Record<string, unknown>>).map(pp => ({
              index: Number(pp['index'] ?? 0),
              title: safeTitle(pp['title']),
              description: String(pp['description'] ?? ''),
            }))
            setPainPoints(parsed)
            setActiveCount(Math.max(1, Math.min(4, Number(c?.['active_count'] ?? parsed.length))))
            setStep4Found(true)
          }
        }

        // Current step output
        if (currentResult.data && currentResult.data.length > 0) {
          const row = currentResult.data[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          if (c) {
            const bpp = c['by_pain_point']
            if (Array.isArray(bpp)) {
              const map: Record<number, string> = { 1: '', 2: '', 3: '', 4: '' }
              for (const entry of bpp as Array<Record<string, unknown>>) {
                const idx = Number(entry['index'])
                if (idx >= 1 && idx <= 4) map[idx] = String(entry['content'] ?? '')
              }
              setPerPPContent(map)
              perPPRef.current = map
            }
            if (typeof c['summary'] === 'string') {
              setSummaryContent(c['summary'])
              summaryRef.current = c['summary']
            }
          }
        }

        // ICP
        if (icpResult.data) {
          setIcpRecords((icpResult.data as Array<Record<string, unknown>>).map(row => ({
            segment_name: String(row['segment_name'] ?? ''),
            buyer_type: String(row['buyer_type'] ?? ''),
            job_titles: Array.isArray(row['job_titles']) ? (row['job_titles'] as unknown[]).map(x => String(x)) : [],
            primary_challenges: Array.isArray(row['primary_challenges']) ? (row['primary_challenges'] as unknown[]).map(x => String(x)) : [],
            the_big_win: row['the_big_win'] != null ? String(row['the_big_win']) : null,
          })))
        }

        // Offers
        if (offerResult.data) {
          setOfferRecords((offerResult.data as Array<Record<string, unknown>>).map(row => ({
            offer_name: String(row['offer_name'] ?? ''),
            key_outcome: row['key_outcome'] != null ? String(row['key_outcome']) : null,
            primary_differentiator: row['primary_differentiator'] != null ? String(row['primary_differentiator']) : null,
          })))
        }

        // Blend steps
        const newBlendData: Record<string, BlendStepOutput | null> = {}
        blendResults.forEach((result, i) => {
          const sid = BLEND_STEP_IDS[i]
          if (!sid) return
          if (!result.data || result.data.length === 0) { newBlendData[sid] = null; return }
          const row = result.data[0] as Record<string, unknown>
          newBlendData[sid] = parseBlendOutput(row['content'] as Record<string, unknown> | null)
        })
        setBlendData(newBlendData)
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [workspaceId, stepId])

  // ── Save ──────────────────────────────────────────────────────────────────

  const persist = useCallback(async (ppp: Record<number, string>, summary: string) => {
    setSaveState('saving')
    try {
      const contentPayload = {
        by_pain_point: [1, 2, 3, 4].map(i => ({ index: i, content: ppp[i] ?? '' })),
        summary,
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

  saveRef.current = () => persist(perPPRef.current, summaryRef.current)

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_MS)
  }

  function handlePerPPChange(idx: number, value: string) {
    setPerPPContent(prev => {
      const next = { ...prev, [idx]: value }
      perPPRef.current = next
      return next
    })
    scheduleSave()
  }

  function handleSummaryChange(value: string) {
    setSummaryContent(value)
    summaryRef.current = value
    scheduleSave()
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void saveRef.current()
  }

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab)
    setCopilotError(null)
    setStreamBuffer('')
  }

  // ── Copilot ───────────────────────────────────────────────────────────────

  function getBlendMessageForIndex(idx: number): string {
    const lines: string[] = []
    BLEND_STEP_IDS.forEach(sid => {
      const bd = blendData[sid]
      if (!bd) return
      const title = BLEND_STEP_TITLES[sid] ?? `Step ${sid}`
      const content = bd.mode === 'blended'
        ? bd.blended
        : (bd.per_pain_point.find(e => e.index === idx)?.content ?? '')
      if (content.trim()) lines.push(`${title}:\n${content}`)
    })
    return lines.length > 0 ? lines.join('\n\n') : 'No strategic messages yet.'
  }

  async function runCopilot() {
    if (copilotLoading) return
    setCopilotLoading(true)
    setCopilotError(null)
    setStreamBuffer('')

    const icpBlock = icpRecords.length > 0
      ? icpRecords.map(icp => {
          const lines = [`Segment: ${icp.segment_name}`, `Buyer Type: ${icp.buyer_type}`]
          if (icp.job_titles.length > 0) lines.push(`Job Titles: ${icp.job_titles.join(', ')}`)
          if (icp.primary_challenges.length > 0) lines.push(`Primary Challenges: ${icp.primary_challenges.join(', ')}`)
          if (icp.the_big_win) lines.push(`The Big Win: ${icp.the_big_win}`)
          return lines.join('\n')
        }).join('\n\n')
      : 'No ICPs defined yet.'

    const offerBlock = offerRecords.length > 0
      ? offerRecords.map(o => {
          const lines = [`Offer: ${o.offer_name}`]
          if (o.key_outcome) lines.push(`Key Outcome: ${o.key_outcome}`)
          if (o.primary_differentiator) lines.push(`Primary Differentiator: ${o.primary_differentiator}`)
          return lines.join('\n')
        }).join('\n\n')
      : 'No offers defined yet.'

    let extraContext: string
    let currentContent: string
    let stepDescription: string

    if (activeTab === 'summary') {
      const ppLines: string[] = []
      for (let idx = 1; idx <= activeCount; idx++) {
        const pp = painPoints.find(p => p.index === idx)
        const msgs = getBlendMessageForIndex(idx)
        ppLines.push(`Pain Point ${idx}: ${pp?.title?.trim() || `Pain Point ${idx}`}\n${msgs}`)
      }

      extraContext = [
        `ACTION PLAN TYPE: ${stepTitle}`,
        '',
        'ALL PAIN POINTS WITH STRATEGIC MESSAGES:',
        ppLines.join('\n\n'),
        '',
        'TARGET MARKET ICPs:',
        icpBlock,
        '',
        'OFFERS:',
        offerBlock,
      ].join('\n')

      currentContent = summaryRef.current
      stepDescription = `Generate a unified summary action plan for "${stepTitle}" that integrates all active pain points.`
    } else {
      const tabIdx = activeTab as number
      const pp = painPoints.find(p => p.index === tabIdx)
      const msgs = getBlendMessageForIndex(tabIdx)

      extraContext = [
        `ACTION PLAN TYPE: ${stepTitle}`,
        '',
        `PAIN POINT ${tabIdx}: ${pp?.title?.trim() || `Pain Point ${tabIdx}`}`,
        pp?.description?.trim() || 'Not yet defined.',
        '',
        'STRATEGIC MESSAGES FOR THIS PAIN POINT:',
        msgs,
        '',
        'TARGET MARKET ICPs:',
        icpBlock,
        '',
        'OFFERS:',
        offerBlock,
      ].join('\n')

      currentContent = perPPRef.current[tabIdx] ?? ''
      stepDescription = `Generate an action plan for Pain Point ${tabIdx}: "${pp?.title?.trim() || `Pain Point ${tabIdx}`}" in the context of "${stepTitle}".`
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

      let draftText: string
      try {
        const parsed = JSON.parse(accumulated) as CopilotResult
        draftText = extractDraft(parsed.draft)
      } catch {
        draftText = extractDraft(accumulated)
      }
      if (activeTab === 'summary') handleSummaryChange(draftText)
      else handlePerPPChange(activeTab as number, draftText)
      setShowAppliedFlash(true)
      setTimeout(() => setShowAppliedFlash(false), 2000)
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

  // ── Render ────────────────────────────────────────────────────────────────

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

  const activePainPoints = painPoints.filter(pp => pp.index <= activeCount)
  const currentLabel = activeTab === 'summary'
    ? 'Summary'
    : (painPoints.find(pp => pp.index === activeTab)?.title?.trim() || `Pain Point ${activeTab}`)
  const currentValue = activeTab === 'summary' ? summaryContent : (perPPContent[activeTab as number] ?? '')
  const copilotButtonLabel = activeTab === 'summary' ? 'Generate Summary Action Plan' : `Draft Action ${activeTab}`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

      {/* ── Left: tabs + textarea ─────────────────────────────────────────── */}
      <div>
        {showAppliedFlash && (
          <div style={{
            padding: '8px 12px', backgroundColor: '#DCFCE7',
            border: '1px solid #86EFAC', borderRadius: '6px', marginBottom: '12px',
            fontSize: '13px', fontWeight: 600, color: '#16A34A',
          }}>
            Applied to editor ✓
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {activePainPoints.map(pp => {
            const fullLabel = pp.title?.trim() || `Pain Point ${pp.index}`
            const displayLabel = `${tabLabel} ${pp.index}`
            return (
              <button
                key={pp.index}
                onClick={() => handleTabChange(pp.index)}
                title={fullLabel}
                style={{
                  padding: '6px 14px', minHeight: '36px',
                  backgroundColor: activeTab === pp.index ? '#E8520A' : '#FFFFFF',
                  color: activeTab === pp.index ? '#FFFFFF' : '#0D0D0D',
                  border: `1px solid ${activeTab === pp.index ? '#E8520A' : '#E5E7EB'}`,
                  borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', transition: 'background-color 0.15s, color 0.15s',
                }}
              >
                {displayLabel}
              </button>
            )
          })}
          <button
            onClick={() => handleTabChange('summary')}
            style={{
              padding: '6px 14px', minHeight: '36px',
              backgroundColor: activeTab === 'summary' ? '#E8520A' : '#FFFFFF',
              color: activeTab === 'summary' ? '#FFFFFF' : '#0D0D0D',
              border: `1px solid ${activeTab === 'summary' ? '#E8520A' : '#E5E7EB'}`,
              borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            Summary
          </button>
        </div>

        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={LABEL_STYLE}>{currentLabel}</span>
            <SaveIndicator state={saveState} />
          </div>
          <textarea
            value={currentValue}
            onChange={e => {
              if (activeTab === 'summary') handleSummaryChange(e.target.value)
              else handlePerPPChange(activeTab as number, e.target.value)
            }}
            onBlur={handleBlur}
            placeholder={
              activeTab === 'summary'
                ? `Write a unified action plan for ${stepTitle} across all pain points, or use Copilot…`
                : `Write the action plan for "${currentLabel}" in the context of ${stepTitle}, or use Copilot…`
            }
            rows={14}
            style={{
              width: '100%', padding: '14px',
              border: '1px solid #9CA3AF', borderRadius: '8px',
              fontSize: '14px', lineHeight: '1.65',
              color: '#0D0D0D', backgroundColor: '#FFFFFF',
              resize: 'vertical', boxSizing: 'border-box',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Right: Copilot ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div style={CARD}>
          <span style={{ ...LABEL_STYLE, marginBottom: '10px' }}>Copilot</span>
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
            {activeTab === 'summary'
              ? 'Generates a rolled-up action plan using all pain points and strategic messages.'
              : 'Uses strategic messages and ICP context for this pain point.'
            }
          </p>
        </div>

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

        {copilotError && (
          <div style={{ ...CARD, border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2' }}>
            <p style={{ fontSize: '13px', color: '#991B1B', margin: '0 0 6px' }}>{copilotError}</p>
            <a href="https://status.anthropic.com" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', color: '#991B1B', textDecoration: 'underline' }}>
              Check AI Status ↗
            </a>
          </div>
        )}

        {tips && tips.length > 0 && <TipsPanel tips={tips} />}
      </div>
    </div>
  )
}
