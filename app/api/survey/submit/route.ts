import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface SubmitBody {
  token: string
  respondentName?: string
  respondentTitle?: string
  respondentCompany?: string
  respondentSize?: string
  decisionRole?: string
  answers: Record<string, string>
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: SubmitBody
    try {
      body = (await req.json()) as SubmitBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { token, respondentName, respondentTitle, respondentCompany, respondentSize, decisionRole, answers } = body

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    const serviceRole = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: link, error: linkError } = await serviceRole
      .from('survey_links')
      .select('id, org_id, segment_slug, audience, is_active')
      .eq('token', token)
      .single()

    if (linkError || !link) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    if (!link.is_active) {
      return NextResponse.json({ error: 'This survey link is no longer active' }, { status: 410 })
    }

    const { data: org } = await serviceRole
      .from('organizations')
      .select('industry')
      .eq('id', link.org_id)
      .single()

    const { error: insertError } = await serviceRole
      .from('survey_link_responses')
      .insert({
        survey_link_id: link.id,
        org_id: link.org_id,
        segment_slug: link.segment_slug,
        audience: link.audience,
        respondent_name: respondentName ?? null,
        respondent_title: respondentTitle ?? null,
        respondent_company: respondentCompany ?? null,
        respondent_size: respondentSize ?? null,
        respondent_industry: org?.industry ?? null,
        decision_role: decisionRole ?? null,
        answers: answers ?? {},
      })

    if (insertError) {
      console.error('[survey/submit] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[survey/submit] unhandled error:', message)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
