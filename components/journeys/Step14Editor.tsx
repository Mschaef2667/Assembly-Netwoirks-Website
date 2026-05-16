'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type CompetencyKey = 'knowledge' | 'experience' | 'partners' | 'leadership' | 'resources'

interface Step14Content {
  knowledge: string
  experience: string
  partners: string
  leadership: string
  resources: string
}

interface CompetencyField {
  key: CompetencyKey
  label: string
  subtitle: string
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

export interface Step14EditorProps {
  workspaceId: string
  preferredModel?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 800

const COMPETENCY_FIELDS: CompetencyField[] = [
  { key: 'knowledge',   label: 'Knowledge',   subtitle: 'What does your team know that enables delivery?' },
  { key: 'experience',  label: 'Experience',  subtitle: 'What have you done before that proves you can deliver?' },
  { key: 'partners',    label: 'Partners',    subtitle: 'Which partners extend your capability?' },
  { key: 'leadership',  label: 'Leadership',  subtitle: 'What leadership qualities drive your delivery?' },
  { key: 'resources',   label: 'Resources',   subtitle: 'What tools, capital, or assets back your delivery?' },
]

const EMPTY_CONTENT: Step14Content = {
  knowledge: '', experience: '', partners: '', leadership: '', resources: '',
}

const PANEL_CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  padding: '20px',
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

function extractText(content: Record<string, unknown> | null): string {
  if (!content) return ''
  if (typeof content['text'] === 'string') return content['text']
  return JSON.stringify(content, null, 2)
}

function extractByPainPoint(content: Record<string, unknown> | null): string {
  if (!content) return ''
  const bpp = content['by_pain_point']
  if (!Array.isArray(bpp)) return extractText(content)
  return (bpp as Array<Record<string, unknown>>)
    .map(e => `Pain Point ${e['index']}: ${String(e['content'] ?? '')}`)
    .filter(s => s.trim().length > 0)
    .join('\n\n')
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
  const color = score >= 71 ? '#15803D' : score >= 41 ? '#92400E' : '#991B1B'
  const bg    = score >= 71 ? '#DCFCE7' : score >= 41 ? '#FEF3C7' : '#FEE2E2'
  const label = score >= 71 ? 'High'    : score >= 41 ? 'Medium'  : 'Low'
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

export default function Step14Editor({
  workspaceId,
  preferredModel = 'claude-sonnet-4-5',
}: Step14EditorProps) {
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<Step14Content>(EMPTY_CONTENT)
  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [companyContext, setCompanyContext] = useState('')

  // Copilot — one active at a time
  const [activeCopilotField, setActiveCopilotField] = useState<CompetencyKey | null>(null)
  const [copilotStreaming, setCopilotStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [copilotDraft, setCopilotDraft] = useState<{ field: CompetencyKey; result: CopilotResult } | null>(null)
  const [copilotError, setCopilotError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        // Current step (14) output
        const { data: outputRows } = await supabase
          .from('step_output')
          .select('id, content, version')
          .eq('workspace_id', workspaceId)
          .eq('step_id', '14')
          .order('version', { ascending: false })
          .limit(1)

        if (outputRows && outputRows.length > 0) {
          const row = outputRows[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          if (c) {
            setContent({
              knowledge:  typeof c['knowledge']  === 'string' ? c['knowledge']  : '',
              experience: typeof c['experience'] === 'string' ? c['experience'] : '',
              partners:   typeof c['partners']   === 'string' ? c['partners']   : '',
              leadership: typeof c['leadership'] === 'string' ? c['leadership'] : '',
              resources:  typeof c['resources']  === 'string' ? c['resources']  : '',
            })
          }
        }

        // Company context: steps 1, 2, 3 (generic text) + step 13 (by_pain_point)
        const { data: contextRows } = await supabase
          .from('step_output')
          .select('step_id, content')
          .eq('workspace_id', workspaceId)
          .in('step_id', ['1', '2', '3', '13'])
          .order('version', { ascending: false })

        if (contextRows && contextRows.length > 0) {
          // Dedupe: keep only the highest-version row per step
          const seen = new Set<string>()
          const deduped: Array<{ step_id: string; content: Record<string, unknown> | null }> = []
          for (const row of contextRows as Array<Record<string, unknown>>) {
            const sid = String(row['step_id'] ?? '')
            if (!seen.has(sid)) {
              seen.add(sid)
              deduped.push({
                step_id: sid,
                content: row['content'] as Record<string, unknown> | null,
              })
            }
          }

          const blocks: string[] = []
          const labels: Record<string, string> = {
            '1': 'Step 1 — What the company sells (Product/Service Profile)',
            '2': 'Step 2 — Top Market Segments',
            '3': 'Step 3 — Key Decision Makers',
            '13': 'Step 13 — Critical Success Formulas',
          }
          for (const { step_id, content: c } of deduped) {
            const text = step_id === '13' ? extractByPainPoint(c) : extractText(c)
            if (text.trim()) blocks.push(`${labels[step_id] ?? `Step ${step_id}`}:\n${text}`)
          }
          setCompanyContext(blocks.join('\n\n'))
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

  const persistContent = useCallback(async (c: Step14Content) => {
    setSaveState('saving')
    try {
      const now = new Date().toISOString()
      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content: c, last_saved_at: now, last_updated_at: now })
          .eq('id', outputId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('step_output')
          .insert({
            workspace_id: workspaceId,
            step_id: '14',
            version: outputVersion,
            status: 'draft',
            content: c,
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

  saveRef.current = async () => { await persistContent(content) }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_MS)
  }

  function handleChange(key: CompetencyKey, value: string) {
    setContent(prev => ({ ...prev, [key]: value }))
    scheduleSave()
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void saveRef.current()
  }

  // ── Copilot ─────────────────────────────────────────────────────────────────

  async function runCopilot(field: CompetencyField) {
    if (copilotStreaming) return
    setCopilotStreaming(true)
    setActiveCopilotField(field.key)
    setCopilotDraft(null)
    setCopilotError(null)
    setStreamBuffer('')

    const extraContext = [
      `COMPETENCY FIELD: ${field.label}`,
      `QUESTION: ${field.subtitle}`,
      '',
      companyContext ? `COMPANY CONTEXT:\n${companyContext}` : 'No company profile data available yet.',
    ].join('\n')

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: '14',
          workspaceId,
          stepTitle: 'Core Competencies',
          stepDescription: `Generate the ${field.label} competency: ${field.subtitle}`,
          currentContent: content[field.key],
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
        setCopilotDraft({ field: field.key, result: parsed })
        setStreamBuffer('')
      } catch {
        setCopilotDraft({
          field: field.key,
          result: {
            draft: accumulated, confidence: 0,
            sources: [], assumptions: [], open_questions: [], verification_checks: [],
          },
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
    if (!copilotDraft) return
    const { field, result } = copilotDraft
    setContent(prev => ({ ...prev, [field]: result.draft }))
    scheduleSave()
    setCopilotDraft(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  const activeDraftField = copilotDraft
    ? COMPETENCY_FIELDS.find(f => f.key === copilotDraft.field)
    : null
  const activeStreamingField = activeCopilotField
    ? COMPETENCY_FIELDS.find(f => f.key === activeCopilotField)
    : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

      {/* ── Left: 5 competency fields ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Save indicator (shared for all fields) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SaveIndicator state={saveState} />
        </div>

        {COMPETENCY_FIELDS.map(field => (
          <div key={field.key} style={PANEL_CARD}>
            {/* Field header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <p style={{
                  fontSize: '13px', fontWeight: 700, color: '#0D0D0D',
                  margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {field.label}
                </p>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                  {field.subtitle}
                </p>
              </div>
              <button
                onClick={() => void runCopilot(field)}
                disabled={copilotStreaming}
                title={`Draft ${field.label} with Copilot`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 12px', minHeight: '32px', flexShrink: 0, marginLeft: '12px',
                  backgroundColor: copilotStreaming && activeCopilotField === field.key
                    ? '#F3F4F6'
                    : copilotStreaming
                      ? '#F3F4F6'
                      : '#E8520A',
                  color: copilotStreaming ? '#9CA3AF' : '#FFFFFF',
                  border: 'none', borderRadius: '6px',
                  fontSize: '12px', fontWeight: 600,
                  cursor: copilotStreaming ? 'not-allowed' : 'pointer',
                }}
              >
                {copilotStreaming && activeCopilotField === field.key
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Wand2 size={12} />
                }
                Draft
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={content[field.key]}
              onChange={e => handleChange(field.key, e.target.value)}
              onBlur={handleBlur}
              placeholder={field.subtitle}
              rows={4}
              style={{
                width: '100%',
                padding: '12px 14px',
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

            {/* Inline draft preview for this field */}
            {copilotDraft?.field === field.key && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#F8F6F1',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <ConfidenceBadge score={copilotDraft.result.confidence} />
                </div>
                <p style={{
                  fontSize: '13px', color: '#0D0D0D', lineHeight: '1.6',
                  whiteSpace: 'pre-wrap', margin: '0 0 10px',
                  maxHeight: '160px', overflowY: 'auto',
                }}>
                  {copilotDraft.result.draft}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={applyDraft}
                    style={{
                      padding: '6px 14px', minHeight: '32px',
                      backgroundColor: '#E8520A', color: '#FFFFFF',
                      border: 'none', borderRadius: '6px',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Apply to {field.label}
                  </button>
                  <button
                    onClick={() => setCopilotDraft(null)}
                    style={{
                      padding: '6px 14px', minHeight: '32px',
                      backgroundColor: 'transparent', color: '#6B7280',
                      border: '1px solid #E5E7EB', borderRadius: '6px',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Right: Copilot status panel ───────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Info card */}
        <div style={PANEL_CARD}>
          <p style={{
            fontSize: '11px', fontWeight: 700, color: '#6B7280',
            textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px',
          }}>
            Copilot
          </p>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: '1.5' }}>
            Click <strong>Draft</strong> on any field to generate a suggestion using your company profile and Critical Success Formulas.
          </p>
        </div>

        {/* Streaming indicator */}
        {copilotStreaming && (
          <div style={{ ...PANEL_CARD, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: '#E8520A', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 4px' }}>
                Drafting {activeStreamingField?.label ?? 'content'}…
              </p>
              {streamBuffer && (
                <p style={{
                  fontSize: '12px', color: '#0D0D0D', fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  maxHeight: '120px', overflowY: 'auto', margin: 0,
                }}>
                  {streamBuffer.slice(-300)}
                </p>
              )}
            </div>
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

        {/* Draft ready summary */}
        {copilotDraft && !copilotStreaming && activeDraftField && (
          <div style={PANEL_CARD}>
            <p style={{
              fontSize: '11px', fontWeight: 700, color: '#6B7280',
              textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px',
            }}>
              Draft ready
            </p>
            <p style={{ fontSize: '13px', color: '#0D0D0D', margin: '0 0 4px', fontWeight: 600 }}>
              {activeDraftField.label}
            </p>
            <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
              Review the draft in the field card and click <strong>Apply</strong> to use it.
            </p>
          </div>
        )}

        {/* Assumptions */}
        {copilotDraft && copilotDraft.result.assumptions.length > 0 && (
          <div style={PANEL_CARD}>
            <p style={{
              fontSize: '11px', fontWeight: 700, color: '#6B7280',
              textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px',
            }}>
              Assumptions
            </p>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              {copilotDraft.result.assumptions.map((a, i) => (
                <li key={i} style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
