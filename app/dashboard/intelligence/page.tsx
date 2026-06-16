'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ClipboardList, Upload, Map, Lightbulb, CheckCircle2, Circle, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type GateStatus = 'locked' | 'pending' | 'approved'

interface PhaseStatus {
  surveyBuilt: boolean
  surveyInProgress: boolean
  responsesImported: boolean
  dcpMapGenerated: boolean
  dcpMapInProgress: boolean
  insightsGenerated: boolean
  gate1Status: GateStatus
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

// ── Gate badge ────────────────────────────────────────────────────────────────

function GateBadge({ status }: { status: GateStatus }) {
  if (status === 'approved') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '999px',
      backgroundColor: '#DCFCE7', color: '#16A34A', fontSize: '13px', fontWeight: 700,
    }}>
      <CheckCircle2 size={14} /> Gate 1 Approved
    </span>
  )
  if (status === 'pending') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '999px',
      backgroundColor: '#FEF3C7', color: '#D97706', fontSize: '13px', fontWeight: 700,
    }}>
      <Circle size={14} /> Gate 1 Pending Approval
    </span>
  )
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '999px',
      backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 700,
    }}>
      <Lock size={14} /> Gate 1 Locked
    </span>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDot({ done, inProgress = false }: { done: boolean; inProgress?: boolean }) {
  const bg = done ? '#16A34A' : inProgress ? '#E8520A' : 'rgba(255,255,255,0.15)'
  return (
    <div style={{
      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
      backgroundColor: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {done && <CheckCircle2 size={12} color="#FFFFFF" />}
    </div>
  )
}

// ── Tile "done" rules (lenient, activity-based) ───────────────────────────────
// Each tile decides Complete / In Progress / Not started via the constants
// below. Adjust these to tighten the rules later without hunting through query
// logic. Gate 1 is a separate signal (dcp_analysis.status) and is NOT changed
// by these constants.

// Survey Builder: tile flips to Complete once a real per-audience survey row
// has meaningful question content. Both 'draft' and 'approved' rows count —
// formal approval is not required. Flip to true to require explicit approval.
const SURVEY_BUILDER_REQUIRE_APPROVAL = false

// step_ids written by the survey-builder workflow that are NOT real surveys
// (auto-wording suggestions, interview probes). Excluded from the tile check
// so they can never satisfy or override the real per-audience rows.
const SURVEY_BUILDER_SCRATCH_STEP_IDS = [
  'survey-builder-autowording',
  'survey-builder-interview-probes',
]

// Response Manager: tile flips to Complete once at least this many responses
// exist in survey_link_responses for the workspace. Raise to require a minimum
// sample size later.
const RESPONSE_MANAGER_MIN_RESPONSES = 1

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasMeaningfulSurveyContent(content: Record<string, unknown>): boolean {
  const questions = content['questions']
  if (Array.isArray(questions) && questions.length > 0) return true
  // Handle survey builder's Record<number, Question[]> stored as object
  if (questions && typeof questions === 'object' && !Array.isArray(questions)) {
    const vals = Object.values(questions as Record<string, unknown>)
    if (vals.some(v => Array.isArray(v) && (v as unknown[]).length > 0)) return true
  }
  for (let i = 1; i <= 7; i++) {
    const stage = content[`stage_${i}`]
    if (Array.isArray(stage) && stage.length > 0) return true
  }
  return false
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [status, setStatus] = useState<PhaseStatus>({
    surveyBuilt: false,
    surveyInProgress: false,
    responsesImported: false,
    dcpMapGenerated: false,
    dcpMapInProgress: false,
    insightsGenerated: false,
    gate1Status: 'locked',
  })
  const [loading, setLoading] = useState(true)
  const [hasIcp, setHasIcp] = useState<boolean | null>(null)
  const [icpSuccessBannerDismissed, setIcpSuccessBannerDismissed] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem('intelligence_icp_success_banner_dismissed') === '1') {
        setIcpSuccessBannerDismissed(true)
      }
    } catch { /* non-fatal */ }
  }, [])

  function dismissIcpSuccessBanner() {
    setIcpSuccessBannerDismissed(true)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('intelligence_icp_success_banner_dismissed', '1')
      }
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: userRow } = await supabase
          .from('users').select('org_id').eq('id', user.id).single()
        if (!userRow) return
        const orgId = (userRow as Record<string, unknown>)['org_id'] as string

        // Survey Builder: fetch every per-audience row, exclude scratch ids,
        // and DO NOT use LIMIT 1 — we must inspect all real rows to decide.
        const scratchListLiteral = `(${SURVEY_BUILDER_SCRATCH_STEP_IDS.map(s => `"${s}"`).join(',')})`

        const [surveyRes, responsesRes, dcpRes, insightsRes, icpRes] = await Promise.all([
          supabase
            .from('step_output')
            .select('id, content, status, step_id')
            .eq('workspace_id', orgId)
            .like('step_id', 'survey-builder-%')
            .not('step_id', 'in', scratchListLiteral),
          // Response Manager reads from survey_link_responses (the canonical
          // source used by Responses page, DCP Map, and analyze-dcp).
          supabase.from('survey_link_responses').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
          supabase.from('dcp_analysis').select('status').eq('org_id', orgId).maybeSingle(),
          supabase.from('step_output').select('id, content').eq('workspace_id', orgId).eq('step_id', 'insights').maybeSingle(),
          supabase.from('icp_definition').select('id').eq('org_id', orgId).limit(1),
        ])

        setHasIcp(!!(icpRes.data && icpRes.data.length > 0))

        const dcpRow = dcpRes.data as Record<string, unknown> | null
        const dcpStatus = dcpRow ? String(dcpRow['status'] ?? 'draft') : null

        // Survey Builder tile: Complete if any real per-audience row has
        // meaningful question content. In Progress only kicks in when the
        // tile is gated on formal approval (SURVEY_BUILDER_REQUIRE_APPROVAL).
        const surveyRows = (surveyRes.data ?? []) as Array<Record<string, unknown>>
        const surveyRowsWithContent = surveyRows.filter(row => {
          const c = row['content'] as Record<string, unknown> | null
          return !!c && hasMeaningfulSurveyContent(c)
        })
        const surveyHasContent = surveyRowsWithContent.length > 0
        const surveyHasApproved = surveyRowsWithContent.some(row => row['status'] === 'approved')
        const surveyBuilt = SURVEY_BUILDER_REQUIRE_APPROVAL ? surveyHasApproved : surveyHasContent
        const surveyInProgress = !surveyBuilt && surveyHasContent

        const insightsRow = insightsRes.data as Record<string, unknown> | null
        const insightsContent = insightsRow ? (insightsRow['content'] as Record<string, unknown> | null) : null
        const insightsGenerated = !!(insightsContent && typeof insightsContent === 'object' && 'categories' in insightsContent)

        setStatus({
          surveyBuilt,
          surveyInProgress,
          responsesImported: (responsesRes.count ?? 0) >= RESPONSE_MANAGER_MIN_RESPONSES,
          dcpMapGenerated: dcpStatus === 'approved',
          dcpMapInProgress: dcpStatus === 'draft' || dcpStatus === 'pending_approval',
          insightsGenerated,
          gate1Status: dcpStatus === 'approved' ? 'approved'
            : dcpStatus === 'pending_approval' ? 'pending'
            : 'locked',
        })
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const cards = [
    {
      icon: ClipboardList,
      title: 'Survey Builder',
      description: 'Generate tailored DCP questions for four buyer audiences using Copilot. Export as Google Forms-ready CSV.',
      href: '/dashboard/intelligence/survey-builder',
      done: status.surveyBuilt,
      inProgress: status.surveyInProgress,
      step: 1,
      domId: 'intelligence-survey',
      bonus: false,
    },
    {
      icon: Upload,
      title: 'Response Manager',
      description: 'Collect responses via shareable survey links, manual entry, or CSV upload. View and manage all responses before generating your DCP Map.',
      href: '/dashboard/intelligence/responses',
      done: status.responsesImported,
      inProgress: false,
      step: 2,
      domId: undefined,
      bonus: false,
    },
    {
      icon: Map,
      title: 'Decision Clarity Profile',
      description: 'Copilot analyzes responses across all 7 stages and generates your Decision Clarity Profile. Submit for Gate 1 approval to unlock Phase 2.',
      href: '/dashboard/intelligence/dcp-map',
      done: status.dcpMapGenerated,
      inProgress: status.dcpMapInProgress,
      step: 3,
      domId: 'intelligence-dcp',
      bonus: false,
    },
    {
      icon: Lightbulb,
      title: 'Insights',
      description: 'Surface patterns, gaps, and opportunities from your buyer research across 6 intelligence categories.',
      href: '/dashboard/intelligence/insights',
      done: status.insightsGenerated,
      inProgress: false,
      step: 4,
      domId: 'intelligence-insights',
      bonus: true,
    },
  ]

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Intelligence
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          Phase 1 — Decision Intelligence. Complete all three steps to unlock Phase 2.
        </p>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: '1280px' }}>

        {/* Gate 1 approved success banner — only shown when Gate 1 is approved and no ICPs yet */}
        {!loading && status.gate1Status === 'approved' && hasIcp === false && !icpSuccessBannerDismissed && (
          <div style={{
            backgroundColor: 'rgba(22,163,74,0.1)',
            border: '1px solid rgba(22,163,74,0.35)',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
            <p style={{ flex: 1, fontSize: '13px', color: '#86EFAC', lineHeight: '1.55', margin: 0 }}>
              <strong style={{ color: '#16A34A' }}>Gate 1 Approved.</strong> Your DCP Map is locked in. Next: Build your validated ICP profiles based on your buyer research.
            </p>
            <Link
              href="/dashboard/target-markets"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '36px', padding: '0 14px', borderRadius: '8px',
                backgroundColor: '#E8520A', color: '#FFFFFF',
                fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Go to ICP Development
            </Link>
            <button
              onClick={dismissIcpSuccessBanner}
              aria-label="Dismiss"
              style={{
                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px 8px',
                minHeight: '36px', minWidth: '36px',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Phase 2 reminder banner */}
        <div style={{
          borderLeft: '4px solid #E8520A',
          backgroundColor: '#0F2140',
          borderRadius: '0 8px 8px 0',
          padding: '14px 18px',
          marginBottom: '24px',
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeftColor: '#E8520A',
          borderLeftWidth: '4px',
        }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.55', margin: 0 }}>
            Complete all three steps below and submit your DCP Map for Gate 1 approval before moving to Phase 2.
          </p>
        </div>

        {/* Gate 1 status banner */}
        <div style={{ marginBottom: '28px' }}>
          {loading ? null : <GateBadge status={status.gate1Status} />}
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {cards.map(({ icon: Icon, title, description, href, done, inProgress, step, domId, bonus }) => (
            <div
              key={href}
              id={domId}
              style={CARD}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  backgroundColor: done ? 'rgba(22,163,74,0.2)' : inProgress ? 'rgba(232,82,10,0.15)' : 'rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={20} color={done ? '#16A34A' : inProgress ? '#E8520A' : '#0EA5E9'} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                      Step {step}
                    </p>
                    {bonus && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '2px 8px', borderRadius: '999px',
                        backgroundColor: 'rgba(14,165,233,0.15)', color: '#0EA5E9',
                        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        Optional
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{title}</p>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.55', margin: 0 }}>
                {description}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
                <StepDot done={done} inProgress={inProgress} />
                <span style={{ fontSize: '12px', color: done ? '#16A34A' : inProgress ? '#E8520A' : 'rgba(255,255,255,0.4)' }}>
                  {done ? 'Complete' : inProgress ? 'In Progress' : 'Not started'}
                </span>
              </div>

              <Link
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: '44px', borderRadius: '8px',
                  backgroundColor: '#E8520A', color: '#FFFFFF',
                  fontSize: '14px', fontWeight: 600, textDecoration: 'none',
                }}
              >
                {done ? 'Review' : inProgress ? 'Continue' : 'Start'}
              </Link>
            </div>
          ))}
        </div>

        {/* Phase 2 lock notice */}
        {status.gate1Status !== 'approved' && (
          <div style={{
            marginTop: '28px', padding: '16px 20px',
            backgroundColor: '#0F2140', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <Lock size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Phase 2 (C3 Processing — Steps 4–38) is locked until Gate 1 is approved by an Approver or Admin.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
