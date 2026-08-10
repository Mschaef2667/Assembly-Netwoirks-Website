import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

interface Invite {
  id: string
  org_id: string
  role: string
  email_domain: string | null
  max_uses: number | null
  used_count: number
  expires_at: string | null
  revoked_at: string | null
}

async function loadValidInvite(svc: SupabaseClient, token: string): Promise<{ invite?: Invite; error?: string }> {
  if (!token) return { error: 'This invite link is not valid.' }
  const { data, error } = await svc
    .from('org_invites')
    .select('id, org_id, role, email_domain, max_uses, used_count, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle()
  if (error || !data) return { error: 'This invite link is not valid.' }
  const inv = data as unknown as Invite
  if (inv.revoked_at) return { error: 'This invite link has been revoked.' }
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return { error: 'This invite link has expired.' }
  if (inv.max_uses != null && inv.used_count >= inv.max_uses) return { error: 'This invite link has reached its maximum number of uses.' }
  return { invite: inv }
}

// GET: validate a token and return the org name (for the invite page to display).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const svc = serviceClient()
  if (!svc) return NextResponse.json({ valid: false, error: 'Server misconfiguration' }, { status: 500 })
  const token = req.nextUrl.searchParams.get('token') ?? ''
  const { invite, error } = await loadValidInvite(svc, token)
  if (!invite) return NextResponse.json({ valid: false, error })
  const { data: org } = await svc.from('organizations').select('name').eq('id', invite.org_id).single()
  return NextResponse.json({ valid: true, orgName: (org as { name?: string } | null)?.name ?? 'your workspace' })
}

// POST: create the account and associate it with the invite's org.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const svc = serviceClient()
  if (!svc) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })

  let body: { token?: string; email?: string; password?: string; firstName?: string; lastName?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const token = (body.token ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  if (!token || !email || !password) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

  const { invite, error } = await loadValidInvite(svc, token)
  if (!invite) return NextResponse.json({ error }, { status: 400 })

  if (invite.email_domain && !email.endsWith('@' + invite.email_domain.toLowerCase())) {
    return NextResponse.json({ error: `This invite is restricted to ${invite.email_domain} email addresses.` }, { status: 403 })
  }

  // Create the auth user, pre-confirmed so they can sign in immediately.
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: body.firstName ?? '', last_name: body.lastName ?? '' },
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? 'Could not create account'
    const friendly = /already|registered|exists/i.test(msg)
      ? 'An account with this email already exists. Try signing in instead.'
      : msg
    return NextResponse.json({ error: friendly }, { status: 400 })
  }
  const userId = created.user.id

  // First user in the org becomes the org admin; everyone after gets the invite role.
  const { count } = await svc.from('users').select('id', { count: 'exact', head: true }).eq('org_id', invite.org_id)
  const role = (count ?? 0) === 0 ? 'org_admin' : invite.role

  const { error: userErr } = await svc.from('users').insert({
    id: userId,
    org_id: invite.org_id,
    role,
    email,
    first_name: body.firstName ?? null,
    last_name: body.lastName ?? null,
    is_active: true,
  })
  if (userErr) {
    // Roll back the auth user so the person can retry cleanly.
    await svc.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: userErr.message }, { status: 500 })
  }

  await svc.from('org_invites').update({ used_count: invite.used_count + 1 }).eq('id', invite.id)

  return NextResponse.json({ ok: true })
}
