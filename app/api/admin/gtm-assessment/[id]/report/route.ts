import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { buildGtmAssessmentPdf } from '@/lib/reports/gtmAssessmentPdf'
import type { GtmAssessmentReport } from '@/lib/prompts/gtmAssessment'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/admin/gtm-assessment/[id]/report?inline=1
 * Renders the branded GTM Gap Report PDF from the saved report
 * (report_final if present, else report_draft). Super-admin only.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params

    // Auth: super admin only
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
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
    const { data: meRow } = await service.from('users').select('is_super_admin').eq('id', user.id).maybeSingle()
    if (!meRow || !(meRow as { is_super_admin?: boolean }).is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: row, error } = await service
      .from('gtm_assessments')
      .select('company, industry, report_final, report_draft, created_at')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    const rec = row as {
      company: string | null
      industry: string | null
      report_final: GtmAssessmentReport | null
      report_draft: GtmAssessmentReport | null
      created_at: string | null
    }

    const report = rec.report_final ?? rec.report_draft
    if (!report) return NextResponse.json({ error: 'No report generated yet' }, { status: 400 })

    const date = rec.created_at
      ? new Date(rec.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const pdf = await buildGtmAssessmentPdf(report, {
      company: rec.company ?? 'Your Company',
      industry: rec.industry,
      date,
    })

    const inline = req.nextUrl.searchParams.get('inline') === '1'
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="GTM-Gap-Report.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[gtm-assessment/report] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
