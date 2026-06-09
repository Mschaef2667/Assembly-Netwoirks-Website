'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Wand2, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type Belief = 'yes' | 'likely' | 'unlikely' | 'no' | ''

interface CvpEntry {
  index: number
  label: string
}

interface RoleEntry {
  key: string
  label: string
}

interface AcidTestContent {
  decision_makers: RoleEntry[]
  cvps: CvpEntry[]
  ratings: Record<string, Record<string, Belief>>
  evidence: Record<string, string>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface AcidTestEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 1200

const PANEL_CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '20px',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '6px',
}

const BELIEFS: ReadonlyArray<{ value: Exclude<Belief, ''>; label: string; color: string; bg: string }> = [
  { value: 'yes',      label: 'Yes',      color: '#10B981', bg: 'rgba(16,185,129,0.20)' },
  { value: 'likely',   label: 'Likely',   color: '#F59E0B', bg: 'rgba(245,158,11,0.20)' },
  { value: 'unlikely', label: 'Unlikely', color: '#E8520A', bg: 'rgba(232,82,10,0.22)' },
  { value: 'no',       label: 'No',       color: '#EF4444', bg: 'rgba(239,68,68,0.22)' },
]

const TIPS: ReadonlyArray<string> = [
  'The Acid Test separates what you believe about yourself from what buyers believe about you.',
  'If a CEO would say Unlikely — that is your most important sales problem to solve.',
  'Evidence that works: peer references from similar companies, case studies with metrics, pilot results, methodology previews.',
  'Your DCP Map Stage 4 (Evaluation) shows what proof buyers actually require — use it here.',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again."
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return 'The request took too long to complete. Try again or shorten your content.'
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

function roleKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function truncate(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : t.slice(0, max - 1) + '…'
}

function beliefMeta(b: Belief) {
  return BELIEFS.find(x => x.value === b) ?? null
}

function computeScore(ratings: Record<string, Record<string, Belief>>, cvps: CvpEntry[], dms: RoleEntry[]): { score: number; total: number; filled: number } {
  let total = 0
  let filled = 0
  let positives = 0
  for (const cvp of cvps) {
    const row = ratings[String(cvp.index)] ?? {}
    for (const dm of dms) {
      total += 1
      const v = row[dm.key]
      if (v === 'yes' || v === 'likely') { filled += 1; positives += 1 }
      else if (v === 'unlikely' || v === 'no') { filled += 1 }
    }
  }
  const score = total === 0 ? 0 : Math.round((positives / total) * 100)
  return { score, total, filled }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AcidTestEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
}: AcidTestEditorProps) {
  const [loading, setLoading] = useState(true)

  // Upstream data
  const [cvps, setCvps] = useState<CvpEntry[]>([])
  const [decisionMakers, setDecisionMakers] = useState<RoleEntry[]>([])
  const [missingUpstream, setMissingUpstream] = useState<string[]>([])

  // Step output state
  const [ratings, setRatings] = useState<Record<string, Record<string, Belief>>>({})
  const [evidence, setEvidence] = useState<Record<string, string>>({})
  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  // Copilot
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ratingsRef = useRef(ratings)
  const evidenceRef = useRef(evidence)
  ratingsRef.current = ratings
  evidenceRef.current = evidence

  // ── Load upstream + saved state ─────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: rows } = await supabase
          .from('step_output')
          .select('step_id, content, id, version')
          .eq('workspace_id', workspaceId)
          .in('step_id', ['3', '4', '11', '16'])
          .order('version', { ascending: false })

        if (cancelled) return

        const latest = new Map<string, { id: string; version: number; content: Record<string, unknown> | null }>()
        for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
          const sid = String(r['step_id'] ?? '')
          if (!sid || latest.has(sid)) continue
          latest.set(sid, {
            id: String(r['id'] ?? ''),
            version: Number(r['version'] ?? 1),
            content: (r['content'] as Record<string, unknown> | null) ?? null,
          })
        }

        // ── Decision makers from Step 3 ─────────────────────────────────────
        const dms: RoleEntry[] = []
        const seenKeys = new Set<string>()
        const s3 = latest.get('3')?.content
        const dmRaw = s3?.['decision_makers'] as Record<string, unknown> | undefined
        if (dmRaw) {
          for (const segKey of ['segment_1', 'segment_2', 'segment_3']) {
            const arr = dmRaw[segKey]
            if (!Array.isArray(arr)) continue
            for (const dm of arr as Array<Record<string, unknown>>) {
              const role = String(dm['role_category'] ?? '').trim()
              const title = String(dm['specific_title'] ?? '').trim()
              const label = title || role
              if (!label) continue
              const key = roleKey(label)
              if (seenKeys.has(key)) continue
              seenKeys.add(key)
              dms.push({ key, label })
            }
          }
        }

        // ── CVPs from Step 11, fall back to Step 4 pain-point titles ──────
        const cvpEntries: CvpEntry[] = []
        const s11 = latest.get('11')?.content
        const s4 = latest.get('4')?.content
        const s4Points = Array.isArray(s4?.['pain_points']) ? (s4!['pain_points'] as Array<Record<string, unknown>>) : []
        const s11Bpp = Array.isArray(s11?.['by_pain_point']) ? (s11!['by_pain_point'] as Array<Record<string, unknown>>) : []

        if (s11Bpp.length > 0) {
          for (const entry of s11Bpp) {
            const idx = Number(entry['index'] ?? 0)
            const content = String(entry['content'] ?? '').trim()
            if (!content) continue
            const ppTitle = s4Points.find(p => Number(p['index']) === idx)?.['title']
            const label = ppTitle && String(ppTitle).trim()
              ? `CVP ${idx} — ${String(ppTitle).trim()}`
              : `CVP ${idx}`
            cvpEntries.push({ index: idx, label })
          }
        }

        // ── Missing upstream check ──────────────────────────────────────────
        const missing: string[] = []
        if (dms.length === 0) missing.push('Step 3 (Decision Makers)')
        if (cvpEntries.length === 0) missing.push('Step 11 (CVPs)')
        setMissingUpstream(missing)

        setDecisionMakers(dms)
        setCvps(cvpEntries)

        // ── Load saved Step 16 ──────────────────────────────────────────────
        const saved = latest.get('16')
        if (saved) {
          setOutputId(saved.id)
          setOutputVersion(saved.version)
          const c = saved.content ?? {}
          const savedRatings = (c['ratings'] && typeof c['ratings'] === 'object')
            ? c['ratings'] as Record<string, Record<string, Belief>>
            : {}
          const savedEvidence = (c['evidence'] && typeof c['evidence'] === 'object')
            ? c['evidence'] as Record<string, string>
            : {}
          setRatings(savedRatings)
          setEvidence(savedEvidence)
        }
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [workspaceId])

  // ── Save ────────────────────────────────────────────────────────────────────

  const persist = useCallback(async () => {
    setSaveState('saving')
    try {
      const now = new Date().toISOString()
      const content: AcidTestContent = {
        decision_makers: decisionMakers,
        cvps,
        ratings: ratingsRef.current,
        evidence: evidenceRef.current,
      }
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
  }, [outputId, outputVersion, workspaceId, stepId, cvps, decisionMakers])

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void persist() }, AUTOSAVE_MS)
  }, [persist])

  // ── Mutations ───────────────────────────────────────────────────────────────

  function setRating(cvpIndex: number, role: string, value: Belief) {
    setRatings(prev => {
      const row = { ...(prev[String(cvpIndex)] ?? {}) }
      if (row[role] === value) {
        delete row[role]
      } else {
        row[role] = value
      }
      return { ...prev, [String(cvpIndex)]: row }
    })
    scheduleSave()
  }

  function setEvidenceText(cvpIndex: number, value: string) {
    setEvidence(prev => ({ ...prev, [String(cvpIndex)]: value }))
    scheduleSave()
  }

  // ── Copilot generate ────────────────────────────────────────────────────────

  async function runGenerate() {
    if (generating) return
    if (cvps.length === 0 || decisionMakers.length === 0) {
      setGenError('Missing upstream data — complete Steps 3 and 11 first.')
      return
    }
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
          stepDescription: 'Acid Test — Decision Maker belief in CVP delivery',
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

      const stripped = accumulated
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(stripped) as Record<string, unknown>
      } catch {
        setGenError('Copilot returned an invalid response. Please try again.')
        return
      }

      const matrix = Array.isArray(parsed['matrix']) ? parsed['matrix'] as Array<Record<string, unknown>> : []
      const evidenceGaps = Array.isArray(parsed['evidence_gaps']) ? parsed['evidence_gaps'] as string[] : []

      const nextRatings: Record<string, Record<string, Belief>> = {}
      const nextEvidence: Record<string, string> = { ...evidenceRef.current }

      for (const row of matrix) {
        const cvpIndex = Number(row['cvp_index'] ?? 0)
        if (!cvpIndex) continue
        const ratingsArr = Array.isArray(row['ratings']) ? row['ratings'] as Array<Record<string, unknown>> : []
        const rowRatings: Record<string, Belief> = {}
        for (const rt of ratingsArr) {
          const roleLabel = String(rt['role'] ?? '').trim()
          if (!roleLabel) continue
          const dm = decisionMakers.find(d => d.label === roleLabel || d.key === roleKey(roleLabel))
          if (!dm) continue
          const belief = String(rt['belief'] ?? '').toLowerCase()
          if (belief === 'yes' || belief === 'likely' || belief === 'unlikely' || belief === 'no') {
            rowRatings[dm.key] = belief
          }
        }
        nextRatings[String(cvpIndex)] = rowRatings
      }

      if (evidenceGaps.length > 0) {
        const gapsBlock = `Evidence gaps to address:\n- ${evidenceGaps.join('\n- ')}`
        for (const cvp of cvps) {
          const key = String(cvp.index)
          if (!nextEvidence[key]) nextEvidence[key] = gapsBlock
        }
      }

      setRatings(nextRatings)
      setEvidence(nextEvidence)
      ratingsRef.current = nextRatings
      evidenceRef.current = nextEvidence
      void persist()
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

  const { score, total, filled } = computeScore(ratings, cvps, decisionMakers)
  const scoreColor = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444'

  const scoreBannerColor = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444'
  const scoreBannerBg = score >= 80
    ? 'rgba(16,185,129,0.12)'
    : score >= 60
      ? 'rgba(245,158,11,0.12)'
      : 'rgba(239,68,68,0.12)'
  const scoreBannerBorder = score >= 80
    ? 'rgba(16,185,129,0.4)'
    : score >= 60
      ? 'rgba(245,158,11,0.4)'
      : 'rgba(239,68,68,0.4)'
  const scoreBannerMessage = filled === 0
    ? 'Rate each cell to see your overall Acid Test score.'
    : score >= 80
      ? 'Strong: Your decision makers are likely to believe in your delivery capability.'
      : score >= 60
        ? 'Caution: Some decision makers have doubts. Strengthen your evidence package.'
        : 'Critical: Your key decision makers are unlikely to believe you can deliver your CVPs. Review Steps 13 and 14 before proceeding.'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

      {/* ── Left column ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Header */}
        <div style={PANEL_CARD}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px' }}>
            Acid Test — Do your key decision makers believe you can deliver your CVPs?
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', margin: 0 }}>
            For each decision maker, assess whether they would believe Assembly Networks has the formulas and competencies to fulfill each CVP promise. How do you know?
          </p>
        </div>

        {/* Generate + save */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <button
            onClick={runGenerate}
            disabled={generating || cvps.length === 0 || decisionMakers.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 16px', minHeight: '44px',
              backgroundColor: (generating || cvps.length === 0 || decisionMakers.length === 0)
                ? 'rgba(232,82,10,0.4)' : '#E8520A',
              color: '#FFFFFF',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600,
              cursor: (generating || cvps.length === 0 || decisionMakers.length === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {generating ? 'Generating…' : 'Generate with Copilot'}
          </button>
          {saveState === 'saving' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
              <Loader2 size={12} className="animate-spin" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span style={{ fontSize: '12px', color: '#34D399' }}>✓ Saved</span>
          )}
          {saveState === 'error' && (
            <span style={{ fontSize: '12px', color: '#F87171' }}>Save failed</span>
          )}
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

        {/* Missing upstream */}
        {missingUpstream.length > 0 && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '8px',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
          }}>
            <AlertTriangle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '13px', color: '#92400E', margin: 0, lineHeight: '1.5' }}>
              The Acid Test needs upstream data. Complete: {missingUpstream.join(', ')}.
            </p>
          </div>
        )}

        {/* Matrix */}
        {cvps.length > 0 && decisionMakers.length > 0 && (
          <div style={{ ...PANEL_CARD, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0A1628' }}>
                    <th style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.55)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      width: '240px',
                    }}>
                      CVP
                    </th>
                    {decisionMakers.map(dm => (
                      <th key={dm.key} style={{
                        textAlign: 'left',
                        padding: '14px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.55)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        minWidth: '160px',
                      }}>
                        {dm.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cvps.map(cvp => {
                    const row = ratings[String(cvp.index)] ?? {}
                    return (
                      <tr key={cvp.index} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{
                          padding: '14px 16px',
                          fontSize: '13px',
                          color: '#FFFFFF',
                          fontWeight: 600,
                          verticalAlign: 'top',
                        }}>
                          {truncate(cvp.label, 80)}
                        </td>
                        {decisionMakers.map(dm => {
                          const current = (row[dm.key] ?? '') as Belief
                          const meta = beliefMeta(current)
                          return (
                            <td key={dm.key} style={{
                              padding: '10px 12px',
                              verticalAlign: 'top',
                              backgroundColor: meta ? meta.bg : 'transparent',
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {BELIEFS.map(b => {
                                  const active = current === b.value
                                  return (
                                    <button
                                      key={b.value}
                                      onClick={() => setRating(cvp.index, dm.key, b.value)}
                                      style={{
                                        minHeight: '28px',
                                        padding: '4px 10px',
                                        backgroundColor: active ? b.color : 'rgba(255,255,255,0.06)',
                                        color: active ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
                                        border: `1px solid ${active ? b.color : 'rgba(255,255,255,0.15)'}`,
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background-color 0.15s, color 0.15s',
                                      }}
                                    >
                                      {b.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Evidence per CVP */}
        {cvps.length > 0 && decisionMakers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={LABEL_STYLE}>Evidence</p>
            {cvps.map(cvp => (
              <div key={cvp.index} style={PANEL_CARD}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px' }}>
                  {cvp.label}
                </p>
                <p style={{ ...LABEL_STYLE, marginTop: '8px' }}>
                  How do we know? (Evidence: references, case studies, DCP research, demos)
                </p>
                <textarea
                  value={evidence[String(cvp.index)] ?? ''}
                  onChange={e => setEvidenceText(cvp.index, e.target.value)}
                  placeholder="List the proof you have: customer references, case studies with metrics, DCP Stage 4 evaluation signals, pilot results…"
                  rows={4}
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
            ))}
          </div>
        )}

        {/* Overall score banner */}
        {cvps.length > 0 && decisionMakers.length > 0 && (
          <div style={{
            padding: '16px 20px',
            backgroundColor: scoreBannerBg,
            border: `1px solid ${scoreBannerBorder}`,
            borderRadius: '10px',
            display: 'flex',
            gap: '14px',
            alignItems: 'flex-start',
          }}>
            <CheckCircle2 size={20} style={{ color: scoreBannerColor, flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                  Acid Test Score
                </span>
                <span style={{ fontSize: '20px', fontWeight: 700, color: scoreColor }}>
                  {score}%
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  ({filled} of {total} cells rated)
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: '1.55' }}>
                {scoreBannerMessage}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: tips panel ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              Tips
            </span>
          </div>
          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: '14px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {TIPS.map((t, i) => (
              <p key={i} style={{
                fontSize: '13px', color: 'rgba(255,255,255,0.65)',
                margin: 0, lineHeight: '1.55',
              }}>
                {t}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
