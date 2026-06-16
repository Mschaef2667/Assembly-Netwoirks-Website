import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export type AdminOrg = {
  id: string
  name: string
  slug: string
  created_at: string
  user_count: number
  steps_approved: number
  steps_total: number
  last_active_at: string | null
}

export type AdminOrgUser = {
  id: string
  org_id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

export type AdminFeedback = {
  id: string
  org_id: string
  org_name: string
  user_id: string
  type: 'thumbs_up' | 'thumbs_down' | 'issue' | 'idea'
  message: string | null
  page_url: string | null
  step_id: string | null
  created_at: string
  resolved_at: string | null
}

export type AdminError = {
  id: string
  org_id: string
  org_name: string
  step_id: string
  error_code: string | null
  model: string | null
  created_at: string
}

export type AdminUsageSummary = {
  total_orgs: number
  total_users: number
  total_runs_week: number
  top_steps: Array<{ step_id: string; count: number }>
  error_rate_steps: Array<{ step_id: string; total: number; errors: number; rate: number }>
}

export type AdminWhitepaperLead = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  company: string | null
  job_title: string | null
  situation: string | null
  downloaded_at: string
}

export type AdminDemoRequest = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  company: string | null
  job_title: string | null
  goals: string | null
  submitted_at: string
  provisioned_at: string | null
  provisioned_org_id: string | null
}

export type AdminDataResponse = {
  orgs: AdminOrg[]
  users: AdminOrgUser[]
  feedback: AdminFeedback[]
  errors: AdminError[]
  usage: AdminUsageSummary
  leads: AdminWhitepaperLead[]
  demoRequests: AdminDemoRequest[]
}

const STEP_TOTAL = 38 + 4 // 38 journey + 4 onboarding (1, 2, 3, 3.5)

export async function GET(): Promise<Response> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options)
            }
          },
        },
      },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: meRow, error: meErr } = await service
      .from('users')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (meErr || !meRow || !(meRow as { is_super_admin?: boolean }).is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [
      orgsRes,
      usersRes,
      feedbackRes,
      runsRes,
      stepOutputsRes,
      leadsRes,
      demoRequestsRes,
    ] = await Promise.all([
      service.from('organizations').select('id, name, slug, created_at').order('created_at', { ascending: false }),
      service.from('users').select('id, org_id, email, first_name, last_name, role, is_active, created_at'),
      service.from('beta_feedback').select('id, org_id, user_id, type, message, page_url, step_id, created_at, resolved_at').order('created_at', { ascending: false }),
      service.from('copilot_run').select('id, workspace_id, step_id, status, error_code, model, created_at').order('created_at', { ascending: false }).limit(2000),
      service.from('step_output').select('workspace_id, step_id, status, last_updated_at, last_saved_at'),
      service.from('whitepaper_leads').select('id, first_name, last_name, email, company, job_title, situation, downloaded_at').order('downloaded_at', { ascending: false }).limit(1000),
      service.from('demo_requests').select('id, first_name, last_name, email, company, job_title, goals, submitted_at, provisioned_at, provisioned_org_id').order('submitted_at', { ascending: false }).limit(1000),
    ])

    if (orgsRes.error)        return NextResponse.json({ error: orgsRes.error.message }, { status: 500 })
    if (usersRes.error)       return NextResponse.json({ error: usersRes.error.message }, { status: 500 })
    if (feedbackRes.error)    return NextResponse.json({ error: feedbackRes.error.message }, { status: 500 })
    if (runsRes.error)        return NextResponse.json({ error: runsRes.error.message }, { status: 500 })
    if (stepOutputsRes.error) return NextResponse.json({ error: stepOutputsRes.error.message }, { status: 500 })
    // leadsRes error is non-fatal — the table may not exist yet on this environment.

    const rawOrgs = (orgsRes.data ?? []) as Array<{
      id: string; name: string; slug: string; created_at: string
    }>
    const rawUsers = (usersRes.data ?? []) as Array<{
      id: string; org_id: string; email: string;
      first_name: string | null; last_name: string | null;
      role: string; is_active: boolean; created_at: string
    }>
    const rawFeedback = (feedbackRes.data ?? []) as Array<{
      id: string; org_id: string; user_id: string;
      type: AdminFeedback['type']; message: string | null;
      page_url: string | null; step_id: string | null;
      created_at: string; resolved_at: string | null
    }>
    const rawRuns = (runsRes.data ?? []) as Array<{
      id: string; workspace_id: string; step_id: string;
      status: string; error_code: string | null;
      model: string | null; created_at: string
    }>
    const rawSteps = (stepOutputsRes.data ?? []) as Array<{
      workspace_id: string; step_id: string; status: string;
      last_updated_at: string | null; last_saved_at: string | null
    }>

    const orgNameById = new Map<string, string>()
    for (const o of rawOrgs) orgNameById.set(o.id, o.name)

    // Per-org aggregates
    const userCount         = new Map<string, number>()
    const approvedStepCount = new Map<string, number>()
    const lastActiveAt      = new Map<string, string>()

    for (const u of rawUsers) {
      userCount.set(u.org_id, (userCount.get(u.org_id) ?? 0) + 1)
    }

    for (const s of rawSteps) {
      if (s.status === 'approved') {
        approvedStepCount.set(s.workspace_id, (approvedStepCount.get(s.workspace_id) ?? 0) + 1)
      }
      const candidate = s.last_updated_at ?? s.last_saved_at
      if (candidate) {
        const prev = lastActiveAt.get(s.workspace_id)
        if (!prev || candidate > prev) lastActiveAt.set(s.workspace_id, candidate)
      }
    }

    const orgs: AdminOrg[] = rawOrgs.map(o => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      created_at: o.created_at,
      user_count: userCount.get(o.id) ?? 0,
      steps_approved: approvedStepCount.get(o.id) ?? 0,
      steps_total: STEP_TOTAL,
      last_active_at: lastActiveAt.get(o.id) ?? null,
    }))

    const users: AdminOrgUser[] = rawUsers.map(u => ({ ...u }))

    const feedback: AdminFeedback[] = rawFeedback.map(f => ({
      ...f,
      org_name: orgNameById.get(f.org_id) ?? '—',
    }))

    const errors: AdminError[] = rawRuns
      .filter(r => r.status === 'error')
      .map(r => ({
        id: r.id,
        org_id: r.workspace_id,
        org_name: orgNameById.get(r.workspace_id) ?? '—',
        step_id: r.step_id,
        error_code: r.error_code,
        model: r.model,
        created_at: r.created_at,
      }))

    // Usage stats
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const runsThisWeek = rawRuns.filter(r => r.created_at >= weekAgo)

    const stepCount  = new Map<string, number>()
    const stepErrors = new Map<string, number>()
    for (const r of rawRuns) {
      stepCount.set(r.step_id, (stepCount.get(r.step_id) ?? 0) + 1)
      if (r.status === 'error') {
        stepErrors.set(r.step_id, (stepErrors.get(r.step_id) ?? 0) + 1)
      }
    }

    const top_steps = [...stepCount.entries()]
      .map(([step_id, count]) => ({ step_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const error_rate_steps = [...stepCount.entries()]
      .map(([step_id, total]) => {
        const errCount = stepErrors.get(step_id) ?? 0
        return { step_id, total, errors: errCount, rate: total === 0 ? 0 : errCount / total }
      })
      .filter(s => s.errors > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10)

    const usage: AdminUsageSummary = {
      total_orgs: rawOrgs.length,
      total_users: rawUsers.length,
      total_runs_week: runsThisWeek.length,
      top_steps,
      error_rate_steps,
    }

    const leads: AdminWhitepaperLead[] = leadsRes.error
      ? []
      : ((leadsRes.data ?? []) as Array<AdminWhitepaperLead>).map(l => ({ ...l }))

    const demoRequests: AdminDemoRequest[] = demoRequestsRes.error
      ? []
      : ((demoRequestsRes.data ?? []) as Array<AdminDemoRequest>).map(d => ({ ...d }))

    const payload: AdminDataResponse = { orgs, users, feedback, errors, usage, leads, demoRequests }
    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/data] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
