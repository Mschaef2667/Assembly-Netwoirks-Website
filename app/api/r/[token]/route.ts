import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { GtmAssessmentReport } from '@/lib/prompts/gtmAssessment'

export const runtime = 'nodejs'

/**
 * GET /api/r/[token]
 * Public (no auth): returns the hosted GTM Gap Report for a valid token.
 * The token is an unguessable UUID; access is scoped to a single row via the
 * service-role client. Only non-sensitive fields are returned.
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
      .select('company, industry, report_final, status')
      .eq('public_token', token)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rec = data as { company: string | null; industry: string | null; report_final: GtmAssessmentReport | null; status: string } | null
    if (!rec || !rec.report_final) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ company: rec.company, industry: rec.industry, report: rec.report_final })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
