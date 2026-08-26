import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/superAdmin'

export const runtime = 'nodejs'

const STEP_TOTAL = 38 + 4 // 38 journey + 4 onboarding, matching the admin console

export interface AccountSummary {
  id: string
  name: string
  slug: string
  status: string | null
  plan: string | null
  industry: string | null
  website: string | null
  created_at: string
  user_count: number
  active_user_count: number
  steps_approved: number
  steps_total: number
  last_active_at: string | null
}

export interface AccountsResponse { accounts: AccountSummary[] }

// GET /api/admin/accounts — list every client workspace with an activity summary.
export async function GET(): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  const svc = auth.service

  const [orgsRes, usersRes, stepsRes] = await Promise.all([
    svc.from('organizations').select('id,name,slug,status,plan,industry,website,created_at').order('created_at', { ascending: false }),
    svc.from('users').select('org_id,is_active'),
    svc.from('step_output').select('workspace_id,status,last_updated_at,last_saved_at'),
  ])
  if (orgsRes.error) return NextResponse.json({ error: orgsRes.error.message }, { status: 500 })

  type OrgRow = { id: string; name: string; slug: string; status: string | null; plan: string | null; industry: string | null; website: string | null; created_at: string }
  type UserRow = { org_id: string; is_active: boolean | null }
  type StepRow = { workspace_id: string; status: string | null; last_updated_at: string | null; last_saved_at: string | null }

  const orgs = (orgsRes.data ?? []) as OrgRow[]
  const users = (usersRes.data ?? []) as UserRow[]
  const steps = (stepsRes.data ?? []) as StepRow[]

  const userCount = new Map<string, number>()
  const activeCount = new Map<string, number>()
  for (const u of users) {
    userCount.set(u.org_id, (userCount.get(u.org_id) ?? 0) + 1)
    if (u.is_active) activeCount.set(u.org_id, (activeCount.get(u.org_id) ?? 0) + 1)
  }

  const approved = new Map<string, number>()
  const lastActive = new Map<string, string>()
  for (const s of steps) {
    if (s.status === 'approved') approved.set(s.workspace_id, (approved.get(s.workspace_id) ?? 0) + 1)
    const ts = s.last_updated_at ?? s.last_saved_at
    if (ts) {
      const prev = lastActive.get(s.workspace_id)
      if (!prev || ts > prev) lastActive.set(s.workspace_id, ts)
    }
  }

  const accounts: AccountSummary[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status,
    plan: o.plan,
    industry: o.industry,
    website: o.website,
    created_at: o.created_at,
    user_count: userCount.get(o.id) ?? 0,
    active_user_count: activeCount.get(o.id) ?? 0,
    steps_approved: approved.get(o.id) ?? 0,
    steps_total: STEP_TOTAL,
    last_active_at: lastActive.get(o.id) ?? null,
  }))

  return NextResponse.json({ accounts } satisfies AccountsResponse)
}

// POST /api/admin/accounts — set up a new client workspace + a private invite link.
// Matches the invite-only model: the first user to accept the link becomes the org admin.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  const svc = auth.service

  let body: { name?: string; industry?: string; website?: string; plan?: string }
  try { body = (await req.json()) as typeof body } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Account name is required' }, { status: 400 })

  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'account'
  const slug = `${base}-${Date.now().toString(36)}`

  const { data: org, error: orgErr } = await svc
    .from('organizations')
    .insert({
      name,
      slug,
      status: 'active',
      plan: (body.plan ?? 'beta').trim() || 'beta',
      industry: body.industry?.trim() || null,
      website: body.website?.trim() || null,
    })
    .select('id,name,slug')
    .single()
  if (orgErr || !org) return NextResponse.json({ error: orgErr?.message ?? 'Failed to create account' }, { status: 500 })

  const orgId = (org as { id: string }).id
  const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
  const { data: invite, error: invErr } = await svc
    .from('org_invites')
    .insert({ org_id: orgId, role: 'org_admin', expires_at: expiresAt, created_by: auth.userId })
    .select('token')
    .single()
  if (invErr || !invite) return NextResponse.json({ error: invErr?.message ?? 'Account created, but the invite link failed', org }, { status: 500 })

  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const token = (invite as { token: string }).token
  return NextResponse.json({ org, token, inviteUrl: `${origin}/invite/${token}` })
}
