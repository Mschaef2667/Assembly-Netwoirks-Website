import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { resend } from '@/lib/email/resend'
import type { GtmAssessmentReport } from '@/lib/prompts/gtmAssessment'

export const runtime = 'nodejs'

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * POST /api/admin/gtm-assessment/[id]/send
 * Super-admin only. Locks the current report as final, issues a public token,
 * emails the prospect a link to the hosted report, and marks the row sent.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params

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

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: meRow } = await service.from('users').select('is_super_admin').eq('id', user.id).maybeSingle()
    if (!meRow || !(meRow as { is_super_admin?: boolean }).is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: row, error } = await service
      .from('gtm_assessments')
      .select('name, email, company, report_final, report_draft, public_token')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    const rec = row as {
      name: string | null
      email: string | null
      company: string | null
      report_final: GtmAssessmentReport | null
      report_draft: GtmAssessmentReport | null
      public_token: string | null
    }

    const report = rec.report_final ?? rec.report_draft
    if (!report) return NextResponse.json({ error: 'No report to send. Generate one first.' }, { status: 400 })
    if (!rec.email) return NextResponse.json({ error: 'No recipient email on file.' }, { status: 400 })

    const token = rec.public_token ?? randomUUID().replace(/-/g, '')
    const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://assemblyai.net').replace(/\/$/, '')
    const url = `${base}/r/${token}`

    // Lock the sent version + issue token + mark sent.
    const { error: upErr } = await service
      .from('gtm_assessments')
      .update({
        report_final: report,
        public_token: token,
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    // Deliver the email.
    if (process.env.RESEND_API_KEY) {
      const firstName = escapeHtml((rec.name || '').split(' ')[0] || 'there')
      const html = `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#1a1a1a;font-size:15px;line-height:1.6;">
          <p>Hi ${firstName},</p>
          <p>Your GTM Gap Report is ready. It looks at the go-to-market strategy you shared and shows where it's strong and where it may be resting on untested assumptions about your buyers, along with a few quick wins.</p>
          <p style="margin:22px 0;">
            <a href="${escapeHtml(url)}" style="background:#0EA5E9;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Read your report</a>
          </p>
          <p>Want to talk it through? You can <a href="https://calendar.app.google/umNEpz7oxQAZYkzv6">book your free 30-minute GTM review here</a>.</p>
          <p>Best,<br>The Assembly Networks team</p>
        </div>`
      try {
        const { error: mailErr } = await resend.emails.send({
          from: 'Assembly AI <info@assemblynetworks.net>',
          to: rec.email,
          replyTo: 'info@assemblynetworks.net',
          subject: 'Your GTM Gap Report is ready',
          html,
        })
        if (mailErr) console.error('[gtm-assessment/send] resend failed:', mailErr)
      } catch (mailEx) {
        console.error('[gtm-assessment/send] resend error:', mailEx)
      }
    }

    return NextResponse.json({ ok: true, url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[gtm-assessment/send] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
