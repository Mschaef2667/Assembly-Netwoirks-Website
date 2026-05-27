'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, Lock, Clock, ChevronRight, X } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StepDef {
  id: string
  title: string
  section: string
  phase: number
}

interface StepOut {
  step_id: string
  version: number
  status: string
  original_confidence: number | null
}

interface DcpRow {
  status: string
  overall_confidence: number | null
}

interface ScoreBreakdown {
  total: number
  stepPts: number
  icpPts: number
  dcpPts: number
  qualityPts: number
}

type GateStatus = 'approved' | 'pending' | 'locked'

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  'Company Foundation',
  'Endemic Problems',
  'Company Formulas',
  'Competitive Environments',
  'Strategic Messages',
  'Strategic Plan',
] as const

const GATE_2_STEPS = ['10', '11', '12', '13', '14', '15', '16']
const GATE_3_STEPS = ['17', '18', '19', '20', '21', '22', '23', '24', '25', '26']
const GATE_4_STEPS = ['27', '28', '29', '30']

const ICP_TEXT_FIELDS = [
  'company_size_range', 'decision_making_power', 'budget_range', 'buying_motion',
  'buying_urgency_trigger', 'the_big_win', 'preferred_communication', 'buyer_values',
  'risk_sensitivities', 'tech_stack',
]
const ICP_ARR_FIELDS = [
  'job_titles', 'industry_verticals', 'primary_challenges', 'barriers_to_success',
  'success_metrics', 'buying_triggers', 'information_sources', 'purchase_criteria',
  'common_objections',
]

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  border: '1px solid rgba(255,255,255,0.1)',
  borderLeft: '3px solid #0EA5E9',
  borderRadius: '10px',
  padding: '24px',
}

const CARD_HDR: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#FFFFFF',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: '0 0 20px',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stepOrder(id: string): number { return parseFloat(id) }

function normalizeSection(s: string): string {
  return s === 'Action Plan' ? 'Strategic Plan' : s
}

function getGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}

function computeScore(
  outputs: Map<string, StepOut>,
  icpRows: Array<Record<string, unknown>>,
  dcpRow: DcpRow | null,
): ScoreBreakdown {
  const approved = Array.from(outputs.values()).filter(s => s.status === 'approved')

  // Step completion: approved / 38 * 40
  const stepPts = Math.round((approved.length / 38) * 40)

  // ICP completeness: filled fields / (19 fields × 3 ICPs) * 20
  const totalIcpFields = (ICP_TEXT_FIELDS.length + ICP_ARR_FIELDS.length) * 3
  let filled = 0
  for (const icp of icpRows) {
    for (const f of ICP_TEXT_FIELDS) {
      if (typeof icp[f] === 'string' && (icp[f] as string).trim().length > 0) filled++
    }
    for (const f of ICP_ARR_FIELDS) {
      if (Array.isArray(icp[f]) && (icp[f] as unknown[]).length > 0) filled++
    }
  }
  const icpPts = totalIcpFields > 0 ? Math.round((filled / totalIcpFields) * 20) : 0

  // DCP confidence: overall_confidence / 100 * 20
  const dcpPts = Math.round(((dcpRow?.overall_confidence ?? 0) / 100) * 20)

  // Content quality: avg original_confidence of approved steps / 100 * 20
  const withConf = approved.filter(s => s.original_confidence !== null)
  const avgConf = withConf.length > 0
    ? withConf.reduce((sum, s) => sum + (s.original_confidence ?? 0), 0) / withConf.length
    : 0
  const qualityPts = Math.round((avgConf / 100) * 20)

  return { total: Math.min(100, stepPts + icpPts + dcpPts + qualityPts), stepPts, icpPts, dcpPts, qualityPts }
}

function deriveGateStatus(approvedSet: Set<string>, stepIds: string[]): GateStatus {
  if (stepIds.every(id => approvedSet.has(id))) return 'approved'
  if (stepIds.some(id => approvedSet.has(id))) return 'pending'
  return 'locked'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" style={{ display: 'block' }}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
      <circle
        cx="64" cy="64" r={r} fill="none"
        stroke="#E8520A" strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 64 64)"
        style={{ transition: 'stroke-dashoffset 0.04s linear' }}
      />
    </svg>
  )
}

function GateRow({ n, label, status }: { n: number; label: string; status: GateStatus }) {
  const cfg = status === 'approved'
    ? { color: '#0EA5E9', text: 'Approved', Icon: ShieldCheck, bg: 'rgba(14,165,233,0.15)' }
    : status === 'pending'
    ? { color: '#D97706', text: 'Pending',  Icon: Clock,        bg: 'rgba(217,119,6,0.15)' }
    : { color: 'rgba(255,255,255,0.3)', text: 'Locked', Icon: Lock, bg: 'rgba(255,255,255,0.06)' }
  const { color, text, Icon, bg } = cfg
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
        backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} style={{ color }} />
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Gate {n}</span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: '6px' }}>{label}</span>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color }}>{text}</span>
    </div>
  )
}

function SkeletonBar({ w }: { w: number }) {
  return (
    <div style={{
      height: '12px', borderRadius: '4px', width: `${w}%`,
      backgroundColor: 'rgba(255,255,255,0.07)',
    }} />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stepDefs, setStepDefs] = useState<StepDef[]>([])
  const [latestOutputs, setLatestOutputs] = useState<Map<string, StepOut>>(new Map())
  const [depsMap, setDepsMap] = useState<Map<string, string[]>>(new Map())
  const [dcpRow, setDcpRow] = useState<DcpRow | null>(null)
  const [icpRows, setIcpRows] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scoreAnimated, setScoreAnimated] = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState(true)

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        const { data: userRow } = await supabase
          .from('users').select('org_id').eq('id', user.id).single()
        if (!userRow) throw new Error('User not found')
        const orgId = (userRow as Record<string, unknown>)['org_id'] as string

        const [defsRes, outputsRes, depsRes, dcpRes, icpRes] = await Promise.all([
          supabase.from('step_definition').select('id,title,section,phase'),
          supabase.from('step_output')
            .select('step_id,version,status,original_confidence')
            .eq('workspace_id', orgId),
          supabase.from('step_dependency').select('step_id,prerequisite_step_id'),
          supabase.from('dcp_analysis')
            .select('status,overall_confidence')
            .eq('org_id', orgId)
            .maybeSingle(),
          supabase.from('icp_definition').select('*').eq('org_id', orgId),
        ])

        // Latest version per step_id
        const outMap = new Map<string, StepOut>()
        for (const r of (outputsRes.data ?? []) as StepOut[]) {
          const ex = outMap.get(r.step_id)
          if (!ex || r.version > ex.version) outMap.set(r.step_id, r)
        }

        // Dependency map: step_id → [prerequisite_ids]
        const dm = new Map<string, string[]>()
        for (const d of (depsRes.data ?? []) as { step_id: string; prerequisite_step_id: string }[]) {
          const arr = dm.get(d.step_id) ?? []
          arr.push(d.prerequisite_step_id)
          dm.set(d.step_id, arr)
        }

        setStepDefs((defsRes.data ?? []) as StepDef[])
        setLatestOutputs(outMap)
        setDepsMap(dm)
        setDcpRow(dcpRes.data as DcpRow | null)
        setIcpRows((icpRes.data ?? []) as Array<Record<string, unknown>>)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // ── Animate score ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (loading || loadError) return
    const { total } = computeScore(latestOutputs, icpRows, dcpRow)
    if (total === 0) { setScoreAnimated(0); return }
    let current = 0
    const increment = Math.max(1, Math.ceil(total / 40))
    const id = setInterval(() => {
      current = Math.min(current + increment, total)
      setScoreAnimated(current)
      if (current >= total) clearInterval(id)
    }, 20)
    return () => clearInterval(id)
  }, [loading, loadError, latestOutputs, icpRows, dcpRow])

  // ── Phase 1 banner dismiss ────────────────────────────────────────────────────

  useEffect(() => {
    setBannerDismissed(localStorage.getItem('phase1_banner_dismissed') === 'true')
  }, [])

  function handleDismissBanner() {
    localStorage.setItem('phase1_banner_dismissed', 'true')
    setBannerDismissed(true)
  }

  // ── Shared header ────────────────────────────────────────────────────────────

  const pageHeader = (
    <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <h1 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 700, margin: 0 }}>Workspace Dashboard</h1>
    </header>
  )

  // ── Error state ──────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A1628' }}>
        {pageHeader}
        <div style={{ padding: '32px' }}>
          <div style={{ ...CARD, borderLeft: '3px solid #EF4444' }}>
            <p style={{ color: '#FCA5A5', fontSize: '14px', margin: 0 }}>
              Failed to load dashboard: {loadError}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Skeleton state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A1628' }}>
        {pageHeader}
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Widget 1 skeleton */}
          <div style={CARD}>
            {[75, 55, 65, 45, 70, 60].map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                <SkeletonBar w={20} />
                <div style={{ flex: 1, height: '6px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.07)' }} />
                <SkeletonBar w={12} />
              </div>
            ))}
          </div>
          {/* Bottom row skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: '4fr 3fr 3fr', gap: '24px' }}>
            {[5, 4, 4].map((rows, ci) => (
              <div key={ci} style={CARD}>
                {Array.from({ length: rows }, (_, i) => (
                  <div key={i} style={{ marginBottom: '10px' }}>
                    <SkeletonBar w={60 + (i * 7) % 30} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const approvedSet = new Set(
    Array.from(latestOutputs.values())
      .filter(s => s.status === 'approved')
      .map(s => s.step_id)
  )
  const totalApproved = approvedSet.size
  const overallPct = Math.round((totalApproved / 38) * 100)

  const sortedDefs = [...stepDefs].sort((a, b) => stepOrder(a.id) - stepOrder(b.id))

  // Steps grouped by normalized section name
  const stepsBySection = new Map<string, StepDef[]>()
  for (const s of sortedDefs) {
    const sec = normalizeSection(s.section)
    const arr = stepsBySection.get(sec) ?? []
    arr.push(s)
    stepsBySection.set(sec, arr)
  }

  // Phase 1 step IDs — used here and below for the banner
  const PHASE1_STEPS = ['1', '2', '3', '3.5']
  const phase1Complete = PHASE1_STEPS.every(id => approvedSet.has(id))

  // Recommended next steps: not yet approved, all prereqs met, Phase 1 steps hidden once all approved
  const journeyNotStarted = latestOutputs.size === 0
  const recommended = sortedDefs
    .filter(s => !approvedSet.has(s.id))
    .filter(s => s.id !== '4.5' && !(phase1Complete && PHASE1_STEPS.includes(s.id)))
    .filter(s => (depsMap.get(s.id) ?? []).every(p => approvedSet.has(p)))
    .slice(0, 3)

  // Gate statuses
  const gate1: GateStatus = dcpRow?.status === 'approved' ? 'approved'
    : dcpRow?.status === 'pending_approval' ? 'pending'
    : 'locked'
  const gate2 = deriveGateStatus(approvedSet, GATE_2_STEPS)
  const gate3 = deriveGateStatus(approvedSet, GATE_3_STEPS)
  const gate4 = deriveGateStatus(approvedSet, GATE_4_STEPS)

  // Performance score
  const score = computeScore(latestOutputs, icpRows, dcpRow)
  const grade = getGrade(scoreAnimated)

  // Phase 1 Complete banner: all 4 foundation steps approved, Gate 1 not yet approved
  const showPhase1Banner = phase1Complete && gate1 !== 'approved' && !bannerDismissed

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1628' }}>
      {pageHeader}
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Widget 1: Journey Progress (full width) ─────────────────────── */}
        <div id="widget-journey" style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ ...CARD_HDR, margin: 0 }}>Journey Progress</p>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0EA5E9' }}>
              {overallPct}% Complete
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {SECTIONS.map(section => {
              const steps = stepsBySection.get(section) ?? []
              const sectionApproved = steps.filter(s => approvedSet.has(s.id)).length
              const total = steps.length
              const pct = total > 0 ? (sectionApproved / total) * 100 : 0
              const complete = sectionApproved === total && total > 0
              return (
                <div key={section} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{
                    fontSize: '13px', fontWeight: 500, color: '#FFFFFF',
                    width: '196px', flexShrink: 0,
                  }}>
                    {section}
                  </span>
                  <div style={{
                    flex: 1, height: '6px', borderRadius: '999px',
                    backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '999px',
                      width: `${pct}%`,
                      backgroundColor: complete ? '#16A34A' : '#0EA5E9',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <span style={{
                    fontSize: '12px', color: 'rgba(255,255,255,0.5)',
                    width: '96px', textAlign: 'right', flexShrink: 0,
                  }}>
                    {sectionApproved} of {total} approved
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Bottom row: Widgets 2 / 3 / 4 ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '4fr 3fr 3fr', gap: '24px', alignItems: 'start' }}>

          {/* Widget 2 — What's Next */}
          <div id="widget-next" style={CARD}>
            <p style={CARD_HDR}>What&apos;s Next</p>
            {journeyNotStarted ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                  Welcome! Begin your journey with the first step.
                </p>
                <Link
                  href="/dashboard/journeys/step/1"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    minHeight: '44px', padding: '0 18px', borderRadius: '8px',
                    backgroundColor: '#E8520A', color: '#FFFFFF',
                    textDecoration: 'none', fontSize: '13px', fontWeight: 600,
                    width: 'fit-content',
                  }}
                >
                  Begin with Step 1 — Product/Service Profile
                  <ChevronRight size={15} />
                </Link>
              </div>
            ) : recommended.length === 0 ? (
              <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                You&apos;re all caught up! 🎉
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recommended.map(step => (
                  <div key={step.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <span style={{
                      fontSize: '13px', fontWeight: 700, color: '#0EA5E9',
                      flexShrink: 0, minWidth: '28px',
                    }}>
                      {step.id}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '13px', fontWeight: 600, color: '#FFFFFF', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {step.title}
                      </p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
                        {normalizeSection(step.section)}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/journeys/step/${step.id}`}
                      style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        backgroundColor: '#E8520A',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        textDecoration: 'none', flexShrink: 0,
                      }}
                    >
                      <ChevronRight size={16} color="#FFFFFF" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Widget 3 — Gate Status */}
          <div id="widget-gates" style={CARD}>
            <p style={CARD_HDR}>Gate Status</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <GateRow n={1} label="Decision Clarity Profile Approved" status={gate1} />
              <GateRow n={2} label="Company Formulas"     status={gate2} />
              <GateRow n={3} label="Competitive Analysis" status={gate3} />
              <GateRow n={4} label="Strategic Messages"   status={gate4} />
            </div>
          </div>

          {/* Widget 4 — Performance Score */}
          <div id="widget-score" style={CARD}>
            <p style={CARD_HDR}>Performance Score</p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              {/* Ring + overlaid number + grade */}
              <div style={{ position: 'relative', width: '128px', height: '128px' }}>
                <ScoreRing score={scoreAnimated} />
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  pointerEvents: 'none',
                }}>
                  <span style={{ fontSize: '30px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                    {scoreAnimated}
                  </span>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: '#FFFFFF',
                    backgroundColor: '#0EA5E9',
                    padding: '2px 8px', borderRadius: '4px', lineHeight: 1.4,
                  }}>
                    {grade}
                  </span>
                </div>
              </div>
              {/* Score breakdown */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {([
                  { label: 'Step completion',  pts: score.stepPts,    max: 40 },
                  { label: 'ICP completeness', pts: score.icpPts,     max: 20 },
                  { label: 'Decision Clarity confidence', pts: score.dcpPts, max: 20 },
                  { label: 'Content quality',  pts: score.qualityPts, max: 20 },
                ] as const).map(({ label, pts, max }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>
                      {pts}
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}> / {max}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* ── Phase 1 Complete banner ──────────────────────────────────────── */}
        {showPhase1Banner && (
          <div style={{
            backgroundColor: '#0F2140',
            border: '1px solid rgba(255,255,255,0.1)',
            borderLeft: '4px solid #E8520A',
            borderRadius: '10px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px' }}>
                Phase 1 Complete — Time to Gather Intelligence
              </p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: '1.5' }}>
                You have completed your Company Foundation. The next critical step is the Decision Clarity Process — a structured survey that reveals exactly how your buyers make decisions. Complete Intelligence before moving to Phase 2.
              </p>
              <Link
                href="/dashboard/intelligence"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  minHeight: '44px', padding: '0 20px', borderRadius: '8px',
                  backgroundColor: '#E8520A', color: '#FFFFFF',
                  textDecoration: 'none', fontSize: '13px', fontWeight: 600,
                }}
              >
                Go to Intelligence
                <ChevronRight size={15} />
              </Link>
            </div>
            <button
              onClick={handleDismissBanner}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px', flexShrink: 0, minWidth: '44px', minHeight: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.4)',
              }}
              aria-label="Dismiss banner"
            >
              <X size={18} />
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
