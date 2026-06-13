'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2, Lightbulb, GripVertical } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

const SEGMENT_KEYS = ['segment_1', 'segment_2', 'segment_3'] as const
type SegmentKey = typeof SEGMENT_KEYS[number]

interface SegmentEntry {
  ranking: string[]
  pattern: string
}

type SegmentsState = Record<SegmentKey, SegmentEntry>

interface DecisionMakerRecord {
  role_category: string
  specific_title: string
  influence: string
  primary_concerns: string[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface DecisionProcessEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
  onContentChange?: (hasNonEmptyContent: boolean) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 1500

const FACTOR_DEFS: ReadonlyArray<{ key: string; name: string; description: string }> = [
  { key: 'relationship', name: 'Relationship', description: 'Trust and prior experience with the people involved' },
  { key: 'experience', name: 'Experience', description: 'Proven track record, case studies, and references' },
  { key: 'time', name: 'Time', description: 'Speed to value and urgency of the need' },
  { key: 'money', name: 'Money', description: 'Price, ROI, and budget fit' },
  { key: 'risk', name: 'Risk', description: 'Safety of choice, guarantees, and risk mitigation' },
  { key: 'early_adopters', name: 'Early Adopters', description: 'Innovation appetite and first-mover advantage' },
]

const DEFAULT_RANKING: string[] = ['relationship', 'experience', 'risk', 'money', 'time', 'early_adopters']

const TIPS: ReadonlyArray<string> = [
  'Rank factors by how much weight this segment actually gives them — not how you wish they would decide.',
  'Risk often ranks higher than buyers admit in surveys — check your DCP Stage 6 data.',
  'The top 2 factors should drive your closing strategy for this segment.',
]

function makeEmptyEntry(): SegmentEntry {
  return { ranking: [...DEFAULT_RANKING], pattern: '' }
}

function makeEmptyState(): SegmentsState {
  return {
    segment_1: makeEmptyEntry(),
    segment_2: makeEmptyEntry(),
    segment_3: makeEmptyEntry(),
  }
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
  margin: '0 0 4px',
}

const SECTION_DESC: React.CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.5)',
  fontStyle: 'italic',
  margin: '0 0 12px',
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

function normalizeRanking(raw: unknown): string[] {
  const valid = new Set(FACTOR_DEFS.map(f => f.key))
  const list = Array.isArray(raw) ? raw.map(v => String(v)).filter(v => valid.has(v)) : []
  const seen = new Set(list)
  for (const f of FACTOR_DEFS) {
    if (!seen.has(f.key)) {
      list.push(f.key)
      seen.add(f.key)
    }
  }
  return list.slice(0, FACTOR_DEFS.length)
}

function parseSavedContent(c: unknown): SegmentsState {
  const next = makeEmptyState()
  if (!c || typeof c !== 'object') return next
  const obj = c as Record<string, unknown>
  const segs = obj['segments']
  if (!segs || typeof segs !== 'object') return next
  const src = segs as Record<string, unknown>
  for (const key of SEGMENT_KEYS) {
    const entry = src[key]
    if (entry && typeof entry === 'object') {
      const row = entry as Record<string, unknown>
      next[key] = {
        ranking: normalizeRanking(row['ranking']),
        pattern: typeof row['pattern'] === 'string' ? row['pattern'] : '',
      }
    }
  }
  return next
}

function parseSegmentNames(content: unknown): string[] {
  if (!content || typeof content !== 'object') return []
  const c = content as Record<string, unknown>
  const segs = c['segments']
  if (!Array.isArray(segs)) return []
  return (segs as Array<Record<string, unknown>>).map(s => String(s['name'] ?? '').trim())
}

function parseDecisionMakers(content: unknown): Record<SegmentKey, DecisionMakerRecord[]> {
  const out: Record<SegmentKey, DecisionMakerRecord[]> = {
    segment_1: [], segment_2: [], segment_3: [],
  }
  if (!content || typeof content !== 'object') return out
  const c = content as Record<string, unknown>
  const dms = c['decision_makers']
  if (!dms || typeof dms !== 'object') return out
  const src = dms as Record<string, unknown>
  for (const key of SEGMENT_KEYS) {
    const arr = src[key]
    if (Array.isArray(arr)) {
      out[key] = (arr as Array<Record<string, unknown>>).map(r => ({
        role_category: String(r['role_category'] ?? ''),
        specific_title: String(r['specific_title'] ?? ''),
        influence: String(r['influence'] ?? ''),
        primary_concerns: Array.isArray(r['primary_concerns'])
          ? (r['primary_concerns'] as unknown[]).map(v => String(v))
          : [],
      }))
    }
  }
  return out
}

function formatRankingForPrompt(ranking: string[]): string {
  return ranking
    .map((key, i) => {
      const def = FACTOR_DEFS.find(f => f.key === key)
      return `${i + 1}. ${def?.name ?? key} — ${def?.description ?? ''}`
    })
    .join('\n')
}

function formatDecisionMakersForPrompt(dms: DecisionMakerRecord[]): string {
  if (dms.length === 0) return 'No decision makers defined.'
  return dms
    .filter(d => d.role_category || d.specific_title)
    .map(d => {
      const role = d.specific_title || d.role_category
      return `- ${role}${d.influence ? ` (${d.influence})` : ''}`
    })
    .join('\n')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DecisionProcessEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
  onContentChange,
}: DecisionProcessEditorProps) {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SegmentKey>('segment_1')

  const [segmentNames, setSegmentNames] = useState<string[]>(['', '', ''])
  const [decisionMakers, setDecisionMakers] = useState<Record<SegmentKey, DecisionMakerRecord[]>>({
    segment_1: [], segment_2: [], segment_3: [],
  })

  const [state, setState] = useState<SegmentsState>(makeEmptyState())

  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotError, setCopilotError] = useState<string | null>(null)

  const [draggedKey, setDraggedKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef<SegmentsState>(state)
  stateRef.current = state

  // ── Load saved content + Step 2 / Step 3 ───────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [currentRes, step2Res, step3Res] = await Promise.all([
          supabase
            .from('step_output')
            .select('id, content, version')
            .eq('workspace_id', workspaceId)
            .eq('step_id', stepId)
            .order('version', { ascending: false })
            .limit(1),
          supabase
            .from('step_output')
            .select('content')
            .eq('workspace_id', workspaceId)
            .eq('step_id', '2')
            .order('version', { ascending: false })
            .limit(1),
          supabase
            .from('step_output')
            .select('content')
            .eq('workspace_id', workspaceId)
            .eq('step_id', '3')
            .order('version', { ascending: false })
            .limit(1),
        ])
        if (cancelled) return

        if (currentRes.data && currentRes.data.length > 0) {
          const row = currentRes.data[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const parsed = parseSavedContent(row['content'])
          setState(parsed)
          stateRef.current = parsed
          // Signal saved content presence synchronously so parent's Next-button
          // gate doesn't wait for the state useEffect's first render cycle.
          if (onContentChange) {
            const hasNonEmpty = Object.values(parsed).some(
              seg => (seg.pattern ?? '').trim().length > 0,
            )
            onContentChange(hasNonEmpty)
          }
        }

        if (step2Res.data && step2Res.data.length > 0) {
          const names = parseSegmentNames((step2Res.data[0] as Record<string, unknown>)['content'])
          if (names.length > 0) {
            setSegmentNames([names[0] ?? '', names[1] ?? '', names[2] ?? ''])
          }
        }

        if (step3Res.data && step3Res.data.length > 0) {
          const dms = parseDecisionMakers((step3Res.data[0] as Record<string, unknown>)['content'])
          setDecisionMakers(dms)
        }
      } catch { /* non-fatal */ }
      finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [workspaceId, stepId])

  // Notify parent whenever any segment pattern has content so its hasContent
  // gate can re-evaluate (parent's cached rawContent does not see in-progress edits).
  useEffect(() => {
    if (!onContentChange) return
    const hasNonEmpty = Object.values(state).some(
      seg => (seg.pattern ?? '').trim().length > 0,
    )
    onContentChange(hasNonEmpty)
  }, [state, onContentChange])

  // ── Save ───────────────────────────────────────────────────────────────────

  const persist = useCallback(async (next: SegmentsState) => {
    setSaveState('saving')
    try {
      const contentPayload = { segments: next }
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
    saveTimer.current = setTimeout(() => { void persist(stateRef.current) }, AUTOSAVE_MS)
  }

  function updateEntry(key: SegmentKey, patch: Partial<SegmentEntry>) {
    setState(prev => {
      const next: SegmentsState = { ...prev, [key]: { ...prev[key], ...patch } }
      stateRef.current = next
      return next
    })
    scheduleSave()
  }

  function handlePatternBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void persist(stateRef.current)
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────

  function handleDragStart(key: string) {
    setDraggedKey(key)
  }

  function handleDragOver(e: React.DragEvent, key: string) {
    e.preventDefault()
    if (draggedKey && draggedKey !== key) setDragOverKey(key)
  }

  function handleDragLeave(key: string) {
    if (dragOverKey === key) setDragOverKey(null)
  }

  function handleDrop(e: React.DragEvent, targetKey: string) {
    e.preventDefault()
    const dragged = draggedKey
    setDraggedKey(null)
    setDragOverKey(null)
    if (!dragged || dragged === targetKey) return

    const currentRanking = stateRef.current[activeTab].ranking
    const fromIdx = currentRanking.indexOf(dragged)
    const toIdx = currentRanking.indexOf(targetKey)
    if (fromIdx === -1 || toIdx === -1) return

    const next = [...currentRanking]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, dragged)
    updateEntry(activeTab, { ranking: next })
  }

  function handleDragEnd() {
    setDraggedKey(null)
    setDragOverKey(null)
  }

  // ── Copilot ────────────────────────────────────────────────────────────────

  async function runCopilot() {
    if (copilotLoading) return
    setCopilotLoading(true)
    setCopilotError(null)

    const entry = stateRef.current[activeTab]
    const segIndex = SEGMENT_KEYS.indexOf(activeTab)
    const segName = segmentNames[segIndex] || `Segment ${segIndex + 1}`
    const rankingText = formatRankingForPrompt(entry.ranking)
    const dmText = formatDecisionMakersForPrompt(decisionMakers[activeTab])

    const extraContext = [
      `SEGMENT: ${segName}`,
      '',
      'DECISION FACTOR RANKING (most important first):',
      rankingText,
      '',
      'DECISION AUTHORITY FOR THIS SEGMENT:',
      dmText,
    ].join('\n')

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          workspaceId,
          stepTitle,
          stepDescription: 'Decision Pattern — how this segment makes the final GTM partner selection.',
          currentContent: entry.pattern,
          preferredModel,
          extraContext,
        }),
      })

      if (!res.ok) {
        setCopilotError(copilotErrorMessage(res.status))
        return
      }

      const text = await res.text()

      if (text.includes('__STREAM_ERROR__')) {
        const match = text.match(/__STREAM_ERROR__:(\w+)/)
        setCopilotError(copilotErrorMessage(match ? match[1] : 0))
        return
      }

      const cleaned = text
        .replace(/^```\w*\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      updateEntry(activeTab, { pattern: cleaned })
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

  const activeSegmentIndex = SEGMENT_KEYS.indexOf(activeTab)
  const activeEntry = state[activeTab]
  const activeDms = decisionMakers[activeTab]
  const finalApprover = activeDms.find(d => d.influence === 'Final Approver')
  const keyInfluencers = activeDms.filter(d =>
    d.influence && d.influence !== 'Final Approver' && (d.role_category || d.specific_title),
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>

      {/* ── LEFT: Tabs + sections ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Segment tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {SEGMENT_KEYS.map((key, i) => {
            const label = segmentNames[i]?.trim() || `Segment ${i + 1}`
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '0 16px', minHeight: '40px',
                  backgroundColor: isActive ? '#E8520A' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                  border: `1px solid ${isActive ? '#E8520A' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          {saveState === 'saving' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              <Loader2 size={12} className="animate-spin" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span style={{ alignSelf: 'center', fontSize: '12px', color: '#16A34A' }}>Saved</span>
          )}
          {saveState === 'error' && (
            <span style={{ alignSelf: 'center', fontSize: '12px', color: '#EF4444' }}>Save failed</span>
          )}
        </div>

        {/* Section 1 — Decision Authority */}
        <div style={PANEL_CARD}>
          <p style={SECTION_LABEL}>Decision Authority — from Step 3</p>
          <p style={SECTION_DESC}>
            Final approver and key influencers for {segmentNames[activeSegmentIndex]?.trim() || `Segment ${activeSegmentIndex + 1}`}.
          </p>

          {activeDms.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              No decision makers defined for this segment. Complete Step 3 to populate this section.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{
                backgroundColor: 'rgba(232,82,10,0.1)',
                border: '1px solid rgba(232,82,10,0.35)',
                borderRadius: '8px',
                padding: '12px 14px',
              }}>
                <p style={{
                  fontSize: '10px', fontWeight: 700,
                  color: '#E8520A', textTransform: 'uppercase',
                  letterSpacing: '0.07em', margin: '0 0 6px',
                }}>
                  Final Approver
                </p>
                {finalApprover ? (
                  <>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 2px' }}>
                      {finalApprover.specific_title || finalApprover.role_category || 'Unspecified'}
                    </p>
                    {finalApprover.role_category && finalApprover.specific_title && (
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                        {finalApprover.role_category}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                    Not specified
                  </p>
                )}
              </div>

              <div style={{
                backgroundColor: 'rgba(14,165,233,0.1)',
                border: '1px solid rgba(14,165,233,0.35)',
                borderRadius: '8px',
                padding: '12px 14px',
              }}>
                <p style={{
                  fontSize: '10px', fontWeight: 700,
                  color: '#0EA5E9', textTransform: 'uppercase',
                  letterSpacing: '0.07em', margin: '0 0 6px',
                }}>
                  Key Influencers
                </p>
                {keyInfluencers.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                    None specified
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    {keyInfluencers.map((dm, i) => (
                      <li key={i} style={{ fontSize: '13px', color: '#FFFFFF', marginBottom: '2px' }}>
                        {dm.specific_title || dm.role_category}
                        {dm.influence && (
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}> — {dm.influence}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Section 2 — Decision Factor Ranking */}
        <div style={PANEL_CARD}>
          <p style={SECTION_LABEL}>Decision Factor Ranking</p>
          <p style={SECTION_DESC}>
            Drag to reorder. Rank 1 is the most influential factor in this segment&apos;s buying decision.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeEntry.ranking.map((key, idx) => {
              const def = FACTOR_DEFS.find(f => f.key === key)
              if (!def) return null
              const isDragged = draggedKey === key
              const isOver = dragOverKey === key
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => handleDragStart(key)}
                  onDragOver={e => handleDragOver(e, key)}
                  onDragLeave={() => handleDragLeave(key)}
                  onDrop={e => handleDrop(e, key)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px',
                    backgroundColor: isOver ? 'rgba(232,82,10,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isOver ? '#E8520A' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    cursor: 'grab',
                    opacity: isDragged ? 0.4 : 1,
                    transition: 'background-color 0.15s, border-color 0.15s, opacity 0.15s',
                  }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '28px', height: '28px', flexShrink: 0,
                    backgroundColor: '#E8520A', color: '#FFFFFF',
                    borderRadius: '999px', fontSize: '13px', fontWeight: 700,
                  }}>
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 2px' }}>
                      {def.name}
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.5 }}>
                      {def.description}
                    </p>
                  </div>
                  <GripVertical size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 3 — Decision Pattern */}
        <div style={PANEL_CARD}>
          <p style={SECTION_LABEL}>Decision Pattern</p>
          <p style={SECTION_DESC}>
            How does this segment typically make their final decision?
          </p>

          <textarea
            value={activeEntry.pattern}
            onChange={e => updateEntry(activeTab, { pattern: e.target.value })}
            onBlur={handlePatternBlur}
            rows={5}
            placeholder="Describe the decision pattern, or use Generate with Copilot to draft from the ranking and DCP Stage 6…"
            style={TEXTAREA_STYLE}
          />

          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          </div>

          {copilotError && (
            <div style={{
              marginTop: '12px',
              padding: '10px 12px',
              border: '1px solid rgba(248,113,113,0.35)',
              backgroundColor: 'rgba(239,68,68,0.1)',
              borderRadius: '8px',
            }}>
              <p style={{ fontSize: '13px', color: '#FCA5A5', margin: 0 }}>{copilotError}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Tips ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={PANEL_CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Lightbulb size={15} style={{ color: '#E8520A' }} />
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
