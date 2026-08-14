import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildGtmAssessmentPdf } from '@/lib/reports/gtmAssessmentPdf'
import type { GtmAssessmentReport } from '@/lib/prompts/gtmAssessment'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/r/[token]/pdf
 * Public: returns the branded GTM Gap Report PDF for a valid token.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const { token } = await ctx.params
    if (!token || token.length < 16) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data, error } = await service
      .from('gtm_assessments')
      .select('company, industry, report_final, created_at')
      .eq('public_token', token)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rec = data as {
      company: string | null
      industry: string | null
      report_final: GtmAssessmentReport | null
      created_at: string | null
    } | null
    if (!rec || !rec.report_final) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const date = rec.created_at
      ? new Date(rec.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const pdf = await buildGtmAssessmentPdf(rec.report_final, {
      company: rec.company ?? 'Your Company',
      industry: rec.industry,
      date,
    })

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="GTM-Gap-Report.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
