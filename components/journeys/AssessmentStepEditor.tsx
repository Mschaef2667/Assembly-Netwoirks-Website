'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2, AlertTriangle, Lightbulb } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type RatingValue = 'strong' | 'moderate' | 'weak' | 'none' | ''
type GapLevel = 'none' | 'low' | 'medium' | 'high' | 'critical'

interface AssessmentItem {
  id: string
  label: string
  description: string
  currentState: RatingValue
  gapLevel: GapLevel
  notes: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface AssessmentStepEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 1500

const RATINGS: ReadonlyArray<{ value: Exclude<RatingValue, ''>; label: string; color: string; gap: GapLevel }> = [
  { value: 'strong',   label: 'Strong',   color: '#10B981', gap: 'none' },
  { value: 'moderate', label: 'Moderate', color: '#F59E0B', gap: 'low' },
  { value: 'weak',     label: 'Weak',     color: '#E8520A', gap: 'high' },
  { value: 'none',     label: 'None',     color: '#EF4444', gap: 'critical' },
]

const PANEL_CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '20px',
}

const STEP_COPY: Record<string, { headline: string; definition: string; tips: string[]; gapAlert: string }> = {
  '13': {
    headline: 'Critical Success Formulas',
    definition: 'A Critical Success Formula is a repeatable, documented process that when executed consistently produces a predictable outcome.',
    tips: [
      'If you cannot document it in 3 steps, it is not a formula yet.',
      'Your formulas should directly map to your Critical Success Factors from Step 12.',
      'Be specific — name the actual tools, people, and cadence involved.',
    ],
    gapAlert: 'Critical Gap: Your CVP promises this capability to buyers. Decide: Build it, hire for it, or partner to fill this gap before proceeding.',
  },
  '14': {
    headline: 'Core Competencies',
    definition: 'A Core Competency is an internal capability that gives you a sustainable competitive advantage and is difficult for others to replicate.',
    tips: [
      'Be brutally honest — your buyers will find the gaps you hide from yourself.',
      'A competency is only real if it is consistent, documented, and teachable.',
      'It is better to admit a gap now than to lose a client later.',
    ],
    gapAlert: 'Critical Gap: Your CVP promises this capability to buyers. Decide: Build it, hire for it, or partner to fill this gap before proceeding.',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function gapLevelFromState(state: RatingValue): GapLevel {
  switch (state) {
    case 'strong':   return 'none'
    case 'moderate': return 'low'
    case 'weak':     return 'high'
    case 'none':     return 'critical'
    default:         return 'none'
  }
}

function normalizeItem(raw: unknown): AssessmentItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const label = typeof r['label'] === 'string' ? r['label'] : ''
  const description = typeof r['description'] === 'string' ? r['description'] : ''
  if (!label.trim() && !description.trim()) return null
  const cs = typeof r['currentState'] === 'string' ? (r['currentState'] as string) : ''
  const currentState: RatingValue =
    cs === 'strong' || cs === 'moderate' || cs === 'weak' || cs === 'none' ? cs : ''
  const id = typeof r['id'] === 'string' && r['id'] ? r['id'] : makeId()
  const notes = typeof r['notes'] === 'string' ? r['notes'] : ''
  return {
    id,
    label,
    description,
    currentState,
    gapLevel: gapLevelFromState(currentState),
    notes,
  }
}

function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again."
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return 'The request took too long to complete. Try again or shorten your content.'
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

function extractItemsFromStream(raw: string): Array<{ label: string; description: string }> | null {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    const obj = JSON.parse(stripped) as Record<string, unknown>
    if (Array.isArray(obj['items'])) {
      const items: Array<{ label: string; description: string }> = []
      for (const it of obj['items'] as unknown[]) {
        if (typeof it === 'object' && it !== null) {
          const r = it as Record<string, unknown>
          const label = typeof r['label'] === 'string' ? r['label'] : ''
          const description = typeof r['description'] === 'string' ? r['description'] : ''
          if (label.trim() || description.trim()) items.push({ label, description })
        }
      }
      return items
    }
  } catch {
    /* fall through */
  }
  return null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
      <Loader2 size={12} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return <span style={{ fontSize: '12px', color: '#34D399' }}>✓ Saved</span>
  return <span style={{ fontSize: '12px', color: '#F87171' }}>Save failed</span>
}

function GapBadge({ level }: { level: GapLevel }) {
  const map: Record<GapLevel, { label: string; color: string; bg: string }> = {
    none:     { label: 'No gap',         color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    low:      { label: 'Low gap',        color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    medium:   { label: 'Medium gap',     color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    high:     { label: 'High gap',       color: '#E8520A', bg: 'rgba(232,82,10,0.18)' },
    critical: { label: 'Critical gap',   color: '#EF4444', bg: 'rgba(239,68,68,0.18)' },
  }
  const s = map[level]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '999px',
      backgroundColor: s.bg, color: s.color,
      fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {s.label}
    </span>
  )
}

function TipsCard({ stepId }: { stepId: string }) {
  const copy = STEP_COPY[stepId]
  if (!copy) return null
  return (
    <div style={{
      backgroundColor: '#0F2140',
      border: '1px solid rgba(255,255,255,0.1)',
      borderLeft: '3px solid #E8520A',
      borderRadius: '10px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Lightbulb size={15} style={{ color: '#E8520A', flexShrink: 0 }} />
        <span style={{
          fontSize: '11px', fontWeight: 700,
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          Tips &amp; Definitions
        </span>
      </div>
      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: '14px' }} />
      <p style={{
        fontSize: '13px', fontWeight: 700,
        color: '#FFFFFF', margin: '0 0 4px', lineHeight: '1.4',
      }}>
        Definition
      </p>
      <p style={{
        fontSize: '13px', color: 'rgba(255,255,255,0.65)',
        margin: '0 0 14px', lineHeight: '1.6',
      }}>
        {copy.definition}
      </p>
      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '0 0 14px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {copy.tips.map((t, i) => (
          <p key={i} style={{
            fontSize: '13px', color: 'rgba(255,255,255,0.6)',
            margin: 0, lineHeight: '1.55',
          }}>
            {t}
          </p>
        ))}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssessmentStepEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
}: AssessmentStepEditorProps) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AssessmentItem[]>([])
  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemsRef = useRef<AssessmentItem[]>([])
  itemsRef.current = items

  const copy = STEP_COPY[stepId] ?? STEP_COPY['13']

  // ── Load existing output ────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: rows } = await supabase
          .from('step_output')
          .select('id, content, version')
          .eq('workspace_id', workspaceId)
          .eq('step_id', stepId)
          .order('version', { ascending: false })
          .limit(1)

        if (cancelled) return

        if (rows && rows.length > 0) {
          const row = rows[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          const rawItems = c && Array.isArray(c['items']) ? (c['items'] as unknown[]) : []
          const loaded: AssessmentItem[] = []
          for (const it of rawItems) {
            const norm = normalizeItem(it)
            if (norm) loaded.push(norm)
          }
          setItems(loaded)
        }
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [workspaceId, stepId])

  // ── Save ────────────────────────────────────────────────────────────────────

  const persistItems = useCallback(async (next: AssessmentItem[]) => {
    setSaveState('saving')
    try {
      const now = new Date().toISOString()
      const content = { items: next }
      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content, last_saved_at: now, last_updated_at: now })
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
            content,
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
  }, [outputId, outputVersion, workspaceId, stepId])

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persistItems(itemsRef.current)
    }, AUTOSAVE_MS)
  }, [persistItems])

  // ── Item mutations ──────────────────────────────────────────────────────────

  function updateRating(itemId: string, value: Exclude<RatingValue, ''>) {
    setItems(prev => prev.map(it =>
      it.id === itemId
        ? { ...it, currentState: value, gapLevel: gapLevelFromState(value) }
        : it,
    ))
    scheduleSave()
  }

  function updateNotes(itemId: string, notes: string) {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, notes } : it))
    scheduleSave()
  }

  // ── Copilot generation ─────────────────────────────────────────────────────

  async function runGenerate() {
    if (generating) return
    setGenerating(true)
    setGenError(null)

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          workspaceId,
          stepTitle,
          stepDescription: copy.headline,
          currentContent: '',
          preferredModel,
        }),
      })

      if (!res.ok || !res.body) {
        setGenError(copilotErrorMessage(res.status))
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
        setGenError(copilotErrorMessage(match ? match[1] : 0))
        return
      }

      const parsed = extractItemsFromStream(accumulated)
      if (!parsed || parsed.length === 0) {
        setGenError('Copilot did not return any items. Please try again.')
        return
      }

      const generated: AssessmentItem[] = parsed.map(p => ({
        id: makeId(),
        label: p.label,
        description: p.description,
        currentState: '',
        gapLevel: 'none',
        notes: '',
      }))
      setItems(generated)
      void persistItems(generated)
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      setGenError(
        msg.includes('timeout') || msg.includes('aborted')
          ? 'The request took too long to complete. Try again.'
          : copilotErrorMessage(0),
      )
    } finally {
      setGenerating(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

      {/* ── Left: assessment table ───────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <button
            onClick={runGenerate}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 16px', minHeight: '44px',
              backgroundColor: generating ? 'rgba(232,82,10,0.4)' : '#E8520A',
              color: '#FFFFFF',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {generating ? 'Generating…' : 'Generate with Copilot'}
          </button>
          <SaveIndicator state={saveState} />
        </div>

        {/* Generation error */}
        {genError && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '8px',
            color: '#FCA5A5',
            fontSize: '13px',
            lineHeight: '1.5',
          }}>
            {genError}
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && !generating && (
          <div style={{
            ...PANEL_CARD,
            textAlign: 'center',
            padding: '40px 24px',
          }}>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: '0 0 8px', lineHeight: '1.6' }}>
              No items yet.
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: '1.6' }}>
              Click <strong style={{ color: '#E8520A' }}>Generate with Copilot</strong> to draft your {copy.headline.toLowerCase()}.
            </p>
          </div>
        )}

        {/* Column header */}
        {items.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
            padding: '0 4px',
          }}>
            <p style={{
              fontSize: '11px', fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              margin: 0,
            }}>
              What You Need
            </p>
            <p style={{
              fontSize: '11px', fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              margin: 0,
            }}>
              Your Current State
            </p>
          </div>
        )}

        {/* Item cards */}
        {items.map((item, idx) => (
          <div key={item.id} style={PANEL_CARD}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

              {/* LEFT — what you need */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '28px', height: '28px', borderRadius: '50%',
                  backgroundColor: '#E8520A', color: '#FFFFFF',
                  fontSize: '13px', fontWeight: 700, flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: '15px', fontWeight: 700,
                    color: '#FFFFFF', margin: '0 0 6px',
                    lineHeight: '1.4',
                  }}>
                    {item.label || 'Untitled item'}
                  </p>
                  <p style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.55)',
                    margin: 0,
                    lineHeight: '1.6',
                  }}>
                    {item.description}
                  </p>
                </div>
              </div>

              {/* RIGHT — current state */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {RATINGS.map(r => {
                    const active = item.currentState === r.value
                    return (
                      <button
                        key={r.value}
                        onClick={() => updateRating(item.id, r.value)}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          padding: '0 10px',
                          backgroundColor: active ? r.color : 'rgba(255,255,255,0.06)',
                          color: active ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
                          border: `1px solid ${active ? r.color : 'rgba(255,255,255,0.15)'}`,
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background-color 0.15s, color 0.15s',
                        }}
                      >
                        {r.label}
                      </button>
                    )
                  })}
                </div>
                {item.currentState && (
                  <GapBadge level={item.gapLevel} />
                )}
              </div>
            </div>

            {/* Notes textarea */}
            <div style={{ marginTop: '16px' }}>
              <textarea
                value={item.notes}
                onChange={e => updateNotes(item.id, e.target.value)}
                placeholder="Add context or notes..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #9CA3AF',
                  borderRadius: '8px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#0D0D0D',
                  backgroundColor: '#FFFFFF',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>

            {/* Critical gap alert */}
            {item.gapLevel === 'critical' && (
              <div style={{
                marginTop: '14px',
                padding: '12px 14px',
                backgroundColor: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}>
                <AlertTriangle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} />
                <p style={{
                  fontSize: '13px',
                  color: '#FCA5A5',
                  margin: 0,
                  lineHeight: '1.55',
                }}>
                  {copy.gapAlert}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Right: tips panel ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <TipsCard stepId={stepId} />
      </div>
    </div>
  )
}
