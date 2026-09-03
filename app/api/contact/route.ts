import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'
import { verifyTurnstile } from '@/lib/security/turnstile'

interface ContactBody {
  turnstileToken?: string
  name?: string
  email?: string
  company?: string
  message?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

interface ContactRecord {
  name: string | null
  email: string
  company: string | null
  message: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendNotificationEmail(record: ContactRecord): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[api/contact] RESEND_API_KEY not set; skipping notification email.')
    return
  }

  const name = record.name ?? '—'
  const company = record.company ?? '—'
  const date = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })

  const html = `
    <h2 style="font-family: Helvetica, Arial, sans-serif; color:#0A1628;">New Contact Submission</h2>
    <table style="font-family: Helvetica, Arial, sans-serif; font-size:14px; color:#0D0D0D; border-collapse: collapse;">
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Name</td><td>${escapeHtml(name)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Email</td><td>${escapeHtml(record.email)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Company</td><td>${escapeHtml(company)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280; vertical-align:top;">Message</td><td style="white-space:pre-wrap;">${escapeHtml(record.message ?? '—')}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Date</td><td>${escapeHtml(date)}</td></tr>
    </table>
  `

  try {
    const { error } = await resend.emails.send({
      from: 'Assembly AI <info@assemblynetworks.net>',
      to: 'mschaef@gmail.com',
      subject: `New Contact Submission - ${company} - ${name}`,
      html,
    })
    if (error) {
      console.error('[api/contact] resend failed:', error)
    }
  } catch (err) {
    console.error('[api/contact] resend error:', err)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: ContactBody
  try {
    body = (await req.json()) as ContactBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name     = clean(body.name, 200)
  const emailRaw = clean(body.email, 254)
  const company  = clean(body.company, 200)
  const message  = clean(body.message, 5000)

  if (!emailRaw) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }
  const email = emailRaw.toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const ip = clientIp(req)

  // Bot check before anything is written or emailed. Skipped automatically when
  // TURNSTILE_SECRET_KEY is not configured, so this is safe to deploy first.
  const captcha = await verifyTurnstile(body.turnstileToken, ip)
  if (!captcha.ok) {
    console.warn('[api/contact] turnstile rejected:', captcha.reason)
    return NextResponse.json(
      { error: 'We could not verify that you are human. Please reload the page and try again.' },
      { status: 400 },
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error: insertError } = await supabase
    .from('contact_submissions')
    .insert({
      name,
      email,
      company,
      message,
      ip_address: ip,
    })

  if (insertError) {
    console.error('[api/contact] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to send your message. Please try again.' }, { status: 500 })
  }

  const record: ContactRecord = { name, email, company, message }
  // AWAIT THESE. Do not switch back to fire-and-forget `void`.
  //
  // On Vercel the runtime may suspend a serverless function the moment it sends
  // its response, killing any in-flight work. A `void`-ed promise here is a
  // coin flip: sometimes the email lands, sometimes it is silently dropped and
  // the submission only ever exists in Supabase.
  //
  // sendNotificationEmail swallows its own errors and never rejects, so awaiting
  // it cannot fail the request. allSettled preserves the shape used by
  // /api/demo and /api/whitepaper/download so the next contributor to add a
  // side-effect (e.g. Notion mirror) can slot it in without changing the wrapper.
  await Promise.allSettled([
    sendNotificationEmail(record),
  ])

  return NextResponse.json({ ok: true })
}
