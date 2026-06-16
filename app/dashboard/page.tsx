'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, Lock, Clock, ChevronRight, X, Brain, Lightbulb, FileText, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { isJourneyStep, JOURNEY_TOTAL } from '@/lib/journey/canonicalSteps'

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

interface AudienceCount {
  audience: string
  count: number
}

type GapLevel = 'none' | 'low' | 'medium' | 'high' | 'critical'

interface CapabilityGap {
  stepId: '13' | '14'
  label: string
  description: string
  gapLevel: Extract<GapLevel, 'critical' | 'high'>
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
  // Only canonical Journey steps (1..38) count toward step completion.
  // Non-canonical artefacts (insights, dcp-map, survey-builder-*, sub-steps)
  // are filtered out so they can never inflate the count past 38.
  const approved = Array.from(outputs.values()).filter(
    s => s.status === 'approved' && isJourneyStep(s.step_id),
  )

  // Step completion: approved / JOURNEY_TOTAL * 40, clamped to the 40-pt band.
  const stepPts = Math.min(40, Math.round((approved.length / JOURNEY_TOTAL) * 40))

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
  const [audienceCounts, setAudienceCounts] = useState<AudienceCount[]>([])
  const [capabilityGaps, setCapabilityGaps] = useState<CapabilityGap[]>([])
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [actionPlanGeneratedAt, setActionPlanGeneratedAt] = useState<string | null>(null)
  const [futureStateGeneratedAt, setFutureStateGeneratedAt] = useState<string | null>(null)
  const [actionPlanApproved, setActionPlanApproved] = useState<string | null>(null)
  const [futureStateApproved, setFutureStateApproved] = useState<string | null>(null)
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

        const [defsRes, outputsRes, depsRes, dcpRes, icpRes, surveyRes, capRes, orgRes] = await Promise.all([
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
          supabase.from('survey_link_responses').select('audience').eq('org_id', orgId),
          supabase.from('step_output')
            .select('step_id,version,content')
            .eq('workspace_id', orgId)
            .in('step_id', ['13', '14']),
          supabase.from('organizations').select('name, logo_url').eq('id', orgId).single(),
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

        // Audience counts from survey_link_responses
        const rawResponses = (surveyRes.data ?? []) as Array<{ audience: string }>
        const countMap = new Map<string, number>()
        for (const r of rawResponses) {
          countMap.set(r.audience, (countMap.get(r.audience) ?? 0) + 1)
        }
        const counts: AudienceCount[] = [
          'internal', 'current', 'lost', 'potential',
        ].map(a => ({ audience: a, count: countMap.get(a) ?? 0 }))

        // Latest content per step for steps 13/14 → critical/high gap items
        const capLatest = new Map<string, { version: number; items: unknown[] }>()
        for (const r of (capRes.data ?? []) as Array<{ step_id: string; version: number; content: unknown }>) {
          const c = r.content && typeof r.content === 'object' ? r.content as Record<string, unknown> : null
          const items = c && Array.isArray(c['items']) ? (c['items'] as unknown[]) : []
          const ex = capLatest.get(r.step_id)
          if (!ex || r.version > ex.version) capLatest.set(r.step_id, { version: r.version, items })
        }
        const gaps: CapabilityGap[] = []
        for (const stepId of ['13', '14'] as const) {
          for (const raw of capLatest.get(stepId)?.items ?? []) {
            if (typeof raw !== 'object' || raw === null) continue
            const o = raw as Record<string, unknown>
            const gl = typeof o['gapLevel'] === 'string' ? o['gapLevel'] : ''
            if (gl !== 'critical' && gl !== 'high') continue
            gaps.push({
              stepId,
              label: typeof o['label'] === 'string' ? o['label'] : '',
              description: typeof o['description'] === 'string' ? o['description'] : '',
              gapLevel: gl,
            })
          }
        }

        setStepDefs((defsRes.data ?? []) as StepDef[])
        setLatestOutputs(outMap)
        setDepsMap(dm)
        setDcpRow(dcpRes.data as DcpRow | null)
        setIcpRows((icpRes.data ?? []) as Array<Record<string, unknown>>)
        setAudienceCounts(counts)
        setCapabilityGaps(gaps)

        if (orgRes.data) {
          const orgRow = orgRes.data as Record<string, unknown>
          const name = typeof orgRow['name'] === 'string' ? (orgRow['name'] as string) : null
          const logo = typeof orgRow['logo_url'] === 'string' ? (orgRow['logo_url'] as string) : null
          setOrgName(name && name.length > 0 ? name : null)
          setOrgLogoUrl(logo && logo.length > 0 ? logo : null)
        }
        setOrgId(orgId)
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

  // ── Report last-generated timestamps (per org) ────────────────────────────────

  useEffect(() => {
    if (!orgId) return
    function readReportStatus() {
      setActionPlanGeneratedAt(localStorage.getItem(`c3.report.actionPlan.lastGenerated:${orgId}`))
      setFutureStateGeneratedAt(localStorage.getItem(`c3.report.futureStatePlan.lastGenerated:${orgId}`))
      setActionPlanApproved(localStorage.getItem('report_action_plan_approved'))
      setFutureStateApproved(localStorage.getItem('report_future_state_approved'))
    }
    readReportStatus()
    window.addEventListener('focus', readReportStatus)
    return () => window.removeEventListener('focus', readReportStatus)
  }, [orgId])

  function handleDismissBanner() {
    localStorage.setItem('phase1_banner_dismissed', 'true')
    setBannerDismissed(true)
  }

  // ── Shared header ────────────────────────────────────────────────────────────

  const pageHeader = (
    <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {orgLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={orgLogoUrl}
          alt={orgName ?? 'Company logo'}
          style={{
            maxHeight: '60px',
            width: 'auto',
            display: 'block',
            marginBottom: '16px',
          }}
        />
      )}
      <h1 style={{ color: '#FFFFFF', fontSize: '32px', fontWeight: 700, margin: 0 }}>
        {orgName ?? 'Workspace Dashboard'}
      </h1>
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

  // approvedSet contains every approved step_id (canonical + non-canonical),
  // used by gate-status derivation which references specific ids like '3.5'.
  const approvedSet = new Set(
    Array.from(latestOutputs.values())
      .filter(s => s.status === 'approved')
      .map(s => s.step_id)
  )
  // Header count uses canonical Journey steps only so sub-steps and
  // non-step artefacts can never push the total above JOURNEY_TOTAL.
  const canonicalApprovedCount = Array.from(approvedSet).filter(isJourneyStep).length
  const overallPct = Math.min(100, Math.round((canonicalApprovedCount / JOURNEY_TOTAL) * 100))

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

  // Recommended next steps: have no step_output row yet, all prereqs met,
  // Phase 1 steps hidden once all approved
  const journeyNotStarted = latestOutputs.size === 0
  const recommended = sortedDefs
    .filter(s => !latestOutputs.has(s.id))
    .filter(s => !(phase1Complete && PHASE1_STEPS.includes(s.id)))
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ ...CARD_HDR, margin: 0 }}>Journey Progress</p>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0EA5E9' }}>
              {canonicalApprovedCount} of {JOURNEY_TOTAL} steps approved · {overallPct}%
            </span>
          </div>
          <div style={{
            height: '8px',
            borderRadius: '999px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
            marginBottom: '20px',
          }}>
            <div style={{
              height: '100%',
              borderRadius: '999px',
              width: `${overallPct}%`,
              backgroundColor: overallPct === 100 ? '#16A34A' : '#0EA5E9',
              transition: 'width 0.5s ease',
            }} />
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
                  Begin with Step 1 — Product, Service, or Cause Profile
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

        {/* ── Widget 5: Intelligence Status (full width) ─────────────────── */}
        {(() => {
          const AUDIENCE_LABELS: Record<string, string> = {
            internal: 'Internal Stakeholders',
            current:  'Current Customers',
            lost:     'Lost Customers',
            potential: 'Potential Customers',
          }
          const totalResponses = audienceCounts.reduce((s, a) => s + a.count, 0)
          const dcpStatus = dcpRow?.status === 'approved'
            ? 'Approved'
            : dcpRow?.status === 'pending_approval'
            ? 'Pending'
            : 'Not started'
          const dcpStatusColor = dcpRow?.status === 'approved'
            ? '#0EA5E9'
            : dcpRow?.status === 'pending_approval'
            ? '#D97706'
            : 'rgba(255,255,255,0.35)'
          const gate1StatusLabel = gate1 === 'approved' ? 'Approved' : gate1 === 'pending' ? 'Pending' : 'Locked'
          const gate1StatusColor = gate1 === 'approved' ? '#0EA5E9' : gate1 === 'pending' ? '#D97706' : 'rgba(255,255,255,0.35)'

          return (
            <div id="widget-intelligence" style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <p style={{ ...CARD_HDR, margin: 0 }}>Intelligence Status</p>
                <Link
                  href="/dashboard/intelligence"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    minHeight: '36px', padding: '0 16px', borderRadius: '7px',
                    backgroundColor: '#0EA5E9', color: '#FFFFFF',
                    textDecoration: 'none', fontSize: '12px', fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  Go to Intelligence
                  <ChevronRight size={13} />
                </Link>
              </div>

              {totalResponses === 0 ? (
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 20px' }}>
                  No survey responses yet. Share your survey links to start collecting buyer intelligence.
                </p>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                {audienceCounts.map(({ audience, count }) => (
                  <div key={audience} style={{
                    padding: '14px 16px', borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {AUDIENCE_LABELS[audience] ?? audience}
                    </span>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: count > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.25)', lineHeight: 1 }}>
                      {count}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                      {count === 1 ? 'response' : 'responses'}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    DCP Map
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: dcpStatusColor }}>
                    {dcpStatus}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Gate 1
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: gate1StatusColor }}>
                    {gate1StatusLabel}
                  </span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Widget 6: Capability Gaps (full width) ─────────────────────── */}
        {(() => {
          const critical = capabilityGaps.filter(g => g.gapLevel === 'critical')
          const high = capabilityGaps.filter(g => g.gapLevel === 'high')
          const topGaps = [...critical, ...high].slice(0, 3)
          const hasGaps = topGaps.length > 0
          const borderColor = critical.length > 0 ? '#EF4444' : high.length > 0 ? '#F59E0B' : '#10B981'

          const countParts: string[] = []
          if (critical.length > 0) countParts.push(`${critical.length} Critical`)
          if (high.length > 0) countParts.push(`${high.length} High`)

          return (
            <div id="widget-capability-gaps" style={{ ...CARD, borderLeft: `3px solid ${borderColor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasGaps ? '16px' : '0' }}>
                <p style={{ ...CARD_HDR, margin: 0 }}>Capability Gaps</p>
                {hasGaps && (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
                    {countParts.join(', ')} gaps identified
                  </span>
                )}
              </div>

              {!hasGaps ? (
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                  Complete Steps 13 and 14 to see your capability gap analysis.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {topGaps.map((gap, idx) => {
                      const isCritical = gap.gapLevel === 'critical'
                      const badgeBg = isCritical ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'
                      const badgeColor = isCritical ? '#EF4444' : '#F59E0B'
                      return (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '12px',
                          padding: '12px 14px', borderRadius: '8px',
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, color: badgeColor,
                            backgroundColor: badgeBg, padding: '4px 8px', borderRadius: '4px',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            flexShrink: 0, minWidth: '60px', textAlign: 'center',
                          }}>
                            {isCritical ? 'Critical' : 'High'}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                              {gap.label || 'Untitled item'}
                            </p>
                            {gap.description && (
                              <p style={{
                                fontSize: '12px', color: 'rgba(255,255,255,0.55)',
                                margin: '4px 0 0', lineHeight: '1.45',
                              }}>
                                {gap.description}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <Link
                    href="/dashboard/journeys/step/13"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      minHeight: '36px', padding: '0 16px', borderRadius: '7px',
                      backgroundColor: '#0EA5E9', color: '#FFFFFF',
                      textDecoration: 'none', fontSize: '12px', fontWeight: 600,
                    }}
                  >
                    Review Gaps
                    <ChevronRight size={13} />
                  </Link>
                </>
              )}
            </div>
          )
        })()}

        {/* ── Widget 7: Reports (full width) ──────────────────────────────── */}
        {(() => {
          const insightsGenerated = latestOutputs.has('insights')
          const futureStateLocked = gate1 !== 'approved'

          function formatDate(iso: string | null): string {
            if (!iso) return ''
            const d = new Date(iso)
            if (Number.isNaN(d.getTime())) return ''
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          }

          const actionPlanGenerated = !!actionPlanGeneratedAt
          const futureStateGenerated = !!futureStateGeneratedAt && !futureStateLocked

          interface ReportRowProps {
            icon: React.ReactNode
            iconColor: string
            iconBg: string
            name: string
            description: string
            statusLabel: string
            statusColor: string
            statusBg: string
            actions: React.ReactNode
          }

          function ReportRow(p: ReportRowProps) {
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px', borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
                  backgroundColor: p.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: p.iconColor, display: 'flex' }}>{p.icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                    {p.name}
                  </p>
                  <p style={{
                    fontSize: '11px', color: 'rgba(255,255,255,0.45)',
                    margin: '2px 0 0', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.description}
                  </p>
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: p.statusColor,
                  backgroundColor: p.statusBg, padding: '4px 10px', borderRadius: '4px',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  {p.statusLabel}
                </span>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {p.actions}
                </div>
              </div>
            )
          }

          const linkBtn: React.CSSProperties = {
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            minHeight: '36px', padding: '0 14px', borderRadius: '7px',
            backgroundColor: '#0EA5E9', color: '#FFFFFF',
            textDecoration: 'none', fontSize: '12px', fontWeight: 600,
            whiteSpace: 'nowrap',
          }
          const linkBtnSecondary: React.CSSProperties = {
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            minHeight: '36px', padding: '0 14px', borderRadius: '7px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.15)',
            textDecoration: 'none', fontSize: '12px', fontWeight: 600,
            whiteSpace: 'nowrap',
          }
          const lockedBtn: React.CSSProperties = {
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            minHeight: '36px', padding: '0 14px', borderRadius: '7px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.35)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '12px', fontWeight: 600,
            cursor: 'not-allowed', whiteSpace: 'nowrap',
          }

          // DCP Map row
          const dcpStatusLabel = dcpRow?.status === 'approved'
            ? 'Approved'
            : dcpRow?.status === 'pending_approval' || dcpRow?.status === 'draft'
            ? 'Draft'
            : 'Not started'
          const dcpStatusColor = dcpRow?.status === 'approved'
            ? '#10B981'
            : dcpRow?.status === 'pending_approval' || dcpRow?.status === 'draft'
            ? '#D97706'
            : 'rgba(255,255,255,0.5)'
          const dcpStatusBg = dcpRow?.status === 'approved'
            ? 'rgba(16,185,129,0.15)'
            : dcpRow?.status === 'pending_approval' || dcpRow?.status === 'draft'
            ? 'rgba(217,119,6,0.15)'
            : 'rgba(255,255,255,0.06)'

          // Insights row
          const insightsStatusLabel = insightsGenerated ? 'Generated' : 'Not started'
          const insightsStatusColor = insightsGenerated ? '#10B981' : 'rgba(255,255,255,0.5)'
          const insightsStatusBg = insightsGenerated ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'

          // Action Plan row
          const apStatusLabel = actionPlanApproved
            ? `Approved ${formatDate(actionPlanApproved)}`
            : actionPlanGenerated
            ? `Generated ${formatDate(actionPlanGeneratedAt)}`
            : 'Not generated'
          const apStatusColor = actionPlanApproved
            ? '#16A34A'
            : actionPlanGenerated ? '#10B981' : 'rgba(255,255,255,0.5)'
          const apStatusBg = actionPlanApproved
            ? 'rgba(22,163,74,0.15)'
            : actionPlanGenerated ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'

          // Future State Plan row
          const fsStatusLabel = futureStateLocked
            ? 'Locked'
            : futureStateApproved
            ? `Approved ${formatDate(futureStateApproved)}`
            : futureStateGenerated
            ? `Generated ${formatDate(futureStateGeneratedAt)}`
            : 'Not generated'
          const fsStatusColor = futureStateLocked
            ? 'rgba(255,255,255,0.35)'
            : futureStateApproved
            ? '#16A34A'
            : futureStateGenerated
            ? '#10B981'
            : 'rgba(255,255,255,0.5)'
          const fsStatusBg = futureStateLocked
            ? 'rgba(255,255,255,0.06)'
            : futureStateApproved
            ? 'rgba(22,163,74,0.15)'
            : futureStateGenerated
            ? 'rgba(16,185,129,0.15)'
            : 'rgba(255,255,255,0.06)'

          return (
            <div id="widget-reports" style={CARD}>
              <p style={CARD_HDR}>Reports</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <ReportRow
                  icon={<Brain size={20} />}
                  iconColor="#0EA5E9"
                  iconBg="rgba(14,165,233,0.15)"
                  name="DCP Map"
                  description="Decision Clarity Profile across the 7 stages of buyer research."
                  statusLabel={dcpStatusLabel}
                  statusColor={dcpStatusColor}
                  statusBg={dcpStatusBg}
                  actions={
                    <>
                      <Link href="/dashboard/intelligence/dcp-map" style={linkBtnSecondary}>Open</Link>
                      {dcpRow?.status === 'approved' && (
                        <Link href="/dashboard/intelligence/dcp-map" style={linkBtn}>Download PDF</Link>
                      )}
                    </>
                  }
                />
                <ReportRow
                  icon={<Lightbulb size={20} />}
                  iconColor="#F59E0B"
                  iconBg="rgba(245,158,11,0.15)"
                  name="Insights Report"
                  description="Six-category strategic intelligence drawn from buyer research."
                  statusLabel={insightsStatusLabel}
                  statusColor={insightsStatusColor}
                  statusBg={insightsStatusBg}
                  actions={
                    <>
                      <Link href="/dashboard/intelligence/insights" style={linkBtnSecondary}>Open</Link>
                      {insightsGenerated && (
                        <Link href="/dashboard/intelligence/insights" style={linkBtn}>Download PDF</Link>
                      )}
                    </>
                  }
                />
                <ReportRow
                  icon={<FileText size={20} />}
                  iconColor="#E8520A"
                  iconBg="rgba(232,82,10,0.15)"
                  name="Action Plan"
                  description="Current state Strategic Action Plan compiled from approved Journey steps."
                  statusLabel={apStatusLabel}
                  statusColor={apStatusColor}
                  statusBg={apStatusBg}
                  actions={
                    <>
                      <Link href="/dashboard/journeys/report" style={linkBtnSecondary}>Open</Link>
                      {actionPlanGenerated && (
                        <>
                          <Link href="/dashboard/journeys/report" style={linkBtn}>Download PDF</Link>
                          <Link href="/dashboard/journeys/report" style={linkBtnSecondary}>Download Word</Link>
                        </>
                      )}
                    </>
                  }
                />
                <ReportRow
                  icon={<TrendingUp size={20} />}
                  iconColor="#0EA5E9"
                  iconBg="rgba(14,165,233,0.15)"
                  name="Future State Plan"
                  description="6-18 month strategic roadmap drawn from Insights and capability gaps."
                  statusLabel={fsStatusLabel}
                  statusColor={fsStatusColor}
                  statusBg={fsStatusBg}
                  actions={
                    futureStateLocked ? (
                      <span style={lockedBtn} title="Gate 1 must be approved to unlock Future State Plan">
                        <Lock size={13} />
                        Locked
                      </span>
                    ) : (
                      <>
                        <Link href="/dashboard/journeys/report" style={linkBtnSecondary}>Open</Link>
                        {futureStateGenerated && (
                          <Link href="/dashboard/journeys/report" style={linkBtn}>Download PDF</Link>
                        )}
                      </>
                    )
                  }
                />
              </div>
            </div>
          )
        })()}

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
