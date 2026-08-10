import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Super-admin only. Creates a reusable, revocable, expiring invite link for an org.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !svcKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => { for (const { name, value, options } of toSet) cookieStore.set(name, value, options) },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createClient(url, svcKey)
  const { data: me } = await svc.from('users').select('is_super_admin').eq('id', user.id).single()
  if (!me || !(me as { is_super_admin?: boolean }).is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { orgId?: string; role?: string; expiresDays?: number; maxUses?: number; emailDomain?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!body.orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  const days = body.expiresDays && body.expiresDays > 0 ? body.expiresDays : 14
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString()

  const { data: invite, error } = await svc
    .from('org_invites')
    .insert({
      org_id: body.orgId,
      role: body.role ?? 'sales_rep',
      email_domain: body.emailDomain ?? null,
      max_uses: body.maxUses ?? null,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('token')
    .single()
  if (error || !invite) return NextResponse.json({ error: error?.message ?? 'Failed to create invite' }, { status: 500 })

  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const token = (invite as { token: string }).token
  return NextResponse.json({ token, url: `${origin}/invite/${token}` })
}
