import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

interface GenerateLinkBody {
  orgId: string
  audience: string
  segmentSlug: string
  segmentName: string
  questions: Array<{
    id: string
    stageId: number
    stageName: string
    text: string
    type: string
  }>
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleGenerateLink(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[survey-builder/generate-link] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleGenerateLink(req: NextRequest): Promise<Response> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: GenerateLinkBody
  try {
    body = (await req.json()) as GenerateLinkBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orgId, audience, segmentSlug, segmentName, questions } = body
  if (!orgId || !audience || !segmentSlug || !segmentName) {
    return NextResponse.json({ error: 'orgId, audience, segmentSlug, and segmentName are required' }, { status: 400 })
  }

  const serviceRole = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await serviceRole
    .from('survey_links')
    .insert({
      org_id: orgId,
      segment_slug: segmentSlug,
      segment_name: segmentName,
      audience,
      questions: questions ?? [],
      is_active: true,
    })
    .select('token, id')
    .single()

  if (error || !data) {
    console.error('[generate-link] insert error:', error)
    return NextResponse.json({ error: error?.message ?? 'Failed to create link' }, { status: 500 })
  }

  const { count: responseCount } = await serviceRole
    .from('survey_link_responses')
    .select('id', { count: 'exact', head: true })
    .eq('survey_link_id', data.id)

  return NextResponse.json({
    token: data.token,
    url: `https://assemblyai.net/survey/${data.token}`,
    responseCount: responseCount ?? 0,
  })
}
