'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2, AlertTriangle } from 'lucide-react'
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

interface CopilotResult {
  draft: string
  confidence: number
  sources: string[]
  assumptions: string[]
  open_questions: string[]
  verification_checks: string[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface PainPointStepEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function PainPointStepEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
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

  const [copilotStreaming, setCopilotStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [copilotOutput, setCopilotOutput] = useState<CopilotResult | null>(null)
  const [copilotError, setCopilotError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        // Step 4 pain points
        const { data: step4Rows } = await supabase
          .from('step_output')
          .select('content')
          .eq('workspace_id', workspaceId)
          .eq('step_id', '4')
          .order('version', { ascending: false })
          .limit(1)

        if (step4Rows && step4Rows.length > 0) {
          const c = (step4Rows[0] as Record<string, unknown>)['content'] as Record<string, unknown> | null
          const pts = c?.['pain_points']
          if (Array.isArray(pts)) {
            const parsed: PainPoint[] = (pts as Array<Record<string, unknown>>).map(pp => ({
              index: Number(pp['index'] ?? 0),
              title: String(pp['title'] ?? ''),
              description: String(pp['description'] ?? ''),
            }))
            setPainPoints(parsed)
            setActiveCount(Math.max(1, Math.min(4, Number(c?.['active_count'] ?? parsed.length))))
            setStep4Found(true)
          }
        }

        // Current step output
        const { data: outputRows } = await supabase
          .from('step_output')
          .select('id, content, version')
          .eq('workspace_id', workspaceId)
          .eq('step_id', stepId)
          .order('version', { ascending: false })
          .limit(1)

        if (outputRows && outputRows.length > 0) {
          const row = outputRows[0] as Record<string, unknown>
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
        const { data: dcpRow } = await supabase
          .from('dcp_analysis')
          .select('stage_summaries')
          .eq('org_id', workspaceId)
          .maybeSingle()

        if (dcpRow) {
          const summaries = (dcpRow as Record<string, unknown>)['stage_summaries']
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
    setCopilotStreaming(true)
    setCopilotOutput(null)
    setCopilotError(null)
    setStreamBuffer('')

    const activePP = painPoints.find(pp => pp.index === activeTab)
    const dcpBlock = dcpSummaries.length > 0
      ? dcpSummaries.map(s => `Stage ${s.stage_number} — ${s.stage_name}:\n${s.summary}`).join('\n\n')
      : 'No DCP buyer research data available yet.'

    const extraContext = [
      'PAIN POINT CONTEXT (from Step 4 — The Problem):',
      `Title: ${activePP?.title?.trim() || `Pain Point ${activeTab}`}`,
      `Description: ${activePP?.description?.trim() || 'Not yet defined.'}`,
      '',
      'DCP STAGE SUMMARIES (buyer journey research):',
      dcpBlock,
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

      try {
        const parsed = JSON.parse(accumulated) as CopilotResult
        setCopilotOutput(parsed)
        setStreamBuffer('')
      } catch {
        setCopilotOutput({
          draft: accumulated,
          confidence: 0,
          sources: [],
          assumptions: [],
          open_questions: [],
          verification_checks: [],
        })
        setStreamBuffer('')
      }
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
  const tabLabel = activePainPoint?.title?.trim() || `Pain Point ${activeTab}`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

      {/* ── Left: tabs + textarea ─────────────────────────────────────────── */}
      <div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map(idx => {
            const pp = painPoints.find(p => p.index === idx)
            const label = pp?.title?.trim() || `Pain Point ${idx}`
            const isActive = idx === activeTab
            const isEnabled = idx <= activeCount
            return (
              <button
                key={idx}
                onClick={() => { if (isEnabled) handleTabChange(idx) }}
                disabled={!isEnabled}
                title={!isEnabled ? 'This pain point is not active in Step 4' : undefined}
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
            <label style={LABEL_STYLE}>{tabLabel}</label>
            <SaveIndicator state={saveState} />
          </div>
          <textarea
            value={contentMap[activeTab] ?? ''}
            onChange={e => handleContentChange(activeTab, e.target.value)}
            onBlur={handleBlur}
            placeholder={`Write your response for "${tabLabel}" in the context of ${stepTitle}…`}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

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
              : <><Wand2 size={15} /> Draft for {tabLabel}</>
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
            </div>

            {copilotOutput.assumptions.length > 0 && (
              <div style={PANEL_CARD}>
                <p style={LABEL_STYLE}>Assumptions</p>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  {copilotOutput.assumptions.map((a, i) => (
                    <li key={i} style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {copilotOutput.open_questions.length > 0 && (
              <div style={PANEL_CARD}>
                <p style={LABEL_STYLE}>Open questions</p>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  {copilotOutput.open_questions.map((q, i) => (
                    <li key={i} style={{ fontSize: '12px', color: '#0D0D0D', marginBottom: '2px' }}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
