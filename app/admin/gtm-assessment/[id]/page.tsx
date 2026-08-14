'use client'

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Sparkles, Save, Send, Plus, X, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import {
  GTM_SCORECARD_DIMENSIONS,
  type GtmAssessmentReport,
  type GtmGap,
  type GtmRating,
  type GtmScorecardItem,
} from '@/lib/prompts/gtmAssessment'

// ── Types ───────────────────────────────────────────────────────────────────

interface Assessment {
  id: string
  status: 'new' | 'drafted' | 'sent'
  name: string | null
  email: string | null
  company: string | null
  industry: string | null
  competitors: string | null
  challenge: string | null
  gtm_summary: string | null
  created_at: string
  report_draft: GtmAssessmentReport | null
  report_final: GtmAssessmentReport | null
  sent_at: string | null
}

const RATINGS: GtmRating[] = ['Strong', 'Some gaps', 'Needs work']

// ── Styles ──────────────────────────────────────────────────────────────────

const PAGE: CSSProperties = { backgroundColor: '#0A1628', minHeight: '100vh', color: '#FFFFFF' }
const WRAP: CSSProperties = { maxWidth: '1100px', margin: '0 auto', padding: '28px 32px 80px' }
const CARD: CSSProperties = {
  backgroundColor: '#0F2140',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  padding: '20px',
  marginBottom: '18px',
}
const LABEL: CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'block',
}
const SECTION_TITLE: CSSProperties = {
  fontSize: '15px', fontWeight: 700, color: '#7DD3FC', marginBottom: '12px',
}
const inputStyle: CSSProperties = {
  width: '100%', backgroundColor: '#0A1628', border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '7px', color: '#FFFFFF', fontSize: '14px', padding: '9px 11px',
  fontFamily: 'inherit', lineHeight: 1.5,
}
const btn = (bg: string, border: string, color: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 16px',
  borderRadius: '8px', border: `1px solid ${border}`, backgroundColor: bg, color,
  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
})

// ── Small field components ──────────────────────────────────────────────────

function Text({ value, onChange, rows }: { value: string; onChange: (v: string) => void; rows?: number }) {
  if (rows && rows > 1) {
    return <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function GtmAssessmentReviewPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [report, setReport] = useState<GtmAssessmentReport | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Guard: super admin only
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }
      const { data: row } = await supabase.from('users').select('is_super_admin').eq('id', user.id).maybeSingle()
      if (!active) return
      if (!(row as { is_super_admin?: boolean } | null)?.is_super_admin) { router.replace('/dashboard'); return }
      setAuthed(true)
    })()
    return () => { active = false }
  }, [router])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/gtm-assessment/${id}`)
      const body = (await res.json()) as { assessment?: Assessment; error?: string }
      if (!res.ok || !body.assessment) throw new Error(body.error ?? 'Failed to load')
      setAssessment(body.assessment)
      setReport(body.assessment.report_final ?? body.assessment.report_draft ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { if (authed) queueMicrotask(() => { void load() }) }, [authed, load])

  async function generate() {
    if (!id) return
    setGenerating(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/admin/gtm-assessment/${id}/generate`, { method: 'POST' })
      const body = (await res.json()) as { report?: GtmAssessmentReport; error?: string }
      if (!res.ok || !body.report) throw new Error(body.error ?? 'Generation failed')
      setReport(body.report)
      setNotice('Draft generated. Review, edit, then save.')
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!id || !report) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/admin/gtm-assessment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_final: report }),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'Save failed')
      setNotice('Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Report field mutators
  const patch = (p: Partial<GtmAssessmentReport>) => setReport((r) => (r ? { ...r, ...p } : r))
  const setScore = (i: number, p: Partial<GtmScorecardItem>) =>
    setReport((r) => r ? { ...r, scorecard: r.scorecard.map((s, idx) => idx === i ? { ...s, ...p } : s) } : r)
  const setGap = (i: number, p: Partial<GtmGap>) =>
    setReport((r) => r ? { ...r, gaps: r.gaps.map((g, idx) => idx === i ? { ...g, ...p } : g) } : r)

  if (!authed || loading) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={22} />
      </div>
    )
  }

  return (
    <div style={PAGE}>
      <div style={WRAP}>
        <Link href="/admin" style={{ ...btn('transparent', 'rgba(255,255,255,0.16)', '#93C5FD'), marginBottom: '18px' }}>
          <ArrowLeft size={14} /> Back to admin
        </Link>

        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0 4px' }}>GTM Gap Report</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', marginBottom: '20px' }}>
          {assessment?.company ?? '—'} · status: {assessment?.status ?? '—'}
        </p>

        {error && (
          <div style={{ ...CARD, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}>
            {error}
          </div>
        )}
        {notice && (
          <div style={{ ...CARD, borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.1)', color: '#86EFAC' }}>
            {notice}
          </div>
        )}

        {/* Intake */}
        <div style={CARD}>
          <div style={SECTION_TITLE}>The submission</div>
          <Row k="Name" v={assessment?.name} />
          <Row k="Email" v={assessment?.email} />
          <Row k="Company" v={assessment?.company} />
          <Row k="Industry" v={assessment?.industry} />
          <Row k="Competitors" v={assessment?.competitors} />
          <Row k="Selected challenge" v={assessment?.challenge} />
          <div style={{ marginTop: '10px' }}>
            <span style={LABEL}>GTM strategy summary</span>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#E5EAF2', whiteSpace: 'pre-wrap', margin: 0 }}>
              {assessment?.gtm_summary ?? '—'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <button onClick={generate} disabled={generating} style={btn('rgba(14,165,233,0.16)', 'rgba(14,165,233,0.5)', '#7DD3FC')}>
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {report ? 'Regenerate draft' : 'Generate draft'}
          </button>
          <button onClick={save} disabled={saving || !report} style={{ ...btn('rgba(34,197,94,0.16)', 'rgba(34,197,94,0.5)', '#86EFAC'), opacity: report ? 1 : 0.5 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save edits
          </button>
          <button disabled title="Delivery is the next build step" style={{ ...btn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.4)'), cursor: 'not-allowed' }}>
            <Send size={14} /> Send (coming next)
          </button>
        </div>

        {/* Report editor */}
        {!report && (
          <div style={{ ...CARD, color: 'rgba(255,255,255,0.55)', fontSize: '14px' }}>
            No draft yet. Click <strong style={{ color: '#7DD3FC' }}>Generate draft</strong> to create the report from the submission above.
          </div>
        )}

        {report && (
          <>
            <div style={CARD}>
              <div style={SECTION_TITLE}>Headline verdict</div>
              <Text value={report.headline_verdict ?? ''} onChange={(v) => patch({ headline_verdict: v })} rows={2} />
            </div>

            <div style={CARD}>
              <div style={SECTION_TITLE}>Snapshot</div>
              <Text value={report.snapshot ?? ''} onChange={(v) => patch({ snapshot: v })} rows={4} />
            </div>

            <div style={CARD}>
              <div style={SECTION_TITLE}>Scorecard</div>
              {(report.scorecard ?? []).map((s, i) => (
                <div key={i} style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: i < (report.scorecard.length - 1) ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    {s.dimension || GTM_SCORECARD_DIMENSIONS[i] || `Dimension ${i + 1}`}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <select value={s.rating} onChange={(e) => setScore(i, { rating: e.target.value as GtmRating })} style={{ ...inputStyle, width: '150px' }}>
                      {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <Text value={s.reason ?? ''} onChange={(v) => setScore(i, { reason: v })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={CARD}>
              <div style={SECTION_TITLE}>Gaps</div>
              {(report.gaps ?? []).map((g, i) => (
                <div key={i} style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={LABEL}>Gap {i + 1}</span>
                    <button onClick={() => patch({ gaps: report.gaps.filter((_, idx) => idx !== i) })}
                      style={{ ...btn('transparent', 'rgba(239,68,68,0.3)', '#FCA5A5'), padding: '3px 8px', fontSize: '11px' }}>
                      <X size={11} /> Remove
                    </button>
                  </div>
                  <div style={{ marginBottom: '7px' }}><Text value={g.gap ?? ''} onChange={(v) => setGap(i, { gap: v })} /></div>
                  <span style={LABEL}>Why it costs them</span>
                  <div style={{ marginBottom: '7px' }}><Text value={g.why_it_costs ?? ''} onChange={(v) => setGap(i, { why_it_costs: v })} rows={2} /></div>
                  <span style={LABEL}>Probing question</span>
                  <Text value={g.probing_question ?? ''} onChange={(v) => setGap(i, { probing_question: v })} rows={2} />
                </div>
              ))}
              <button onClick={() => patch({ gaps: [...(report.gaps ?? []), { gap: '', why_it_costs: '', probing_question: '' }] })}
                style={btn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.16)', '#93C5FD')}>
                <Plus size={13} /> Add gap
              </button>
            </div>

            <div style={CARD}>
              <div style={SECTION_TITLE}>Quick wins</div>
              {(report.quick_wins ?? []).map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Text value={w} onChange={(v) => patch({ quick_wins: report.quick_wins.map((x, idx) => idx === i ? v : x) })} rows={2} />
                  </div>
                  <button onClick={() => patch({ quick_wins: report.quick_wins.filter((_, idx) => idx !== i) })}
                    style={{ ...btn('transparent', 'rgba(239,68,68,0.3)', '#FCA5A5'), padding: '6px 8px' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button onClick={() => patch({ quick_wins: [...(report.quick_wins ?? []), ''] })}
                style={btn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.16)', '#93C5FD')}>
                <Plus size={13} /> Add quick win
              </button>
            </div>

            <div style={CARD}>
              <div style={SECTION_TITLE}>The bigger opportunity</div>
              <Text value={report.bigger_opportunity ?? ''} onChange={(v) => patch({ bigger_opportunity: v })} rows={4} />
            </div>

            <div style={CARD}>
              <div style={SECTION_TITLE}>Why Assembly AI changes the outcome</div>
              <Text value={report.why_assembly_ai ?? ''} onChange={(v) => patch({ why_assembly_ai: v })} rows={5} />
            </div>

            <div style={CARD}>
              <div style={SECTION_TITLE}>Recommended next step</div>
              <Text value={report.next_step ?? ''} onChange={(v) => patch({ next_step: v })} rows={3} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '6px', fontSize: '14px' }}>
      <span style={{ color: 'rgba(255,255,255,0.45)', minWidth: '150px' }}>{k}</span>
      <span style={{ color: '#E5EAF2' }}>{v ?? '—'}</span>
    </div>
  )
}
