'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2, Lightbulb } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type SectionKey =
  | 'introduction'
  | 'evaluation'
  | 'presentation'
  | 'proposal'
  | 'execution'
  | 'length'
  | 'decision_criteria'
  | 'keys_to_winning'

type SectionContent = Record<SectionKey, string>

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface CompetitiveEvaluationEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 1500

const SECTIONS: ReadonlyArray<{ key: SectionKey; label: string; description: string }> = [
  {
    key: 'introduction',
    label: 'Introduction',
    description: 'How does your company typically get introduced into a competitive evaluation? (referral, outreach, RFP, inbound)',
  },
  {
    key: 'evaluation',
    label: 'Evaluation Process',
    description: 'What does the formal evaluation look like? (interviews, demos, trials, scoring rubrics, site visits)',
  },
  {
    key: 'presentation',
    label: 'Presentation',
    description: 'What presentation or pitch format is expected? Who attends? How long?',
  },
  {
    key: 'proposal',
    label: 'Proposal',
    description: 'What does a winning proposal contain? What format do buyers expect?',
  },
  {
    key: 'execution',
    label: 'Execution',
    description: 'What happens immediately after selection? What does onboarding look like?',
  },
  {
    key: 'length',
    label: 'Length of Evaluation',
    description: 'How long does the full evaluation process take from first contact to signed contract?',
  },
  {
    key: 'decision_criteria',
    label: 'Key Decision Criteria',
    description: 'What are the top 3-5 criteria buyers use to make the final selection? How are they weighted?',
  },
  {
    key: 'keys_to_winning',
    label: 'Keys to Winning',
    description: 'What specific actions, proof points, or behaviors consistently lead to winning these evaluations?',
  },
]

const TIPS: ReadonlyArray<string> = [
  'Pull from your DCP Map — buyers told you exactly how they evaluate in Stages 4 and 5.',
  'Keys to Winning should be specific actions, not generic advice.',
  'Length of evaluation affects your pipeline forecasting — be accurate.',
]

const EMPTY_CONTENT: SectionContent = {
  introduction: '',
  evaluation: '',
  presentation: '',
  proposal: '',
  execution: '',
  length: '',
  decision_criteria: '',
  keys_to_winning: '',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL_CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '20px',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.7)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '4px',
}

const SECTION_DESC: React.CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.5)',
  fontStyle: 'italic',
  margin: '0 0 8px',
  lineHeight: 1.5,
}

const TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #9CA3AF',
  borderRadius: '8px',
  fontSize: '14px',
  lineHeight: 1.6,
  color: '#0D0D0D',
  backgroundColor: '#FFFFFF',
  resize: 'vertical',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again."
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return 'The request took too long to complete. Try again.'
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

function parseSavedContent(c: unknown): SectionContent {
  if (!c || typeof c !== 'object') return { ...EMPTY_CONTENT }
  const obj = c as Record<string, unknown>
  const sections = obj['sections']
  const source = (sections && typeof sections === 'object') ? sections as Record<string, unknown> : obj
  const next: SectionContent = { ...EMPTY_CONTENT }
  for (const { key } of SECTIONS) {
    const v = source[key]
    if (typeof v === 'string') next[key] = v
  }
  return next
}

function stripFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return raw.slice(start, end + 1)
}

function parseCopilotJson(raw: string): Partial<SectionContent> | null {
  const candidates = [extractFirstJsonObject(raw) ?? '', stripFences(raw), raw]
  for (const c of candidates) {
    if (!c) continue
    try {
      const obj = JSON.parse(c) as Record<string, unknown>
      const result: Partial<SectionContent> = {}
      let matched = false
      for (const { key } of SECTIONS) {
        const v = obj[key]
        if (typeof v === 'string') {
          result[key] = v
          matched = true
        }
      }
      if (matched) return result
    } catch { /* try next candidate */ }
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompetitiveEvaluationEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
}: CompetitiveEvaluationEditorProps) {
  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState<SectionContent>({ ...EMPTY_CONTENT })

  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotError, setCopilotError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sectionsRef = useRef<SectionContent>({ ...EMPTY_CONTENT })
  sectionsRef.current = sections

  // ── Load saved content ─────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await supabase
          .from('step_output')
          .select('id, content, version')
          .eq('workspace_id', workspaceId)
          .eq('step_id', stepId)
          .order('version', { ascending: false })
          .limit(1)
        if (cancelled) return
        if (data && data.length > 0) {
          const row = data[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          setSections(parseSavedContent(row['content']))
        }
      } catch { /* non-fatal */ }
      finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [workspaceId, stepId])

  // ── Save ───────────────────────────────────────────────────────────────────

  const persist = useCallback(async (next: SectionContent) => {
    setSaveState('saving')
    try {
      const contentPayload = { sections: next }
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
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }, [outputId, outputVersion, stepId, workspaceId])

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void persist(sectionsRef.current) }, AUTOSAVE_MS)
  }

  function handleChange(key: SectionKey, value: string) {
    setSections(prev => {
      const next = { ...prev, [key]: value }
      sectionsRef.current = next
      return next
    })
    scheduleSave()
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void persist(sectionsRef.current)
  }

  // ── Copilot ────────────────────────────────────────────────────────────────

  async function runCopilot() {
    if (copilotLoading) return
    setCopilotLoading(true)
    setCopilotError(null)

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          workspaceId,
          stepTitle,
          stepDescription: 'Competitive Evaluation playbook — how buyers evaluate GTM strategy partners.',
          currentContent: JSON.stringify(sectionsRef.current),
          preferredModel,
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
      }

      if (accumulated.includes('__STREAM_ERROR__')) {
        const match = accumulated.match(/__STREAM_ERROR__:(\w+)/)
        setCopilotError(copilotErrorMessage(match ? match[1] : 0))
        return
      }

      const parsed = parseCopilotJson(accumulated)
      if (!parsed) {
        setCopilotError('Copilot returned an unexpected response. Please try again.')
        return
      }

      const merged: SectionContent = { ...sectionsRef.current }
      for (const { key } of SECTIONS) {
        const v = parsed[key]
        if (typeof v === 'string' && v.trim()) merged[key] = v
      }
      sectionsRef.current = merged
      setSections(merged)
      void persist(merged)
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>

      {/* ── LEFT: Sections ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <button
            onClick={() => void runCopilot()}
            disabled={copilotLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 18px', minHeight: '44px',
              backgroundColor: copilotLoading ? 'rgba(232,82,10,0.5)' : '#E8520A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px', fontWeight: 600,
              cursor: copilotLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {copilotLoading
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><Wand2 size={15} /> Generate with Copilot</>
            }
          </button>
          {saveState === 'saving' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              <Loader2 size={12} className="animate-spin" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span style={{ fontSize: '12px', color: '#16A34A' }}>Saved</span>
          )}
          {saveState === 'error' && (
            <span style={{ fontSize: '12px', color: '#EF4444' }}>Save failed</span>
          )}
        </div>

        {copilotError && (
          <div style={{ ...PANEL_CARD, border: '1px solid rgba(248,113,113,0.35)', backgroundColor: 'rgba(239,68,68,0.1)' }}>
            <p style={{ fontSize: '13px', color: '#FCA5A5', margin: 0 }}>{copilotError}</p>
          </div>
        )}

        <div style={PANEL_CARD}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {SECTIONS.map(section => (
              <div key={section.key}>
                <p style={SECTION_LABEL}>{section.label}</p>
                <p style={SECTION_DESC}>{section.description}</p>
                <textarea
                  value={sections[section.key]}
                  onChange={e => handleChange(section.key, e.target.value)}
                  onBlur={handleBlur}
                  rows={4}
                  placeholder="Write here, or use Generate with Copilot to draft from your DCP Map…"
                  style={TEXTAREA_STYLE}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Tips ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={PANEL_CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Lightbulb size={15} style={{ color: '#0EA5E9' }} />
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}>
              Tips
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {TIPS.map((tip, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
