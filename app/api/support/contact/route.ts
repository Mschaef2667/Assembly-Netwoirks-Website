import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { resend } from '@/lib/email/resend'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/support/contact
//
// In-app "Contact Us" for AUTHENTICATED users on the dashboard Support page.
// This is deliberately separate from the public /api/contact route:
//   - No Turnstile (the user is already signed in).
//   - Identity comes from the session, not the request body — the client only
//     needs to send the message text. Name/email/company are pulled from the
//     users row + organization the caller belongs to, which prevents spoofing.
//   - Writes to the same contact_submissions table via the service-role client
//     so the write bypasses RLS (table is RLS-enabled with no policies, matching
//     the demo_requests / whitepaper_leads pattern).
// ─────────────────────────────────────────────────────────────────────────────

interface ContactBody {
  message?: string
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() || null
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface SubmissionRecord {
  name: string | null
  email: string
  company: string | null   // storing the user's org name here — matches how the public form uses "company"
  message: string
}

async function sendNotificationEmail(record: SubmissionRecord): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[api/support/contact] RESEND_API_KEY not set; skipping notification email.')
    return
  }

  const name = record.name ?? '—'
  const company = record.company ?? '—'
  const date = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })

  const html = `
    <h2 style="font-family: Helvetica, Arial, sans-serif; color:#0A1628;">New Contact Us submission (in-app)</h2>
    <table style="font-family: Helvetica, Arial, sans-serif; font-size:14px; color:#0D0D0D; border-collapse: collapse;">
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Name</td><td>${escapeHtml(name)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Email</td><td>${escapeHtml(record.email)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Workspace</td><td>${escapeHtml(company)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280; vertical-align:top;">Message</td><td style="white-space:pre-wrap;">${escapeHtml(record.message)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Date</td><td>${escapeHtml(date)}</td></tr>
    </table>
  `

  try {
    const { error } = await resend.emails.send({
      from: 'Assembly AI <info@assemblynetworks.net>',
      to: 'support@assemblynetworks.net',
      subject: `New Contact Us submission from ${name}`,
      html,
    })
    if (error) {
      console.error('[api/support/contact] resend failed:', error)
    }
  } catch (err) {
    console.error('[api/support/contact] resend error:', err)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  // ── Auth: session-cookie-based, not a super-admin check. Any signed-in user. ──
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => { for (const { name, value, options } of toSet) cookieStore.set(name, value, options) },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Body ──
  let body: ContactBody
  try {
    body = (await req.json()) as ContactBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = clean(body.message, 5000)
  if (!message) return NextResponse.json({ error: 'Please write a message.' }, { status: 400 })

  // ── Resolve identity from the session, not the client payload ──
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: me } = await service
    .from('users')
    .select('id, email, first_name, last_name, org_id')
    .eq('id', user.id)
    .maybeSingle()
  const meRow = (me ?? null) as { id: string; email: string; first_name: string | null; last_name: string | null; org_id: string | null } | null

  const emailFromSession = user.email ?? null
  const email = meRow?.email ?? emailFromSession
  if (!email) return NextResponse.json({ error: 'Your account has no email on file.' }, { status: 400 })

  const name = meRow
    ? [meRow.first_name, meRow.last_name].filter(Boolean).join(' ').trim() || email
    : email

  let orgName: string | null = null
  if (meRow?.org_id) {
    const { data: org } = await service.from('organizations').select('name').eq('id', meRow.org_id).maybeSingle()
    orgName = (org as { name?: string } | null)?.name ?? null
  }

  const ip = clientIp(req)

  // ── Save to contact_submissions (service role, matches RLS: enabled, no policies) ──
  const { error: insertError } = await service
    .from('contact_submissions')
    .insert({
      name,
      email,
      company: orgName,
      message,
      ip_address: ip,
    })

  if (insertError) {
    console.error('[api/support/contact] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to send your message. Please try again.' }, { status: 500 })
  }

  const record: SubmissionRecord = { name, email, company: orgName, message }
  // AWAIT THIS. Do not switch back to fire-and-forget `void`.
  //
  // On Vercel the runtime may suspend a serverless function the moment it sends
  // its response, killing any in-flight work. sendNotificationEmail swallows its
  // own errors and never rejects, so awaiting it cannot fail the request; a
  // Resend outage still leaves the row saved in Supabase — the DB save is the
  // safety net, the email is a bonus.
  await Promise.allSettled([
    sendNotificationEmail(record),
  ])

  return NextResponse.json({ ok: true })
}
