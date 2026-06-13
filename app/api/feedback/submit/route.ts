import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'issue' | 'idea'

interface SubmitBody {
  type: FeedbackType
  message?: string | null
  page_url?: string | null
  step_id?: string | null
}

const ALLOWED_TYPES: FeedbackType[] = ['thumbs_up', 'thumbs_down', 'issue', 'idea']

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: SubmitBody
    try {
      body = (await req.json()) as SubmitBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.type || !ALLOWED_TYPES.includes(body.type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userRow) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
    }

    const orgId = (userRow as { org_id: string }).org_id

    const { error: insertError } = await supabase
      .from('beta_feedback')
      .insert({
        org_id: orgId,
        user_id: user.id,
        page_url: body.page_url ?? null,
        step_id: body.step_id ?? null,
        type: body.type,
        message: body.message ?? null,
      })

    if (insertError) {
      console.error('[feedback/submit] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[feedback/submit] unhandled error:', message)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
