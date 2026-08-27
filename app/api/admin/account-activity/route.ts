import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/superAdmin'
import { isJourneyStep, JOURNEY_TOTAL } from '@/lib/journey/canonicalSteps'

export const runtime = 'nodejs'

// Health flag derived from days since the workspace last saw any step_output activity.
// Thresholds match the mockup's spec: Active ≤ 7d, Slowing 8–21d, Stalled 22d+ or no activity.
export type HealthFlag = 'active' | 'slowing' | 'stalled'

export interface AccountActivityRow {
  id: string
  name: string
  slug: string
  industry: string | null
  steps_approved: number     // canonical journey steps only (1..38, minus 3.5)
  steps_total: number        // = JOURNEY_TOTAL (38)
  last_active_at: string | null
  health: HealthFlag
}

export interface AccountActivityResponse { rows: AccountActivityRow[] }

function deriveHealth(iso: string | null): HealthFlag {
  if (!iso) return 'stalled'
  const days = (Date.now() - new Date(iso).getTime()) / 86400000
  if (days <= 7) return 'active'
  if (days <= 21) return 'slowing'
  return 'stalled'
}

// GET /api/admin/account-activity
// Read-only; super-admin gated via requireSuperAdmin() (the shared helper).
// Returns one row per organization with journey progress, last-active timestamp,
// and a derived health flag.
export async function GET(): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  const svc = auth.service

  const [orgsRes, stepsRes] = await Promise.all([
    svc.from('organizations')
      .select('id,name,slug,industry')
      .order('created_at', { ascending: false }),
    svc.from('step_output')
      .select('workspace_id,step_id,status,last_updated_at,last_saved_at'),
  ])
  if (orgsRes.error)  return NextResponse.json({ error: orgsRes.error.message },  { status: 500 })
  if (stepsRes.error) return NextResponse.json({ error: stepsRes.error.message }, { status: 500 })

  type OrgRow = { id: string; name: string; slug: string; industry: string | null }
  type StepRow = {
    workspace_id: string
    step_id: string
    status: string | null
    last_updated_at: string | null
    last_saved_at: string | null
  }

  const orgs = (orgsRes.data ?? []) as OrgRow[]
  const steps = (stepsRes.data ?? []) as StepRow[]

  // Count approved canonical-journey step_output rows per workspace, and track most-recent activity.
  // Same shape as /api/admin/accounts's pass, but numerator is filtered by isJourneyStep()
  // so it lines up with JOURNEY_TOTAL as the denominator.
  const approved = new Map<string, number>()
  const lastActive = new Map<string, string>()
  for (const s of steps) {
    if (s.status === 'approved' && isJourneyStep(s.step_id)) {
      approved.set(s.workspace_id, (approved.get(s.workspace_id) ?? 0) + 1)
    }
    const ts = s.last_updated_at ?? s.last_saved_at
    if (ts) {
      const prev = lastActive.get(s.workspace_id)
      if (!prev || ts > prev) lastActive.set(s.workspace_id, ts)
    }
  }

  const rows: AccountActivityRow[] = orgs.map((o) => {
    const last = lastActive.get(o.id) ?? null
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      industry: o.industry,
      steps_approved: approved.get(o.id) ?? 0,
      steps_total: JOURNEY_TOTAL,
      last_active_at: last,
      health: deriveHealth(last),
    }
  })

  return NextResponse.json({ rows } satisfies AccountActivityResponse)
}
