'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type DimensionKey = 'opportunity' | 'resources' | 'compete' | 'win' | 'worth_it'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type ScoreMap = Record<DimensionKey, number>
type NotesMap = Record<DimensionKey, string>

interface PainPoint {
  index: number
  title: string
  description: string
}

interface CopilotResult {
  draft: string
  confidence: number
  sources: string[]
  assumptions: string[]
  open_questions: string[]
  verification_checks: string[]
}

export interface DealScorecardProps {
  workspaceId: string
  preferredModel?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 800

const DIMENSIONS: { key: DimensionKey; label: string; question: string }[] = [
  {
    key: 'opportunity',
    label: 'Opportunity',
    question: 'How well does this deal align with our ICP, and how real is the pain point we solve?',
  },
  {
    key: 'resources',
    label: 'Resources',
    question: 'Do we have the team, capacity, and skills to win and deliver this deal?',
  },
  {
    key: 'compete',
    label: 'Compete',
    question: 'How differentiated is our solution relative to the alternatives they are considering?',
  },
  {
    key: 'win',
    label: 'Win',
    question: 'Do we have the relationships, access, and buying process understanding needed to win?',
  },
  {
    key: 'worth_it',
    label: 'Worth It',
    question: 'Is the revenue, strategic value, and margin of this deal worth our time and investment?',
  },
]

const DEFAULT_SCORES: ScoreMap = { opportunity: 0, resources: 0, compete: 0, win: 0, worth_it: 0 }
const DEFAULT_NOTES: NotesMap = { opportunity: '', resources: '', compete: '', win: '', worth_it: '' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function getScoreBand(total: number): { label: string; color: string; bg: string; barColor: string } {
  if (total >= 20) return { label: 'Strong Go', color: '#15803D', bg: '#DCFCE7', barColor: '#16A34A' }
  if (total >= 14) return { label: 'Proceed with Caution', color: '#92400E', bg: '#FEF3C7', barColor: '#D97706' }
  if (total >= 8)  return { label: 'Needs Review', color: '#C2410C', bg: '#FFEDD5', barColor: '#EA580C' }
  return { label: 'No-Go', color: '#991B1B', bg: '#FEE2E2', barColor: '#DC2626' }
}

function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again."
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return 'The request took too long to complete. Try again.'
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
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
  display: 'block',
  margin: 0,
}

// ── SaveIndicator ─────────────────────────────────────────────────────────────

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

// ── StarRating ────────────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= (hover || value)
        return (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(value === n ? 0 : n)}
            title={`${n} / 5`}
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: filled ? '#E8520A' : '#D1D5DB',
              transition: 'color 0.1s',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

// ── AnimatedBar ───────────────────────────────────────────────────────────────

function AnimatedBar({ total, barColor }: { total: number; barColor: string }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setWidth((total / 25) * 100)
    })
    return () => cancelAnimationFrame(id)
  }, [total])

  return (
    <div style={{
      height: '10px',
      backgroundColor: '#E5E7EB',
      borderRadius: '999px',
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        backgroundColor: barColor,
        borderRadius: '999px',
        transition: 'width 0.6s ease-out',
      }} />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DealScorecard({
  workspaceId,
  preferredModel = 'claude-sonnet-4-5',
}: DealScorecardProps) {
  const [loading, setLoading] = useState(true)
  const [scores, setScores] = useState<ScoreMap>({ ...DEFAULT_SCORES })
  const [notes, setNotes] = useState<NotesMap>({ ...DEFAULT_NOTES })
  const [copilotRec, setCopilotRec] = useState('')
  const [recLabel, setRecLabel] = useState('')

  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [painPoints, setPainPoints] = useState<PainPoint[]>([])

  const [copilotLoading, setCopilotLoading] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [copilotOutput, setCopilotOutput] = useState<CopilotResult | null>(null)
  const [copilotError, setCopilotError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const scoresRef = useRef<ScoreMap>({ ...DEFAULT_SCORES })
  const notesRef = useRef<NotesMap>({ ...DEFAULT_NOTES })
  const copilotRecRef = useRef('')
  const recLabelRef = useRef('')

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [step4Result, currentResult] = await Promise.all([
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
            .eq('step_id', '38')
            .order('version', { ascending: false })
            .limit(1),
        ] as const)

        // Pain points from Step 4
        if (step4Result.data && step4Result.data.length > 0) {
          const c = (step4Result.data[0] as Record<string, unknown>)['content'] as Record<string, unknown> | null
          const pts = c?.['pain_points']
          if (Array.isArray(pts)) {
            const count = Math.max(1, Math.min(4, Number(c?.['active_count'] ?? (pts as unknown[]).length)))
            setPainPoints(
              (pts as Array<Record<string, unknown>>)
                .filter(pp => Number(pp['index']) <= count)
                .map(pp => ({
                  index: Number(pp['index'] ?? 0),
                  title: String(pp['title'] ?? ''),
                  description: String(pp['description'] ?? ''),
                })),
            )
          }
        }

        // Existing scorecard
        if (currentResult.data && currentResult.data.length > 0) {
          const row = currentResult.data[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          if (c) {
            const s = c['scores'] as Record<string, unknown> | null
            if (s) {
              const parsed: ScoreMap = {
                opportunity: Number(s['opportunity'] ?? 0),
                resources: Number(s['resources'] ?? 0),
                compete: Number(s['compete'] ?? 0),
                win: Number(s['win'] ?? 0),
                worth_it: Number(s['worth_it'] ?? 0),
              }
              setScores(parsed)
              scoresRef.current = parsed
            }
            const n = c['notes'] as Record<string, unknown> | null
            if (n) {
              const parsed: NotesMap = {
                opportunity: String(n['opportunity'] ?? ''),
                resources: String(n['resources'] ?? ''),
                compete: String(n['compete'] ?? ''),
                win: String(n['win'] ?? ''),
                worth_it: String(n['worth_it'] ?? ''),
              }
              setNotes(parsed)
              notesRef.current = parsed
            }
            if (typeof c['copilot_recommendation'] === 'string') {
              setCopilotRec(c['copilot_recommendation'])
              copilotRecRef.current = c['copilot_recommendation']
            }
            if (typeof c['recommendation_label'] === 'string') {
              setRecLabel(c['recommendation_label'])
              recLabelRef.current = c['recommendation_label']
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
  }, [workspaceId])

  // ── Save ────────────────────────────────────────────────────────────────────

  const persist = useCallback(async (
    s: ScoreMap,
    n: NotesMap,
    rec: string,
    label: string,
  ) => {
    setSaveState('saving')
    try {
      const contentPayload = {
        scores: s,
        notes: n,
        copilot_recommendation: rec,
        recommendation_label: label,
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
            step_id: '38',
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
  }, [outputId, outputVersion, workspaceId])

  saveRef.current = () => persist(scoresRef.current, notesRef.current, copilotRecRef.current, recLabelRef.current)

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_MS)
  }

  function handleScoreChange(key: DimensionKey, value: number) {
    setScores(prev => {
      const next = { ...prev, [key]: value }
      scoresRef.current = next
      return next
    })
    scheduleSave()
  }

  function handleNotesChange(key: DimensionKey, value: string) {
    setNotes(prev => {
      const next = { ...prev, [key]: value }
      notesRef.current = next
      return next
    })
    scheduleSave()
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void saveRef.current()
  }

  // ── Copilot ─────────────────────────────────────────────────────────────────

  async function runCopilot() {
    if (copilotLoading) return
    setCopilotLoading(true)
    setCopilotOutput(null)
    setCopilotError(null)
    setStreamBuffer('')

    const total = Object.values(scoresRef.current).reduce((a, b) => a + b, 0)
    const band = getScoreBand(total)

    const scoreLines = DIMENSIONS.map(d =>
      `${d.label}: ${scoresRef.current[d.key]}/5${notesRef.current[d.key] ? ` — "${notesRef.current[d.key]}"` : ''}`,
    ).join('\n')

    const ppContext = painPoints.length > 0
      ? painPoints.map(pp => `Pain Point ${pp.index}: ${pp.title}${pp.description ? ` — ${pp.description}` : ''}`).join('\n')
      : 'Pain points not yet defined.'

    const extraContext = [
      'DEAL SCORECARD EVALUATION',
      '',
      `Total Score: ${total}/25 — ${band.label}`,
      '',
      'DIMENSION SCORES:',
      scoreLines,
      '',
      'ACTIVE PAIN POINTS:',
      ppContext,
    ].join('\n')

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: '38',
          workspaceId,
          stepTitle: 'Deal Scorecard',
          stepDescription: `Evaluate this deal based on 5 scoring dimensions. Total: ${total}/25. Verdict: ${band.label}. Provide a concise recommendation explaining whether to pursue, qualify harder, or walk away, and what specific actions the sales team should take next.`,
          currentContent: copilotRecRef.current,
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

      let draftText = accumulated
      try {
        const parsed = JSON.parse(accumulated) as CopilotResult
        setCopilotOutput(parsed)
        draftText = parsed.draft
      } catch {
        setCopilotOutput({ draft: accumulated, confidence: 0, sources: [], assumptions: [], open_questions: [], verification_checks: [] })
      }
      setStreamBuffer('')

      // Auto-apply recommendation + label to state and save
      const total2 = Object.values(scoresRef.current).reduce((a, b) => a + b, 0)
      const band2 = getScoreBand(total2)
      setCopilotRec(draftText)
      copilotRecRef.current = draftText
      setRecLabel(band2.label)
      recLabelRef.current = band2.label
      void persist(scoresRef.current, notesRef.current, draftText, band2.label)
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

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  const band = getScoreBand(total)
  const allScored = DIMENSIONS.every(d => scores[d.key] > 0)

  return (
    <div style={{ maxWidth: '880px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Score summary card ─────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0D0D0D', margin: '0 0 2px' }}>
              Deal Score
            </h2>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              Rate each of the five dimensions to evaluate your deal
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <SaveIndicator state={saveState} />
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: band.bg,
              color: band.color,
              fontSize: '13px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              {band.label}
            </span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: band.color }}>
              {total}<span style={{ fontSize: '14px', fontWeight: 500, color: '#6B7280' }}>/25</span>
            </span>
          </div>
        </div>
        <AnimatedBar total={total} barColor={band.barColor} />
        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px' }}>
          {[
            { range: '20–25', label: 'Strong Go', color: '#15803D' },
            { range: '14–19', label: 'Proceed with Caution', color: '#D97706' },
            { range: '8–13', label: 'Needs Review', color: '#EA580C' },
            { range: '5–7', label: 'No-Go', color: '#DC2626' },
          ].map(b => (
            <span key={b.label} style={{ fontSize: '11px', color: b.color, fontWeight: 600 }}>
              {b.range} — {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Dimension cards ────────────────────────────────────────────────── */}
      {DIMENSIONS.map(dim => (
        <div key={dim.key} style={CARD}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D', margin: '0 0 4px' }}>
                {dim.label}
              </h3>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px', lineHeight: '1.55' }}>
                {dim.question}
              </p>
              <StarRating
                value={scores[dim.key]}
                onChange={v => handleScoreChange(dim.key, v)}
              />
              {scores[dim.key] > 0 && (
                <span style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px', display: 'block' }}>
                  {scores[dim.key]}/5
                </span>
              )}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label style={{ ...LABEL_STYLE, marginBottom: '6px' }}>Notes (optional)</label>
            <textarea
              value={notes[dim.key]}
              onChange={e => handleNotesChange(dim.key, e.target.value)}
              onBlur={handleBlur}
              placeholder="Add context, evidence, or concerns for this dimension…"
              rows={2}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: '1.55',
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
      ))}

      {/* ── Copilot Evaluation ──────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ ...LABEL_STYLE, marginBottom: '2px' }}>Copilot Evaluation</span>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              Get an AI recommendation based on your scores and context
            </p>
          </div>
          <button
            onClick={() => void runCopilot()}
            disabled={copilotLoading || !allScored}
            title={!allScored ? 'Score all 5 dimensions first' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 18px',
              minHeight: '44px',
              backgroundColor: copilotLoading || !allScored ? '#F3F4F6' : '#E8520A',
              color: copilotLoading || !allScored ? '#9CA3AF' : '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: copilotLoading || !allScored ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {copilotLoading
              ? <><Loader2 size={15} className="animate-spin" /> Evaluating…</>
              : <><Wand2 size={15} /> Evaluate Deal</>
            }
          </button>
        </div>

        {!allScored && (
          <p style={{ fontSize: '12px', color: '#D97706', margin: '0 0 10px' }}>
            Score all 5 dimensions to unlock the Copilot evaluation.
          </p>
        )}

        {copilotLoading && streamBuffer && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: '#E8520A', flexShrink: 0, marginTop: '2px' }} />
            <p style={{
              fontSize: '12px', color: '#0D0D0D', fontFamily: 'monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              maxHeight: '100px', overflowY: 'auto', margin: 0,
            }}>
              {streamBuffer.slice(-300)}
            </p>
          </div>
        )}

        {copilotError && (
          <div style={{
            padding: '12px 14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
            marginBottom: '10px',
          }}>
            <p style={{ fontSize: '13px', color: '#991B1B', margin: '0 0 4px' }}>{copilotError}</p>
            <a href="https://status.anthropic.com" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', color: '#991B1B', textDecoration: 'underline' }}>
              Check AI Status ↗
            </a>
          </div>
        )}

        {copilotOutput && !copilotLoading && (
          <div style={{
            backgroundColor: '#F8F6F1',
            borderRadius: '8px',
            padding: '14px',
            marginTop: '4px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ ...LABEL_STYLE }}>Recommendation</span>
              {recLabel && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  backgroundColor: band.bg,
                  color: band.color,
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {recLabel}
                </span>
              )}
              {copilotOutput.confidence > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  backgroundColor: copilotOutput.confidence >= 71 ? '#DCFCE7' : copilotOutput.confidence >= 41 ? '#FEF3C7' : '#FEE2E2',
                  color: copilotOutput.confidence >= 71 ? '#16A34A' : copilotOutput.confidence >= 41 ? '#D97706' : '#DC2626',
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {copilotOutput.confidence}/100 confidence
                </span>
              )}
            </div>
            <p style={{ fontSize: '14px', color: '#0D0D0D', lineHeight: '1.65', margin: 0, whiteSpace: 'pre-wrap' }}>
              {copilotOutput.draft}
            </p>
          </div>
        )}

        {copilotRec && !copilotOutput && (
          <div style={{
            backgroundColor: '#F8F6F1',
            borderRadius: '8px',
            padding: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ ...LABEL_STYLE }}>Last Evaluation</span>
              {recLabel && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  backgroundColor: band.bg,
                  color: band.color,
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {recLabel}
                </span>
              )}
            </div>
            <p style={{ fontSize: '14px', color: '#0D0D0D', lineHeight: '1.65', margin: 0, whiteSpace: 'pre-wrap' }}>
              {copilotRec}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
