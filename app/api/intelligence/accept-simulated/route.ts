import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

interface SimulatedRespondent {
  name?: string
  title?: string
  company?: string
  company_size?: string
  decision_role?: string
}

interface AcceptBody {
  respondent: SimulatedRespondent
  answers: Record<string, string>
  audience: string
  segmentSlug: string
  segmentName?: string
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

    const { data: userRow } = await authClient
      .from('users').select('org_id').eq('id', user.id).single()
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const orgId = String((userRow as Record<string, unknown>)['org_id'] ?? '')

    let body: AcceptBody
    try {
      body = (await req.json()) as AcceptBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { respondent, answers, audience, segmentSlug } = body
    const segmentName = body.segmentName ?? segmentSlug
    if (!audience || !segmentSlug || !respondent || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serviceRole = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Find or create a survey_link for this audience/segment
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

    const { error: insertError } = await serviceRole
      .from('survey_link_responses')
      .insert({
        survey_link_id: linkId,
        org_id: orgId,
        segment_slug: segmentSlug,
        audience: 'simulated',
        respondent_name: respondent.name ?? null,
        respondent_title: respondent.title ?? null,
        respondent_company: respondent.company ?? null,
        respondent_size: respondent.company_size ?? null,
        decision_role: respondent.decision_role ?? null,
        answers: answers ?? {},
        source: 'simulated',
        submitted_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('[accept-simulated] insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[accept-simulated] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
