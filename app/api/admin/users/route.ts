import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/superAdmin'

export const runtime = 'nodejs'

// One user row with its org, plus per-user rollups from login_events and
// report_generation_log. Rollups are cheap (small tables, one pass each).
// If either table gets huge later, split them out to the detail page.
export interface AdminUserRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  is_active: boolean
  is_super_admin: boolean
  created_at: string
  org: {
    id: string
    name: string
    slug: string
    status: string | null
  }
  login_count: number
  last_login_at: string | null
  reports_generated_count: number
}

export interface AdminUsersResponse { users: AdminUserRow[] }

// GET /api/admin/users
// Super-admin gated read-only. Returns every user across every org, with the
// user's org and per-user login + report-generation rollups.
export async function GET(): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  const svc = auth.service

  const [orgsRes, usersRes, loginsRes, logsRes] = await Promise.all([
    svc.from('organizations').select('id,name,slug,status').order('name'),
    svc.from('users')
      .select('id,org_id,email,first_name,last_name,role,is_active,is_super_admin,created_at')
      .order('created_at', { ascending: true }),
    svc.from('login_events').select('user_id,occurred_at'),
    // Only count log rows that actually attribute a user (nulls = unknown, excluded per spec).
    svc.from('report_generation_log').select('generated_by').not('generated_by', 'is', null),
  ])
  if (orgsRes.error)   return NextResponse.json({ error: orgsRes.error.message },   { status: 500 })
  if (usersRes.error)  return NextResponse.json({ error: usersRes.error.message },  { status: 500 })
  if (loginsRes.error) return NextResponse.json({ error: loginsRes.error.message }, { status: 500 })
  if (logsRes.error)   return NextResponse.json({ error: logsRes.error.message },   { status: 500 })

  type OrgLite = { id: string; name: string; slug: string; status: string | null }
  type UserRow = {
    id: string; org_id: string; email: string; first_name: string | null; last_name: string | null;
    role: string; is_active: boolean; is_super_admin: boolean; created_at: string;
  }
  type LoginRow = { user_id: string | null; occurred_at: string | null }
  type LogRow = { generated_by: string | null }

  const orgs = (orgsRes.data ?? []) as OrgLite[]
  const orgMap = new Map<string, OrgLite>()
  for (const o of orgs) orgMap.set(o.id, o)

  // Per-user login rollup
  const loginCount = new Map<string, number>()
  const lastLogin = new Map<string, string>()
  for (const l of (loginsRes.data ?? []) as LoginRow[]) {
    if (!l.user_id) continue
    loginCount.set(l.user_id, (loginCount.get(l.user_id) ?? 0) + 1)
    if (l.occurred_at) {
      const prev = lastLogin.get(l.user_id)
      if (!prev || l.occurred_at > prev) lastLogin.set(l.user_id, l.occurred_at)
    }
  }

  // Per-user report-generation count (nulls already filtered above)
  const reportsCount = new Map<string, number>()
  for (const r of (logsRes.data ?? []) as LogRow[]) {
    if (!r.generated_by) continue
    reportsCount.set(r.generated_by, (reportsCount.get(r.generated_by) ?? 0) + 1)
  }

  const users: AdminUserRow[] = ((usersRes.data ?? []) as UserRow[]).map((u) => {
    const org = orgMap.get(u.org_id) ?? { id: u.org_id, name: 'Unknown org', slug: '', status: null }
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
      is_active: u.is_active,
      is_super_admin: u.is_super_admin,
      created_at: u.created_at,
      org,
      login_count: loginCount.get(u.id) ?? 0,
      last_login_at: lastLogin.get(u.id) ?? null,
      reports_generated_count: reportsCount.get(u.id) ?? 0,
    }
  })

  return NextResponse.json({ users } satisfies AdminUsersResponse)
}
