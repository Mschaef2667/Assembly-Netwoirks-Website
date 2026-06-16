import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'

interface DemoBody {
  firstName?: string
  lastName?: string
  email?: string
  company?: string
  jobTitle?: string
  goals?: string
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

interface LeadRecord {
  firstName: string | null
  lastName: string | null
  email: string
  company: string | null
  jobTitle: string | null
  goals: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendNotificationEmail(lead: LeadRecord): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[api/demo] RESEND_API_KEY not set; skipping notification email.')
    return
  }

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'
  const company = lead.company ?? '—'
  const date = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })

  const html = `
    <h2 style="font-family: Helvetica, Arial, sans-serif; color:#0A1628;">New Demo Request</h2>
    <table style="font-family: Helvetica, Arial, sans-serif; font-size:14px; color:#0D0D0D; border-collapse: collapse;">
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Name</td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Email</td><td>${escapeHtml(lead.email)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Company</td><td>${escapeHtml(company)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Job Title</td><td>${escapeHtml(lead.jobTitle ?? '—')}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280; vertical-align:top;">Message</td><td style="white-space:pre-wrap;">${escapeHtml(lead.goals ?? '—')}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Date</td><td>${escapeHtml(date)}</td></tr>
    </table>
  `

  try {
    const { error } = await resend.emails.send({
      from: 'Assembly AI <info@assemblynetworks.net>',
      to: 'mschaef@gmail.com',
      subject: `New Demo Request - ${company} - ${fullName}`,
      html,
    })
    if (error) {
      console.error('[api/demo] resend failed:', error)
    }
  } catch (err) {
    console.error('[api/demo] resend error:', err)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: DemoBody
  try {
    body = (await req.json()) as DemoBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const firstName = clean(body.firstName, 80)
  const lastName  = clean(body.lastName, 80)
  const emailRaw  = clean(body.email, 254)
  const company   = clean(body.company, 200)
  const jobTitle  = clean(body.jobTitle, 200)
  const goals     = clean(body.goals, 2000)

  if (!firstName || !lastName || !emailRaw || !company || !jobTitle) {
    return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 })
  }

  const email = emailRaw.toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const ip = clientIp(req)
  const { error: insertError } = await supabase
    .from('demo_requests')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      company,
      job_title: jobTitle,
      goals,
      ip_address: ip,
    })

  if (insertError) {
    console.error('[api/demo] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save your request. Please try again.' }, { status: 500 })
  }

  const lead: LeadRecord = { firstName, lastName, email, company, jobTitle, goals }
  void sendNotificationEmail(lead)

  return NextResponse.json({ ok: true })
}
