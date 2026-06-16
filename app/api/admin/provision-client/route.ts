import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { resend } from '@/lib/email/resend'

interface ProvisionBody {
  demoRequestId?: string
  firstName?: string
  lastName?: string
  email?: string
  company?: string
}

interface ProvisionResponse {
  org_id: string
  user_id: string
  temporary_password: string
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace'
}

function generateTempPassword(): string {
  const suffix = String(Math.floor(1000 + Math.random() * 9000))
  return `AssemblyBeta2026!${suffix}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface ProvisionNotification {
  company: string
  firstName: string
  lastName: string
  email: string
  tempPassword: string
  loginUrl: string
}

async function sendProvisionNotificationEmail(payload: ProvisionNotification): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[admin/provision-client] RESEND_API_KEY not set; skipping notification email.')
    return
  }

  const fullName = [payload.firstName, payload.lastName].filter(Boolean).join(' ') || '—'
  const date = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })

  const html = `
    <h2 style="font-family: Helvetica, Arial, sans-serif; color:#0A1628;">Beta Client Provisioned</h2>
    <table style="font-family: Helvetica, Arial, sans-serif; font-size:14px; color:#0D0D0D; border-collapse: collapse;">
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Company</td><td>${escapeHtml(payload.company)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Name</td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Email</td><td>${escapeHtml(payload.email)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Temp Password</td><td><code>${escapeHtml(payload.tempPassword)}</code></td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Login URL</td><td><a href="${escapeHtml(payload.loginUrl)}">${escapeHtml(payload.loginUrl)}</a></td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Date Provisioned</td><td>${escapeHtml(date)}</td></tr>
    </table>
  `

  try {
    const { error } = await resend.emails.send({
      from: 'Assembly AI <info@assemblynetworks.net>',
      to: 'mschaef@gmail.com',
      subject: `Beta Client Provisioned - ${payload.company}`,
      html,
    })
    if (error) {
      console.error('[admin/provision-client] resend failed:', error)
    }
  } catch (err) {
    console.error('[admin/provision-client] resend error:', err)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
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
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: meRow } = await service
      .from('users')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!meRow || !(meRow as { is_super_admin?: boolean }).is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: ProvisionBody
    try {
      body = (await req.json()) as ProvisionBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const demoRequestId = body.demoRequestId?.trim()
    const firstName     = body.firstName?.trim() ?? ''
    const lastName      = body.lastName?.trim() ?? ''
    const email         = body.email?.trim().toLowerCase()
    const company       = body.company?.trim()

    if (!demoRequestId) return NextResponse.json({ error: 'demoRequestId required' }, { status: 400 })
    if (!email)         return NextResponse.json({ error: 'email required' }, { status: 400 })
    if (!company)       return NextResponse.json({ error: 'company required' }, { status: 400 })

    // ── 1. Ensure demo request exists and isn't already provisioned ─────────
    const { data: demoRow, error: demoErr } = await service
      .from('demo_requests')
      .select('id, provisioned_at')
      .eq('id', demoRequestId)
      .maybeSingle()

    if (demoErr) return NextResponse.json({ error: demoErr.message }, { status: 500 })
    if (!demoRow) return NextResponse.json({ error: 'Demo request not found' }, { status: 404 })
    if ((demoRow as { provisioned_at: string | null }).provisioned_at) {
      return NextResponse.json({ error: 'Demo request already provisioned' }, { status: 409 })
    }

    // ── 2. Create organization ──────────────────────────────────────────────
    const baseSlug = slugify(company)
    const slug = `${baseSlug}-${Date.now().toString(36)}`

    const { data: orgData, error: orgError } = await service
      .from('organizations')
      .insert({
        name: company,
        slug,
        status: 'active',
        plan: 'beta',
      })
      .select('id')
      .single()

    if (orgError || !orgData) {
      return NextResponse.json({ error: `Org create failed: ${orgError?.message ?? 'unknown'}` }, { status: 500 })
    }
    const orgId = (orgData as { id: string }).id

    // ── 3. Create auth user ─────────────────────────────────────────────────
    const tempPassword = generateTempPassword()

    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    })

    if (authError || !authData.user) {
      await service.from('organizations').delete().eq('id', orgId)
      return NextResponse.json(
        { error: `Auth user create failed: ${authError?.message ?? 'unknown'}` },
        { status: 500 },
      )
    }
    const newUserId = authData.user.id

    // ── 4. Create users row linked to new org ───────────────────────────────
    const { error: userError } = await service
      .from('users')
      .insert({
        id: newUserId,
        org_id: orgId,
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        role: 'org_admin',
        is_active: true,
      })

    if (userError) {
      await service.auth.admin.deleteUser(newUserId)
      await service.from('organizations').delete().eq('id', orgId)
      return NextResponse.json({ error: `User row create failed: ${userError.message}` }, { status: 500 })
    }

    // ── 5. Mark demo request as provisioned ─────────────────────────────────
    const { error: updateError } = await service
      .from('demo_requests')
      .update({
        provisioned_at: new Date().toISOString(),
        provisioned_org_id: orgId,
      })
      .eq('id', demoRequestId)

    if (updateError) {
      // Org + user are valid; surface the error but don't roll back the workspace.
      return NextResponse.json(
        { error: `Provisioned, but failed to update demo request: ${updateError.message}` },
        { status: 500 },
      )
    }

    const loginUrl =
      process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/auth/login`
        : 'https://assemblyai.net/auth/login'

    void sendProvisionNotificationEmail({
      company,
      firstName,
      lastName,
      email,
      tempPassword,
      loginUrl,
    })

    const payload: ProvisionResponse = {
      org_id: orgId,
      user_id: newUserId,
      temporary_password: tempPassword,
    }
    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/provision-client] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
