'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Wand2, ShieldCheck, Sparkles, HelpCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type CopilotAction = 'draft' | 'verify' | 'improve' | 'explain'

interface StepDef {
  id: string
  title: string
  description: string
  section: string
}

interface CopilotOutput {
  draft: string
  confidence: number
  sources: string[]
  assumptions: string[]
  open_questions: string[]
  verification_checks: string[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_DELAY_MS = 1200

// ── Styles ────────────────────────────────────────────────────────────────────

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
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 71 ? '#16A34A' : score >= 41 ? '#D97706' : '#DC2626'
  const bg = score >= 71 ? '#DCFCE7' : score >= 41 ? '#FEF3C7' : '#FEE2E2'
  const label = score >= 71 ? 'High' : score >= 41 ? 'Medium' : 'Low'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        backgroundColor: bg,
        color,
        fontSize: '12px',
        fontWeight: 700,
      }}
    >
      {label} confidence — {score}/100
    </span>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled: boolean
  active: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 16px',
        minHeight: '44px',
        backgroundColor: active ? '#E8520A' : disabled ? '#F3F4F6' : '#FFFFFF',
        color: active ? '#FFFFFF' : disabled ? '#9CA3AF' : '#0D0D0D',
        border: `1px solid ${active ? '#E8520A' : '#E5E7EB'}`,
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '100%',
        transition: 'background-color 0.15s, color 0.15s',
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

// ── Save indicator ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280' }}>
      <Loader2 size={12} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return (
    <span style={{ fontSize: '12px', color: '#16A34A' }}>Saved</span>
  )
  return <span style={{ fontSize: '12px', color: '#EF4444' }}>Save failed</span>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StepPage() {
  const { stepId } = useParams<{ stepId: string }>()

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [preferredModel, setPreferredModel] = useState('claude-sonnet-4-20250514')
  const [stepDef, setStepDef] = useState<StepDef | null>(null)
  const [content, setContent] = useState('')
  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [loading, setLoading] = useState(true)

  const [copilotStreaming, setCopilotStreaming] = useState(false)
  const [activeAction, setActiveAction] = useState<CopilotAction | null>(null)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [copilotOutput, setCopilotOutput] = useState<CopilotOutput | null>(null)
  const [copilotError, setCopilotError] = useState<string | null>(null)
  const [isProvisional, setIsProvisional] = useState(false)
  const [missingPrereqs, setMissingPrereqs] = useState<string[]>([])

  // saveRef always closes over latest state so the debounced save is current
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Data load ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single()
        if (!userRow) return

        const wsId = (userRow as Record<string, unknown>)['org_id'] as string
        setWorkspaceId(wsId)

        // Load workspace preferred model
        const { data: org } = await supabase
          .from('organizations')
          .select('preferred_model')
          .eq('id', wsId)
          .single()
        if (org) {
          const orgRow = org as Record<string, unknown>
          setPreferredModel(String(orgRow['preferred_model'] ?? 'claude-sonnet-4-20250514'))
        }

        // Load step definition — may not exist yet
        const { data: stepRow } = await supabase
          .from('step_definition')
          .select('id, title, description, section')
          .eq('id', stepId)
          .single()
        if (stepRow) {
          const r = stepRow as Record<string, unknown>
          setStepDef({
            id: String(r['id'] ?? stepId),
            title: String(r['title'] ?? `Step ${stepId}`),
            description: String(r['description'] ?? ''),
            section: String(r['section'] ?? ''),
          })
        }

        // Load latest step_output for this step + workspace
        const { data: outputRows } = await supabase
          .from('step_output')
          .select('id, content, version')
          .eq('workspace_id', wsId)
          .eq('step_id', stepId)
          .order('version', { ascending: false })
          .limit(1)

        if (outputRows && outputRows.length > 0) {
          const row = outputRows[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          setContent(typeof c?.['text'] === 'string' ? c['text'] : JSON.stringify(c ?? '', null, 2))
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [stepId])

  // ── Auto-save ───────────────────────────────────────────────────────────────

  const persistContent = useCallback(async (text: string, wsId: string) => {
    setSaveState('saving')
    try {
      const contentPayload = { text }
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
            workspace_id: wsId,
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
  }, [outputId, outputVersion, stepId])

  // Keep saveRef current each render
  saveRef.current = async () => {
    if (workspaceId) await persistContent(content, workspaceId)
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_DELAY_MS)
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    scheduleSave()
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void saveRef.current()
  }

  // ── Copilot action ──────────────────────────────────────────────────────────

  async function runCopilot(action: CopilotAction) {
    if (!workspaceId || copilotStreaming) return
    setCopilotStreaming(true)
    setActiveAction(action)
    setCopilotOutput(null)
    setCopilotError(null)
    setStreamBuffer('')

    const actionPrompts: Record<CopilotAction, string> = {
      draft: 'Generate the draft now.',
      verify: 'Verify the current content for accuracy and completeness. Return the same JSON shape but set the draft field to a list of verification notes.',
      improve: 'Improve the current content. Return the same JSON shape with an improved draft.',
      explain: 'Explain the reasoning behind the current content. Return the same JSON shape with an explanation in the draft field.',
    }

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          workspaceId,
          stepTitle: stepDef?.title ?? `Step ${stepId}`,
          stepDescription: stepDef?.description ?? '',
          currentContent: content,
          preferredModel,
          actionHint: actionPrompts[action],
        }),
      })

      if (!res.ok || !res.body) {
        setCopilotError(`Request failed: ${res.status}`)
        return
      }

      setIsProvisional(res.headers.get('X-Provisional') === '1')
      const missingHeader = res.headers.get('X-Missing-Prerequisites') ?? ''
      setMissingPrereqs(missingHeader ? missingHeader.split(',') : [])

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
        setCopilotError('Copilot encountered an error. Please try again.')
        return
      }

      // Parse JSON from streamed text
      try {
        const parsed = JSON.parse(accumulated) as CopilotOutput
        setCopilotOutput(parsed)
        setStreamBuffer('')
      } catch {
        // Show raw output if not valid JSON
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
      setCopilotError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCopilotStreaming(false)
    }
  }

  function applyDraft() {
    if (!copilotOutput) return
    setContent(copilotOutput.draft)
    scheduleSave()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  const stepTitle = stepDef?.title ?? `Step ${stepId}`
  const stepDesc = stepDef?.description ?? ''

  return (
    <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {stepDef?.section ?? 'Journeys'}
        </p>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>{stepTitle}</h1>
        {stepDesc && (
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginTop: '6px', margin: '6px 0 0' }}>
            {stepDesc}
          </p>
        )}
      </header>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', padding: '28px 32px', maxWidth: '1200px' }}>

        {/* ── Left: Editor ─────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <label style={LABEL_STYLE}>Your Content</label>
            <SaveIndicator state={saveState} />
          </div>
          <textarea
            value={content}
            onChange={handleContentChange}
            onBlur={handleBlur}
            placeholder="Start writing, or use the Copilot panel to generate a first draft…"
            style={{
              width: '100%',
              minHeight: '420px',
              padding: '16px',
              border: '1px solid #9CA3AF',
              borderRadius: '10px',
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

          {/* Missing prerequisites banner */}
          {missingPrereqs.length > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '12px 16px',
              backgroundColor: '#FEF3C7',
              borderRadius: '8px',
              border: '1px solid #FCD34D',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}>
              <AlertTriangle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400E', margin: '0 0 2px' }}>
                  Missing prerequisites
                </p>
                <p style={{ fontSize: '12px', color: '#78350F', margin: 0 }}>
                  Steps {missingPrereqs.join(', ')} have no approved output yet. Copilot results may be incomplete.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Copilot panel ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Action buttons */}
          <div style={PANEL_CARD}>
            <p style={LABEL_STYLE}>Copilot Actions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ActionButton
                icon={Wand2}
                label="Draft"
                onClick={() => void runCopilot('draft')}
                disabled={copilotStreaming}
                active={activeAction === 'draft' && copilotStreaming}
              />
              <ActionButton
                icon={ShieldCheck}
                label="Verify"
                onClick={() => void runCopilot('verify')}
                disabled={copilotStreaming}
                active={activeAction === 'verify' && copilotStreaming}
              />
              <ActionButton
                icon={Sparkles}
                label="Improve"
                onClick={() => void runCopilot('improve')}
                disabled={copilotStreaming}
                active={activeAction === 'improve' && copilotStreaming}
              />
              <ActionButton
                icon={HelpCircle}
                label="Explain"
                onClick={() => void runCopilot('explain')}
                disabled={copilotStreaming}
                active={activeAction === 'explain' && copilotStreaming}
              />
            </div>
          </div>

          {/* Streaming / output */}
          {copilotStreaming && !copilotOutput && (
            <div style={{ ...PANEL_CARD, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: '#E8520A', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 6px' }}>Generating…</p>
                <p style={{
                  fontSize: '12px',
                  color: '#0D0D0D',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  margin: 0,
                }}>
                  {streamBuffer.slice(-300)}
                </p>
              </div>
            </div>
          )}

          {copilotError && (
            <div style={{ ...PANEL_CARD, border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2' }}>
              <p style={{ fontSize: '13px', color: '#991B1B', margin: 0 }}>{copilotError}</p>
            </div>
          )}

          {copilotOutput && !copilotStreaming && (
            <>
              {/* Confidence + provisional */}
              <div style={PANEL_CARD}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                  <ConfidenceBadge score={copilotOutput.confidence} />
                  {isProvisional && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#D97706',
                      backgroundColor: '#FEF3C7',
                      padding: '3px 8px',
                      borderRadius: '999px',
                    }}>
                      Provisional
                    </span>
                  )}
                </div>

                {/* Draft */}
                <p style={{ ...LABEL_STYLE, marginBottom: '6px' }}>Proposed draft</p>
                <div style={{
                  fontSize: '13px',
                  color: '#0D0D0D',
                  lineHeight: '1.6',
                  backgroundColor: '#F8F6F1',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '12px',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}>
                  {copilotOutput.draft}
                </div>
                <button
                  onClick={applyDraft}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    backgroundColor: '#E8520A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Apply to editor
                </button>
              </div>

              {/* Sources */}
              {copilotOutput.sources.length > 0 && (
                <div style={PANEL_CARD}>
                  <p style={LABEL_STYLE}>Sources used</p>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    {copilotOutput.sources.map((s, i) => (
                      <li key={i} style={{ fontSize: '12px', color: '#0D0D0D', marginBottom: '2px' }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Assumptions */}
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

              {/* Open questions */}
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

              {/* Verification checks */}
              {copilotOutput.verification_checks.length > 0 && (
                <div style={PANEL_CARD}>
                  <p style={LABEL_STYLE}>Verification checks</p>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    {copilotOutput.verification_checks.map((v, i) => (
                      <li key={i} style={{ fontSize: '12px', color: '#0D0D0D', marginBottom: '2px' }}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
