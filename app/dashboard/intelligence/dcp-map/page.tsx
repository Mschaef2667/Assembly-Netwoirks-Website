'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Send, CheckCircle2, Lock, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StageSummary {
  stage_number: number
  stage_name: string
  summary: string
  confidence_score: number
}

interface DcpMapRow {
  id: string
  stage_summaries: StageSummary[] | null
  overall_confidence: number | null
  status: string
  analysis_version: number
  submitted_at: string | null
  approved_at: string | null
}

interface ImportBatch {
  response_count: number
}

type UserRole = string

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_META: { stage_number: number; stage_name: string; populates: string; description: string }[] = [
  { stage_number: 1, stage_name: 'Need Recognition',       populates: 'Step 4 — The Problem',              description: 'What pain or gap first prompted buyers to seek a solution.' },
  { stage_number: 2, stage_name: 'Trigger / Catalyst',     populates: 'Step 5 — The Cause',                description: 'Specific events or mandates that forced buyers into action.' },
  { stage_number: 3, stage_name: 'Search / Awareness',     populates: 'Step 9 — The Search',               description: 'How buyers searched and which channels influenced them.' },
  { stage_number: 4, stage_name: 'Evaluation / Consideration', populates: 'Step 8 — The Solution',         description: 'Criteria and process used to evaluate and compare vendors.' },
  { stage_number: 5, stage_name: 'Select-Set / Shortlist', populates: 'Step 17 — Target Competition',     description: 'What qualified vendors for serious consideration.' },
  { stage_number: 6, stage_name: 'Decision / Purchase',    populates: 'Step 18 — Competitive Differentiators', description: 'Who decided, what evidence tipped the choice, and why.' },
  { stage_number: 7, stage_name: 'Confirmation / Validation', populates: 'Step 7 — The Realization',      description: 'Post-purchase validation signals, doubts, and friction points.' },
]

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#16A34A' : score >= 50 ? '#D97706' : score >= 25 ? '#EA580C' : '#DC2626'
  const bg   = score >= 75 ? '#DCFCE7' : score >= 50 ? '#FEF3C7' : score >= 25 ? '#FFEDD5' : '#FEE2E2'
  const label = score >= 75 ? 'High' : score >= 50 ? 'Moderate' : score >= 25 ? 'Low' : 'Needs Regen'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 9px', borderRadius: '999px',
      backgroundColor: bg, color, fontSize: '11px', fontWeight: 700,
    }}>
      {label} · {score}/100
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DcpMapPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('')
  const [responseCount, setResponseCount] = useState(0)
  const [dcpMap, setDcpMap] = useState<DcpMapRow | null>(null)
  const [summaries, setSummaries] = useState<Map<number, StageSummary>>(new Map())
  const [editedSummaries, setEditedSummaries] = useState<Map<number, string>>(new Map())
  const [openStages, setOpenStages] = useState<Set<number>>(new Set())
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [loading, setLoading] = useState(true)

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
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

        const [responsesRes, dcpRes] = await Promise.all([
          supabase.from('dcp_imports').select('batches, response_count').eq('org_id', oid).order('imported_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('dcp_analysis').select('*').eq('org_id', oid).maybeSingle(),
        ])

        const rcRow = responsesRes.data as Record<string, unknown> | null
        if (rcRow) {
          const batchesData = rcRow['batches']
          if (Array.isArray(batchesData) && batchesData.length > 0) {
            const total = (batchesData as ImportBatch[]).reduce((sum, b) => sum + (b.response_count ?? 0), 0)
            setResponseCount(total)
          } else {
            setResponseCount(Number(rcRow['response_count'] ?? 0))
          }
        }

        const dcpRow = dcpRes.data as Record<string, unknown> | null
        if (dcpRow) {
          const map: DcpMapRow = {
            id: String(dcpRow['id'] ?? ''),
            stage_summaries: (dcpRow['stage_summaries'] as StageSummary[] | null),
            overall_confidence: dcpRow['overall_confidence'] != null ? Number(dcpRow['overall_confidence']) : null,
            status: String(dcpRow['status'] ?? 'draft'),
            analysis_version: Number(dcpRow['analysis_version'] ?? 1),
            submitted_at: dcpRow['submitted_at'] as string | null,
            approved_at: dcpRow['approved_at'] as string | null,
          }
          setDcpMap(map)
          if (map.stage_summaries) {
            const sm = new Map<number, StageSummary>()
            for (const s of map.stage_summaries) sm.set(s.stage_number, s)
            setSummaries(sm)
            setOpenStages(new Set(map.stage_summaries.map(s => s.stage_number)))
          }
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // ── Toggle accordion ────────────────────────────────────────────────────────

  function toggleStage(n: number) {
    setOpenStages(prev => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  // ── Analyze ─────────────────────────────────────────────────────────────────

  async function analyze() {
    if (!orgId) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await fetch('/api/intelligence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      const data = await res.json() as {
        stage_summaries: StageSummary[]
        overall_confidence: number
        dcp_map_id: string
        analysis_version: number
      }
      const sm = new Map<number, StageSummary>()
      for (const s of data.stage_summaries) sm.set(s.stage_number, s)
      setSummaries(sm)
      setOpenStages(new Set(data.stage_summaries.map(s => s.stage_number)))
      setDcpMap(prev => prev
        ? { ...prev, id: data.dcp_map_id, stage_summaries: data.stage_summaries, overall_confidence: data.overall_confidence, analysis_version: data.analysis_version, status: 'draft' }
        : { id: data.dcp_map_id, stage_summaries: data.stage_summaries, overall_confidence: data.overall_confidence, analysis_version: data.analysis_version, status: 'draft', submitted_at: null, approved_at: null }
      )
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Save edited summary ──────────────────────────────────────────────────────

  async function saveSummaryEdit(stageNumber: number) {
    if (!dcpMap?.id) return
    const text = editedSummaries.get(stageNumber)
    if (!text) return
    const updated = Array.from(summaries.values()).map(s =>
      s.stage_number === stageNumber ? { ...s, summary: text } : s
    )
    try {
      await supabase.from('dcp_analysis').update({ stage_summaries: updated, updated_at: new Date().toISOString() }).eq('id', dcpMap.id)
      setSummaries(prev => {
        const next = new Map(prev)
        const s = next.get(stageNumber)
        if (s) next.set(stageNumber, { ...s, summary: text })
        return next
      })
      setEditedSummaries(prev => { const n = new Map(prev); n.delete(stageNumber); return n })
    } catch {
      // non-fatal
    }
  }

  // ── Submit for approval ─────────────────────────────────────────────────────

  async function submitForApproval() {
    if (!dcpMap?.id || !orgId) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('dcp_analysis')
        .update({ status: 'pending_approval', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', dcpMap.id)
      if (error) throw error
      setDcpMap(prev => prev ? { ...prev, status: 'pending_approval' } : prev)
    } catch {
      // non-fatal
    } finally {
      setSubmitting(false)
    }
  }

  // ── Approve (org_admin / approver only) ────────────────────────────────────

  async function approve() {
    if (!dcpMap?.id) return
    setApproving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('dcp_analysis')
        .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.id ?? null, updated_at: new Date().toISOString() })
        .eq('id', dcpMap.id)
      if (error) throw error
      setDcpMap(prev => prev ? { ...prev, status: 'approved' } : prev)
    } catch {
      // non-fatal
    } finally {
      setApproving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  const isApprover = userRole === 'org_admin' || userRole === 'approver'
  const overallConf = dcpMap?.overall_confidence ?? null
  const mapStatus = dcpMap?.status ?? null

  return (
    <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>DCP Map</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
              Decision Criteria Profile — analyzed across 7 buying journey stages.
            </p>
          </div>
          <button
            onClick={() => void analyze()}
            disabled={analyzing || responseCount === 0}
            style={{
              minHeight: '44px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: (analyzing || responseCount === 0) ? 'rgba(255,255,255,0.1)' : '#E8520A',
              color: (analyzing || responseCount === 0) ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
              border: 'none', borderRadius: '8px', cursor: (analyzing || responseCount === 0) ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 600,
            }}
            title={responseCount === 0 ? 'Import responses first' : ''}
          >
            {analyzing
              ? <><Loader2 size={15} className="animate-spin" /> Analyzing…</>
              : <><RefreshCw size={15} /> {dcpMap ? 'Re-analyze' : 'Analyze with Copilot'}</>
            }
          </button>
        </div>
      </header>

      <div style={{ padding: '24px 32px', maxWidth: '900px' }}>

        {/* No responses yet */}
        {responseCount === 0 && !dcpMap && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '10px', padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
            display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px',
          }}>
            <AlertTriangle size={20} style={{ color: '#D97706', flexShrink: 0 }} />
            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
              No survey responses imported yet.{' '}
              <a href="/dashboard/intelligence/responses" style={{ color: '#E8520A', fontWeight: 600 }}>Import responses</a>
              {' '}before running analysis.
            </p>
          </div>
        )}

        {analyzeError && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: '#991B1B', margin: 0 }}>{analyzeError}</p>
          </div>
        )}

        {/* Overall confidence */}
        {overallConf !== null && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '10px', padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>Overall Confidence</p>
            <ConfidenceBadge score={overallConf} />
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              Based on {responseCount} response{responseCount !== 1 ? 's' : ''}
            </p>
            {dcpMap?.analysis_version && dcpMap.analysis_version > 1 && (
              <span style={{
                fontSize: '11px', fontWeight: 600, color: '#6B7280',
                backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '999px',
              }}>
                v{dcpMap.analysis_version}
              </span>
            )}
          </div>
        )}

        {/* Stage accordions */}
        {summaries.size > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {STAGE_META.map(({ stage_number, stage_name, populates, description }) => {
              const s = summaries.get(stage_number)
              if (!s) return null
              const isOpen = openStages.has(stage_number)
              const editedText = editedSummaries.get(stage_number)

              return (
                <div key={stage_number} style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                  <button
                    onClick={() => toggleStage(stage_number)}
                    style={{
                      width: '100%', minHeight: '56px', padding: '0 20px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {isOpen
                      ? <ChevronDown size={16} style={{ color: '#6B7280', flexShrink: 0 }} />
                      : <ChevronRight size={16} style={{ color: '#6B7280', flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>
                        Stage {stage_number}: {stage_name}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '10px' }}>{description}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', color: '#E8520A', fontWeight: 600 }}>{populates}</span>
                      <ConfidenceBadge score={s.confidence_score} />
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid #F3F4F6', padding: '16px 20px' }}>
                      <textarea
                        value={editedText ?? s.summary}
                        onChange={e => setEditedSummaries(prev => new Map(prev).set(stage_number, e.target.value))}
                        onBlur={() => { if (editedText !== undefined) void saveSummaryEdit(stage_number) }}
                        style={{
                          width: '100%', minHeight: '120px', padding: '12px',
                          border: '1px solid #E5E7EB', borderRadius: '8px',
                          fontSize: '13px', lineHeight: '1.65', color: '#0D0D0D',
                          resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Gate 1 panel */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: mapStatus === 'approved' ? '2px solid #16A34A' : '1px solid #E5E7EB',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            {mapStatus === 'approved'
              ? <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
              : <Lock size={20} style={{ color: '#6B7280' }} />
            }
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>Gate 1 — DCP Map Approval</p>
          </div>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
            Gate 1 approval by an Approver or Admin unlocks Phase 2 (Steps 4–38).
            Submit when your DCP Map accurately reflects your buyer research.
          </p>

          {mapStatus === 'approved' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#16A34A', margin: 0 }}>
                Approved — Phase 2 is unlocked
              </p>
            </div>
          )}

          {mapStatus === 'pending_approval' && !isApprover && (
            <div style={{
              padding: '12px 16px', backgroundColor: '#FEF3C7', borderRadius: '8px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <p style={{ fontSize: '13px', color: '#92400E', margin: 0, fontWeight: 600 }}>
                Pending approval — waiting for an Approver or Admin to review.
              </p>
            </div>
          )}

          {mapStatus === 'pending_approval' && isApprover && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => void approve()}
                disabled={approving}
                style={{
                  minHeight: '44px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px',
                  backgroundColor: approving ? '#E5E7EB' : '#16A34A',
                  color: approving ? '#9CA3AF' : '#FFFFFF',
                  border: 'none', borderRadius: '8px', cursor: approving ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 600,
                }}
              >
                {approving && <Loader2 size={14} className="animate-spin" />}
                <CheckCircle2 size={16} />
                Approve Gate 1
              </button>
            </div>
          )}

          {(mapStatus === 'draft' || mapStatus === null) && (
            <button
              onClick={() => void submitForApproval()}
              disabled={submitting || !dcpMap}
              style={{
                minHeight: '44px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: (submitting || !dcpMap) ? '#E5E7EB' : '#E8520A',
                color: (submitting || !dcpMap) ? '#9CA3AF' : '#FFFFFF',
                border: 'none', borderRadius: '8px', cursor: (submitting || !dcpMap) ? 'not-allowed' : 'pointer',
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
