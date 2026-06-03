'use client'

import { useState, useEffect } from 'react'
import { Loader2, Wand2, RotateCcw, Send, CheckCircle2, Lock, AlertTriangle, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StageAnalysis {
  stage_number: number
  stage_name: string
  summary: string
  key_signals?: string[]
  gaps?: string[]
  confidence?: number
  confidence_score?: number
  recommended_actions?: string[]
  response_count?: number
}

interface DcpAnalysisRow {
  id: string
  stage_summaries: StageAnalysis[] | null
  overall_confidence: number | null
  status: string
  analysis_version: number
  submitted_at: string | null
  approved_at: string | null
}

interface AnalyzeApiResponse {
  stages: StageAnalysis[]
  overall_confidence: number
  dcp_map_id: string
  analysis_version: number
}

// ── Stage metadata ────────────────────────────────────────────────────────────

const STAGE_META = [
  { stage_number: 1, stage_name: 'Need Recognition',          populates: 'Step 4 — The Problem',                  description: 'What pain first prompted buyers to seek a solution.' },
  { stage_number: 2, stage_name: 'Trigger / Catalyst',        populates: 'Step 5 — The Cause',                    description: 'Events or mandates that forced buyers into action.' },
  { stage_number: 3, stage_name: 'Search / Awareness',        populates: 'Step 9 — The Search',                   description: 'How buyers searched and which channels influenced them.' },
  { stage_number: 4, stage_name: 'Evaluation / Consideration',populates: 'Step 8 — The Solution',                 description: 'Criteria used to evaluate and compare vendors.' },
  { stage_number: 5, stage_name: 'Select-Set / Shortlist',    populates: 'Step 17 — Target Competition',          description: 'What qualified vendors for serious consideration.' },
  { stage_number: 6, stage_name: 'Decision / Purchase',       populates: 'Step 18 — Competitive Differentiators', description: 'Who decided, what evidence tipped the choice, and why.' },
  { stage_number: 7, stage_name: 'Confirmation / Validation', populates: 'Step 7 — The Realization',              description: 'Post-purchase validation signals, doubts, and friction.' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function stageConfidence(s: StageAnalysis): number {
  return s.confidence ?? s.confidence_score ?? 0
}

function confColor(score: number): string {
  if (score >= 70) return '#16A34A'
  if (score >= 40) return '#D97706'
  return '#DC2626'
}

function confBg(score: number): string {
  if (score >= 70) return '#DCFCE7'
  if (score >= 40) return '#FEF3C7'
  return '#FEE2E2'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const label = score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 9px', borderRadius: '999px',
      backgroundColor: confBg(score), color: confColor(score),
      fontSize: '11px', fontWeight: 700,
    }}>
      {label} · {score}/100
    </span>
  )
}

function ConfidenceBar({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(100, score)}%`, height: '100%',
          backgroundColor: confColor(score), borderRadius: '3px',
          transition: 'width 0.4s ease',
        }} />
      </div>
      <ConfidenceBadge score={score} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DcpMapPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [responseCount, setResponseCount] = useState(0)
  const [realResponseCount, setRealResponseCount] = useState(0)
  const [simulatedResponseCount, setSimulatedResponseCount] = useState(0)
  const [dcpRow, setDcpRow] = useState<DcpAnalysisRow | null>(null)
  const [stages, setStages] = useState<StageAnalysis[]>([])
  const [openStages, setOpenStages] = useState<Set<number>>(new Set())
  const [editSummary, setEditSummary] = useState<Map<number, string>>(new Map())
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [loading, setLoading] = useState(true)

  // ── Load ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users').select('org_id, role').eq('id', user.id).single()
        if (!userRow) return

        const r = userRow as Record<string, unknown>
        const oid = String(r['org_id'] ?? '')
        setOrgId(oid)
        setUserRole(String(r['role'] ?? ''))

        const [responsesRes, simulatedRes, realNonNullRes, realNullRes, dcpRes, orgRes] = await Promise.all([
          supabase.from('survey_link_responses').select('id', { count: 'exact', head: true }).eq('org_id', oid),
          supabase.from('survey_link_responses').select('id', { count: 'exact', head: true }).eq('org_id', oid).eq('source', 'simulated'),
          supabase.from('survey_link_responses').select('id', { count: 'exact', head: true }).eq('org_id', oid).in('source', ['link', 'manual', 'csv']),
          supabase.from('survey_link_responses').select('id', { count: 'exact', head: true }).eq('org_id', oid).is('source', null),
          supabase.from('dcp_analysis').select('*').eq('org_id', oid).maybeSingle(),
          supabase.from('organizations').select('name').eq('id', oid).single(),
        ])

        setResponseCount(responsesRes.count ?? 0)
        setSimulatedResponseCount(simulatedRes.count ?? 0)
        setRealResponseCount((realNonNullRes.count ?? 0) + (realNullRes.count ?? 0))
        if (orgRes.data) setOrgName(String((orgRes.data as Record<string, unknown>)['name'] ?? ''))

        const raw = dcpRes.data as Record<string, unknown> | null
        if (raw) {
          const row: DcpAnalysisRow = {
            id: String(raw['id'] ?? ''),
            stage_summaries: (raw['stage_summaries'] as StageAnalysis[] | null),
            overall_confidence: raw['overall_confidence'] != null ? Number(raw['overall_confidence']) : null,
            status: String(raw['status'] ?? 'draft'),
            analysis_version: Number(raw['analysis_version'] ?? 1),
            submitted_at: raw['submitted_at'] as string | null,
            approved_at: raw['approved_at'] as string | null,
          }
          setDcpRow(row)
          if (row.stage_summaries) {
            setStages(row.stage_summaries)
            setOpenStages(new Set(row.stage_summaries.map(s => s.stage_number)))
          }
        }
      } catch { /* non-fatal */ }
      finally { setLoading(false) }
    })()
  }, [])

  // ── Toggle accordion ──────────────────────────────────────────────────────────

  function toggleStage(n: number) {
    setOpenStages(prev => {
      const next = new Set(prev)
      if (next.has(n)) { next.delete(n) } else { next.add(n) }
      return next
    })
  }

  // ── Analyze ───────────────────────────────────────────────────────────────────

  async function analyze() {
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await fetch('/api/intelligence/analyze-dcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      const data = await res.json() as AnalyzeApiResponse
      setStages(data.stages)
      setOpenStages(new Set(data.stages.map(s => s.stage_number)))
      setEditSummary(new Map())
      setDcpRow(prev => ({
        id: data.dcp_map_id,
        stage_summaries: data.stages,
        overall_confidence: data.overall_confidence,
        status: 'draft',
        analysis_version: data.analysis_version,
        submitted_at: prev?.submitted_at ?? null,
        approved_at: prev?.approved_at ?? null,
      }))
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Save edited summary ───────────────────────────────────────────────────────

  async function saveSummaryEdit(stageNumber: number) {
    if (!dcpRow?.id) return
    const text = editSummary.get(stageNumber)
    if (text === undefined) return
    const updated = stages.map(s => s.stage_number === stageNumber ? { ...s, summary: text } : s)
    try {
      await supabase.from('dcp_analysis')
        .update({ stage_summaries: updated, updated_at: new Date().toISOString() })
        .eq('id', dcpRow.id)
      setStages(updated)
      setEditSummary(prev => { const n = new Map(prev); n.delete(stageNumber); return n })
    } catch { /* non-fatal */ }
  }

  // ── Submit for approval ───────────────────────────────────────────────────────

  async function submitForApproval() {
    if (!dcpRow?.id) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('dcp_analysis')
        .update({ status: 'pending_approval', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', dcpRow.id)
      if (error) throw error
      setDcpRow(prev => prev ? { ...prev, status: 'pending_approval' } : prev)
    } catch { /* non-fatal */ }
    finally { setSubmitting(false) }
  }

  // ── Approve ───────────────────────────────────────────────────────────────────

  async function approve() {
    if (!dcpRow?.id) return
    setApproving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('dcp_analysis')
        .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.id ?? null, updated_at: new Date().toISOString() })
        .eq('id', dcpRow.id)
      if (error) throw error
      setDcpRow(prev => prev ? { ...prev, status: 'approved' } : prev)
    } catch { /* non-fatal */ }
    finally { setApproving(false) }
  }

  // ── PDF Download ──────────────────────────────────────────────────────────────

  async function downloadPdf() {
    if (downloading || stages.length === 0) return
    setDownloading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const company = orgName || 'Your Company'
      const NAVY   = '#0A1628'
      const ORANGE = '#E8520A'
      const BLUE   = '#0EA5E9'
      const GREY   = '#6B7280'
      const BLACK  = '#0D0D0D'
      const AMBER  = '#D97706'
      const GREEN  = '#16A34A'

      const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 50
      const contentW = pageW - margin * 2

      function hexToRgb(hex: string): [number, number, number] {
        return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
      }
      function setFill(hex: string) { doc.setFillColor(...hexToRgb(hex)) }
      function setStroke(hex: string) { doc.setDrawColor(...hexToRgb(hex)) }
      function setTextColor(hex: string) { doc.setTextColor(...hexToRgb(hex)) }

      function wrappedText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
        const lines = doc.splitTextToSize(text, maxWidth) as string[]
        for (const line of lines) {
          if (y > pageH - margin - 20) { doc.addPage(); y = margin + 20 }
          doc.text(line, x, y)
          y += lineHeight
        }
        return y
      }

      function checkPage(y: number, needed = 60): number {
        if (y + needed > pageH - margin) { doc.addPage(); return margin + 20 }
        return y
      }

      let y = margin

      // ── Cover ─────────────────────────────────────────────────────────────────

      setFill(ORANGE)
      doc.rect(0, 0, pageW, 5, 'F')

      y = 80
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      setTextColor(ORANGE)
      doc.text('ASSEMBLY AI', pageW / 2, y, { align: 'center', charSpace: 2 })
      y += 32

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(26)
      setTextColor(NAVY)
      doc.text('Decision Clarity Profile', pageW / 2, y, { align: 'center' })
      y += 34

      setStroke(ORANGE)
      doc.setLineWidth(1.5)
      doc.line(margin + 60, y, pageW - margin - 60, y)
      y += 28

      const metaRows: [string, string][] = [
        ['Company:', company],
        ['Date:', today],
        ['Overall Confidence:', `${dcpRow?.overall_confidence ?? 0}/100`],
        ['Status:', dcpRow?.status ?? 'draft'],
        ['Version:', `v${dcpRow?.analysis_version ?? 1}`],
      ]
      const labelX = pageW / 2 - 80
      const valueX = pageW / 2 + 14
      doc.setFontSize(11)
      for (const [label, value] of metaRows) {
        doc.setFont('helvetica', 'bold')
        setTextColor(GREY)
        doc.text(label, labelX + 78, y, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        setTextColor(BLACK)
        doc.text(value, valueX, y)
        y += 22
      }

      // ── Stage sections ────────────────────────────────────────────────────────

      for (const stage of stages) {
        doc.addPage()
        y = margin

        // Stage header band
        setFill(NAVY)
        doc.rect(0, 0, pageW, 44, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        setTextColor('#FFFFFF')
        doc.text(`Stage ${stage.stage_number}: ${stage.stage_name}`, margin, 28)

        const conf = stageConfidence(stage)
        const confLabel = conf >= 70 ? 'High' : conf >= 40 ? 'Moderate' : 'Low'
        const confColorHex = conf >= 70 ? GREEN : conf >= 40 ? AMBER : '#DC2626'
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        setTextColor(confColorHex)
        doc.text(`${confLabel} Confidence · ${conf}/100`, pageW - margin, 28, { align: 'right' })

        if (stage.response_count !== undefined) {
          setTextColor('#9CA3AF')
          doc.setFontSize(9)
          doc.text(`${stage.response_count} response${stage.response_count !== 1 ? 's' : ''}`, margin, 40)
        }

        y = 70

        // Summary
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        setTextColor(NAVY)
        doc.text('Summary', margin, y)
        y += 14
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        setTextColor(BLACK)
        y = wrappedText(stage.summary, margin, y, contentW, 14)
        y += 10

        // Key Signals
        if (stage.key_signals && stage.key_signals.length > 0) {
          y = checkPage(y, 40)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          setTextColor(BLUE)
          doc.text('Key Signals', margin, y)
          y += 14
          doc.setFont('helvetica', 'normal')
          setTextColor(BLACK)
          for (const signal of stage.key_signals) {
            y = checkPage(y, 20)
            y = wrappedText(`• ${signal}`, margin + 8, y, contentW - 8, 14)
          }
          y += 8
        }

        // Gaps Identified
        if (stage.gaps && stage.gaps.length > 0) {
          y = checkPage(y, 40)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          setTextColor(AMBER)
          doc.text('Gaps Identified', margin, y)
          y += 14
          doc.setFont('helvetica', 'normal')
          setTextColor(BLACK)
          for (const gap of stage.gaps) {
            y = checkPage(y, 20)
            y = wrappedText(`• ${gap}`, margin + 8, y, contentW - 8, 14)
          }
          y += 8
        }

        // Recommended Actions
        if (stage.recommended_actions && stage.recommended_actions.length > 0) {
          y = checkPage(y, 40)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          setTextColor(ORANGE)
          doc.text('Recommended Actions', margin, y)
          y += 14
          doc.setFont('helvetica', 'normal')
          setTextColor(BLACK)
          for (const action of stage.recommended_actions) {
            y = checkPage(y, 20)
            y = wrappedText(`• ${action}`, margin + 8, y, contentW - 8, 14)
          }
        }
      }

      // Add footer to every page
      const totalPages = (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        setFill(NAVY)
        doc.rect(0, pageH - 24, pageW, 24, 'F')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        setTextColor(GREY)
        doc.text(`Assembly AI Confidential — ${company}`, pageW / 2, pageH - 8, { align: 'center' })
      }

      const slug = company.toLowerCase().replace(/\s+/g, '-')
      doc.save(`${slug}-decision-clarity-profile.pdf`)
    } catch (err) {
      console.error('[downloadPdf]', err)
    } finally {
      setDownloading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  const isApprover = userRole === 'org_admin' || userRole === 'super_admin'
  const overallConf = dcpRow?.overall_confidence ?? null
  const mapStatus = dcpRow?.status ?? null
  const canSubmit = !!dcpRow && (overallConf ?? 0) > 40 && mapStatus === 'draft'

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Decision Clarity Profile</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
              Buyer intelligence analyzed across all 7 stages of the Decision Clarity Process.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {stages.length > 0 && (
              <button
                onClick={() => void downloadPdf()}
                disabled={downloading}
                style={{
                  minHeight: '44px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px',
                  backgroundColor: downloading ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
                  color: downloading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                  cursor: downloading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600,
                }}
              >
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {downloading ? 'Generating…' : 'Download PDF'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div style={{ padding: '24px 32px', maxWidth: '920px' }}>

        {/* ── Generate button (no analysis yet) ── */}
        {!dcpRow && (
          <button
            onClick={() => void analyze()}
            disabled={analyzing || responseCount === 0}
            title={responseCount === 0 ? 'Import survey responses first' : ''}
            style={{
              width: '100%', minHeight: '56px', marginBottom: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              backgroundColor: (analyzing || responseCount === 0) ? 'rgba(255,255,255,0.08)' : '#E8520A',
              color: (analyzing || responseCount === 0) ? 'rgba(255,255,255,0.35)' : '#FFFFFF',
              border: 'none', borderRadius: '10px',
              cursor: (analyzing || responseCount === 0) ? 'not-allowed' : 'pointer',
              fontSize: '16px', fontWeight: 700,
            }}
          >
            {analyzing
              ? <><Loader2 size={18} className="animate-spin" /> Analyzing…</>
              : <><Wand2 size={18} /> Generate Decision Clarity Profile</>
            }
          </button>
        )}

        {/* ── No responses yet ── */}
        {responseCount === 0 && !dcpRow && (
          <div style={{
            backgroundColor: '#0F2140', borderRadius: '10px', padding: '20px 24px',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px',
          }}>
            <AlertTriangle size={20} style={{ color: '#D97706', flexShrink: 0 }} />
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              No survey responses yet.{' '}
              <a href="/dashboard/intelligence/responses" style={{ color: '#E8520A', fontWeight: 600 }}>Collect responses</a>
              {' '}before running analysis.
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {analyzeError && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: '#FCA5A5', margin: 0 }}>{analyzeError}</p>
          </div>
        )}

        {/* ── Overall confidence ── */}
        {overallConf !== null && (
          <div style={{
            backgroundColor: '#0F2140', borderRadius: '10px', padding: '16px 20px',
            border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>Overall Confidence</p>
              {dcpRow?.analysis_version && dcpRow.analysis_version > 1 && (
                <span style={{
                  fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                  backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '999px',
                }}>
                  v{dcpRow.analysis_version}
                </span>
              )}
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 0 auto' }}>
                {responseCount} response{responseCount !== 1 ? 's' : ''} analyzed
              </p>
            </div>
            <ConfidenceBar score={overallConf} />
          </div>
        )}

        {/* ── Response source breakdown ── */}
        {overallConf !== null && (realResponseCount > 0 || simulatedResponseCount > 0) && (
          <div style={{
            backgroundColor: realResponseCount === 0 ? 'rgba(217,119,6,0.12)' : '#0F2140',
            borderLeft: `3px solid ${realResponseCount === 0 ? '#D97706' : '#0EA5E9'}`,
            borderRadius: '6px', padding: '10px 14px', marginBottom: '20px',
          }}>
            <p style={{
              fontSize: '12px',
              color: realResponseCount === 0 ? '#FDE68A' : 'rgba(255,255,255,0.7)',
              margin: 0, lineHeight: 1.5,
            }}>
              {realResponseCount === 0
                ? 'Analysis based on simulated responses only — collect real buyer responses for higher confidence'
                : simulatedResponseCount === 0
                  ? `Analysis based on ${realResponseCount} real response${realResponseCount !== 1 ? 's' : ''}`
                  : `Analysis based on ${realResponseCount} real response${realResponseCount !== 1 ? 's' : ''} and ${simulatedResponseCount} simulated response${simulatedResponseCount !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        )}

        {/* ── Regenerate button (analysis already exists) ── */}
        {dcpRow && (
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={() => void analyze()}
              disabled={analyzing || responseCount === 0}
              title={responseCount === 0 ? 'Import survey responses first' : ''}
              style={{
                minHeight: '44px', padding: '0 18px',
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: (analyzing || responseCount === 0) ? 'rgba(255,255,255,0.08)' : '#0A1628',
                color: (analyzing || responseCount === 0) ? 'rgba(255,255,255,0.35)' : '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px',
                cursor: (analyzing || responseCount === 0) ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 600,
              }}
            >
              {analyzing
                ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</>
                : <><RotateCcw size={14} /> Regenerate</>
              }
            </button>
          </div>
        )}

        {/* ── Stage cards ── */}
        {stages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {STAGE_META.map(({ stage_number, stage_name, populates, description }) => {
              const stage = stages.find(s => s.stage_number === stage_number)
              if (!stage) return null

              const conf = stageConfidence(stage)
              const isOpen = openStages.has(stage_number)
              const editText = editSummary.get(stage_number)
              const hasGaps = Array.isArray(stage.gaps) && stage.gaps.length > 0
              const hasSignals = Array.isArray(stage.key_signals) && stage.key_signals.length > 0
              const hasActions = Array.isArray(stage.recommended_actions) && stage.recommended_actions.length > 0

              return (
                <div key={stage_number} style={{
                  backgroundColor: '#0F2140', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
                }}>
                  {/* Card header */}
                  <button
                    onClick={() => toggleStage(stage_number)}
                    style={{
                      width: '100%', minHeight: '60px', padding: '0 20px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {isOpen
                      ? <ChevronDown size={16} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                      : <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                    }

                    <span style={{
                      width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                      backgroundColor: '#E8520A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700, color: '#FFFFFF',
                    }}>
                      {stage_number}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{stage_name}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {stage.response_count !== undefined && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                          backgroundColor: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '999px',
                        }}>
                          {stage.response_count} resp
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: '#0EA5E9', fontWeight: 600 }}>{populates}</span>
                      <ConfidenceBadge score={conf} />
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px' }}>
                      {/* Confidence bar */}
                      <div style={{ marginBottom: '16px' }}>
                        <ConfidenceBar score={conf} />
                      </div>

                      {/* Summary (editable) */}
                      <div style={{ marginBottom: hasSignals || hasGaps || hasActions ? '16px' : 0 }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
                          Summary
                        </p>
                        <textarea
                          value={editText ?? stage.summary}
                          onChange={e => setEditSummary(prev => new Map(prev).set(stage_number, e.target.value))}
                          onBlur={() => { if (editText !== undefined) void saveSummaryEdit(stage_number) }}
                          rows={3}
                          style={{
                            width: '100%', padding: '10px 12px',
                            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                            fontSize: '13px', lineHeight: '1.65', color: '#FFFFFF',
                            backgroundColor: '#1A3050',
                            resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Key Signals */}
                      {hasSignals && (
                        <div style={{ marginBottom: hasGaps || hasActions ? '16px' : 0 }}>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                            Key Signals
                          </p>
                          <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
                            {(stage.key_signals ?? []).map((signal, i) => (
                              <li key={i} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '4px' }}>
                                {signal}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Gaps Identified */}
                      {hasGaps && (
                        <div style={{ marginBottom: hasActions ? '16px' : 0 }}>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                            Gaps Identified
                          </p>
                          <div style={{
                            backgroundColor: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.25)',
                            borderRadius: '8px', padding: '10px 14px',
                          }}>
                            <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                              {(stage.gaps ?? []).map((gap, i) => (
                                <li key={i} style={{ fontSize: '13px', color: '#FDE68A', lineHeight: '1.6', marginBottom: '4px' }}>
                                  {gap}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Recommended Actions */}
                      {hasActions && (
                        <div>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                            Recommended Actions
                          </p>
                          <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
                            {(stage.recommended_actions ?? []).map((action, i) => (
                              <li key={i} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '4px' }}>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Gate 1 panel ── */}
        <div style={{
          backgroundColor: '#0F2140', borderRadius: '12px', padding: '24px',
          border: mapStatus === 'approved' ? '2px solid #16A34A' : '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            {mapStatus === 'approved'
              ? <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
              : <Lock size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
            }
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>Gate 1 — Decision Clarity Profile Approval</p>
          </div>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
            Gate 1 approval by an Admin unlocks Phase 2 (Steps 4–38). Submit when your DCP accurately reflects your buyer research.
            {!dcpRow && ' Run analysis first.'}
            {dcpRow && (overallConf ?? 0) <= 40 && mapStatus === 'draft' && ' Overall confidence must be above 40 to submit.'}
          </p>

          {mapStatus === 'approved' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#16A34A', margin: 0 }}>Approved — Phase 2 is unlocked</p>
            </div>
          )}

          {mapStatus === 'pending_approval' && !isApprover && (
            <div style={{ padding: '12px 16px', backgroundColor: 'rgba(217,119,6,0.15)', borderRadius: '8px' }}>
              <p style={{ fontSize: '13px', color: '#FDE68A', margin: 0, fontWeight: 600 }}>
                Pending approval — waiting for an Admin to review.
              </p>
            </div>
          )}

          {mapStatus === 'pending_approval' && isApprover && (
            <button
              onClick={() => void approve()}
              disabled={approving}
              style={{
                minHeight: '44px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: approving ? 'rgba(255,255,255,0.1)' : '#16A34A',
                color: approving ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                border: 'none', borderRadius: '8px', cursor: approving ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 600,
              }}
            >
              {approving && <Loader2 size={14} className="animate-spin" />}
              <CheckCircle2 size={16} />
              Approve Gate 1
            </button>
          )}

          {(mapStatus === 'draft' || mapStatus === null) && (
            <button
              onClick={() => void submitForApproval()}
              disabled={submitting || !canSubmit}
              style={{
                minHeight: '44px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: (submitting || !canSubmit) ? 'rgba(255,255,255,0.1)' : '#E8520A',
                color: (submitting || !canSubmit) ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                border: 'none', borderRadius: '8px',
                cursor: (submitting || !canSubmit) ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 600,
              }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <Send size={16} />
              Submit for Approval
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
