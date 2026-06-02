import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

interface ImportResponseRow {
  respondent_name?: string
  respondent_title?: string
  respondent_company?: string
  respondent_size?: string
  decision_role?: string
  answers: Record<string, string>
}

interface ImportBody {
  orgId: string
  audience: string
  segmentSlug: string
  segmentName: string
  responses: ImportResponseRow[]
  source?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const authClient = createServerClient(
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

    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: ImportBody
    try {
      body = (await req.json()) as ImportBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { orgId, audience, segmentSlug, segmentName, responses } = body
    if (!orgId || !audience || !segmentSlug || !segmentName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json({ error: 'No responses provided' }, { status: 400 })
    }

    const serviceRole = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Find or create a survey_link bucket for this audience/segment import
    const { data: existingLink } = await serviceRole
      .from('survey_links')
      .select('id')
      .eq('org_id', orgId)
      .eq('audience', audience)
      .eq('segment_slug', segmentSlug)
      .limit(1)
      .maybeSingle()

    let linkId: string
    if (existingLink) {
      linkId = (existingLink as Record<string, unknown>)['id'] as string
    } else {
      const { data: newLink, error: linkError } = await serviceRole
        .from('survey_links')
        .insert({
          org_id: orgId,
          segment_slug: segmentSlug,
          segment_name: segmentName,
          audience,
          questions: [],
          is_active: true,
        })
        .select('id')
        .single()
      if (linkError || !newLink) {
        return NextResponse.json({ error: 'Failed to create survey link' }, { status: 500 })
      }
      linkId = (newLink as Record<string, unknown>)['id'] as string
    }

    const rows = responses.map(r => ({
      survey_link_id: linkId,
      org_id: orgId,
      segment_slug: segmentSlug,
      audience,
      respondent_name: r.respondent_name ?? null,
      respondent_title: r.respondent_title ?? null,
      respondent_company: r.respondent_company ?? null,
      respondent_size: r.respondent_size ?? null,
      decision_role: r.decision_role ?? null,
      answers: r.answers ?? {},
      source: body.source ?? null,
      submitted_at: new Date().toISOString(),
    }))

    const { error: insertError } = await serviceRole
      .from('survey_link_responses')
      .insert(rows)

    if (insertError) {
      console.error('[import-responses] insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[import-responses] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
