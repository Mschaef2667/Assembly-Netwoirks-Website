import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/superAdmin'
import { isJourneyStep, JOURNEY_TOTAL } from '@/lib/journey/canonicalSteps'
import { computeScore, type ScoreStepOutput, type ScoreDcpRow } from '@/lib/scoring/computeScore'

export const runtime = 'nodejs'

// Gate step-id sets, mirrored from app/dashboard/page.tsx. Gates 3 & 4 do NOT
// have their own storage tables; the detail view surfaces per-gate step-approval
// counts as a *derived* progress signal (labeled "progress-derived" in the UI).
const GATE_3_STEPS = ['17', '18', '19', '20', '21', '22', '23', '24', '25', '26']
const GATE_4_STEPS = ['27', '28', '29', '30']

// ── Response shape ──────────────────────────────────────────────────────────
export interface AccountDetailResponse {
  account: {
    id: string
    name: string
    slug: string
    industry: string | null
    status: string | null
    plan: string | null
    website: string | null
    created_at: string
  }
  journey: {
    approved: number
    total: number
  }
  gates: {
    // Formal gates — real storage
    gate1: { source: 'dcp_analysis'; status: string | null; approved_at: string | null; submitted_at: string | null }
    gate2: { source: 'c3_projects'; status: string | null; approved_at: string | null; submitted_at: string | null; rejection_reason: string | null }
    // Progress-derived — no formal approval workflow exists yet
    gate3: { source: 'derived_from_step_output'; approved_count: number; total: number; step_ids: string[] }
    gate4: { source: 'derived_from_step_output'; approved_count: number; total: number; step_ids: string[] }
  }
  performance: {
    total: number
    stepPts: number
    icpPts: number
    dcpPts: number
    qualityPts: number
  }
  reports: {
    dcp_map:         { generated: boolean; generated_at: string | null }
    insights:        { generated: boolean; generated_at: string | null }
    engagement_plan: { generated: boolean; generated_at: string | null }
    future_state:    { generated: boolean; generated_at: string | null }
    icp_calibration: { generated: boolean; generated_at: string | null }
  }
  login_activity: {
    total_logins: number
    last_login_at: string | null
    logins_last_7d: number
    logins_last_30d: number
  }
}

// GET /api/admin/accounts/[orgId]/detail
// Super-admin gated read-only. Returns everything the account-detail page needs.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orgId: string }> },
): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  const svc = auth.service

  const { orgId } = await ctx.params
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  // Confirm the org exists first — return 404 cleanly on invalid id.
  const orgRes = await svc
    .from('organizations')
    .select('id,name,slug,industry,status,plan,website,created_at')
    .eq('id', orgId)
    .maybeSingle()
  if (orgRes.error) return NextResponse.json({ error: orgRes.error.message }, { status: 500 })
  if (!orgRes.data) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Everything else can fan out in parallel.
  const [stepsRes, dcpRes, c3Res, icpRes, logRes, loginRes] = await Promise.all([
    svc.from('step_output')
      .select('step_id,version,status,original_confidence,last_updated_at')
      .eq('workspace_id', orgId),
    svc.from('dcp_analysis')
      .select('status,overall_confidence,approved_at,submitted_at,created_at')
      .eq('org_id', orgId)
      .maybeSingle(),
    svc.from('c3_projects')
      .select('status,gate2_submitted_at,gate2_approved_at,gate2_rejection_reason')
      .eq('org_id', orgId)
      .maybeSingle(),
    svc.from('icp_definition')
      .select('*')
      .eq('org_id', orgId),
    svc.from('report_generation_log')
      .select('report_type,generated_at,metadata')
      .eq('org_id', orgId)
      .in('report_type', ['engagement_plan', 'future_state', 'icp_calibration'])
      .order('generated_at', { ascending: false }),
    svc.from('login_events')
      .select('occurred_at')
      .eq('org_id', orgId)
      .order('occurred_at', { ascending: false }),
  ])

  // ── Step output ────────────────────────────────────────────────────────────
  type StepRow = {
    step_id: string
    version: number
    status: string | null
    original_confidence: number | null
    last_updated_at: string | null
  }
  const stepRows = (stepsRes.data ?? []) as StepRow[]

  // Latest version per step_id — matches how the user dashboard collapses versions.
  const latestByStep = new Map<string, StepRow>()
  for (const r of stepRows) {
    const ex = latestByStep.get(r.step_id)
    if (!ex || r.version > ex.version) latestByStep.set(r.step_id, r)
  }

  // Approved canonical journey count (numerator over JOURNEY_TOTAL).
  const approvedCanonical = Array.from(latestByStep.values())
    .filter(s => s.status === 'approved' && isJourneyStep(s.step_id))
    .length

  // Approved-step set for gate 3/4 derivation.
  const approvedSet = new Set<string>()
  for (const s of latestByStep.values()) {
    if (s.status === 'approved') approvedSet.add(s.step_id)
  }

  // ── Gates ─────────────────────────────────────────────────────────────────
  const dcp = dcpRes.data as { status?: string; approved_at?: string | null; submitted_at?: string | null; overall_confidence?: number | null; created_at?: string | null } | null
  const c3 = c3Res.data as { status?: string; gate2_submitted_at?: string | null; gate2_approved_at?: string | null; gate2_rejection_reason?: string | null } | null

  const gate3ApprovedCount = GATE_3_STEPS.filter(id => approvedSet.has(id)).length
  const gate4ApprovedCount = GATE_4_STEPS.filter(id => approvedSet.has(id)).length

  // ── Performance score (via the shared lib) ────────────────────────────────
  const scoreOutputs = new Map<string, ScoreStepOutput>()
  for (const [k, v] of latestByStep.entries()) {
    scoreOutputs.set(k, {
      step_id: v.step_id,
      status: v.status ?? '',
      original_confidence: v.original_confidence,
    })
  }
  const scoreDcpRow: ScoreDcpRow | null = dcp
    ? { status: dcp.status ?? '', overall_confidence: dcp.overall_confidence ?? null }
    : null
  const scoreIcpRows = (icpRes.data ?? []) as Array<Record<string, unknown>>
  const performance = computeScore(scoreOutputs, scoreIcpRows, scoreDcpRow)

  // ── Reports generated ─────────────────────────────────────────────────────
  // DCP Map: row in dcp_analysis. Timestamp = approved_at or submitted_at or created_at.
  const dcpGenerated = dcp !== null
  const dcpGeneratedAt = dcp?.approved_at ?? dcp?.submitted_at ?? dcp?.created_at ?? null

  // Insights: latest step_output row with step_id='insights'.
  const insightsRow = latestByStep.get('insights')
  const insightsGenerated = !!insightsRow
  const insightsGeneratedAt = insightsRow?.last_updated_at ?? null

  // Engagement plan / future state / icp calibration: report_generation_log rows.
  type LogRow = { report_type: string; generated_at: string | null; metadata: unknown }
  const logRows = (logRes.data ?? []) as LogRow[]
  function maxLogged(type: 'engagement_plan' | 'future_state' | 'icp_calibration', excludeAutoPreview: boolean): string | null {
    let max: string | null = null
    for (const r of logRows) {
      if (r.report_type !== type) continue
      if (!r.generated_at) continue
      if (excludeAutoPreview) {
        const meta = r.metadata as Record<string, unknown> | null
        const trigger = meta && typeof meta['trigger'] === 'string' ? (meta['trigger'] as string) : null
        if (trigger === 'auto_preview') continue
      }
      if (!max || r.generated_at > max) max = r.generated_at
    }
    return max
  }
  const engagementAt = maxLogged('engagement_plan', true)
  const futureStateAt = maxLogged('future_state', true)
  const icpCalibrationAt = maxLogged('icp_calibration', false)

  // ── Login activity ────────────────────────────────────────────────────────
  type LoginRow = { occurred_at: string | null }
  const logins = (loginRes.data ?? []) as LoginRow[]
  const now = Date.now()
  const cut7d = now - 7 * 86400_000
  const cut30d = now - 30 * 86400_000
  let last: string | null = null
  let count7 = 0
  let count30 = 0
  for (const l of logins) {
    if (!l.occurred_at) continue
    if (!last || l.occurred_at > last) last = l.occurred_at
    const t = new Date(l.occurred_at).getTime()
    if (t >= cut7d)  count7++
    if (t >= cut30d) count30++
  }

  // ── Assemble ──────────────────────────────────────────────────────────────
  const org = orgRes.data as {
    id: string; name: string; slug: string; industry: string | null;
    status: string | null; plan: string | null; website: string | null; created_at: string;
  }

  const payload: AccountDetailResponse = {
    account: {
      id: org.id, name: org.name, slug: org.slug, industry: org.industry,
      status: org.status, plan: org.plan, website: org.website, created_at: org.created_at,
    },
    journey: { approved: approvedCanonical, total: JOURNEY_TOTAL },
    gates: {
      gate1: {
        source: 'dcp_analysis',
        status: dcp?.status ?? null,
        approved_at: dcp?.approved_at ?? null,
        submitted_at: dcp?.submitted_at ?? null,
      },
      gate2: {
        source: 'c3_projects',
        status: c3?.status ?? null,
        approved_at: c3?.gate2_approved_at ?? null,
        submitted_at: c3?.gate2_submitted_at ?? null,
        rejection_reason: c3?.gate2_rejection_reason ?? null,
      },
      gate3: {
        source: 'derived_from_step_output',
        approved_count: gate3ApprovedCount,
        total: GATE_3_STEPS.length,
        step_ids: GATE_3_STEPS,
      },
      gate4: {
        source: 'derived_from_step_output',
        approved_count: gate4ApprovedCount,
        total: GATE_4_STEPS.length,
        step_ids: GATE_4_STEPS,
      },
    },
    performance,
    reports: {
      dcp_map:         { generated: dcpGenerated,        generated_at: dcpGeneratedAt },
      insights:        { generated: insightsGenerated,   generated_at: insightsGeneratedAt },
      engagement_plan: { generated: engagementAt !== null,      generated_at: engagementAt },
      future_state:    { generated: futureStateAt !== null,     generated_at: futureStateAt },
      icp_calibration: { generated: icpCalibrationAt !== null,  generated_at: icpCalibrationAt },
    },
    login_activity: {
      total_logins: logins.length,
      last_login_at: last,
      logins_last_7d: count7,
      logins_last_30d: count30,
    },
  }

  return NextResponse.json(payload)
}
