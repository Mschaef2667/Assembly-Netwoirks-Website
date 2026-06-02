import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function DELETE(req: NextRequest): Promise<NextResponse> {
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

    let body: { responseId: string }
    try {
      body = (await req.json()) as { responseId: string }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { responseId } = body
    if (!responseId) {
      return NextResponse.json({ error: 'Missing responseId' }, { status: 400 })
    }

    const { data: userRow } = await authClient
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 403 })
    const orgId = (userRow as Record<string, unknown>)['org_id'] as string

    const serviceRole = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Verify the response belongs to the user's org before deleting
    const { data: existing, error: fetchError } = await serviceRole
      .from('survey_link_responses')
      .select('id')
      .eq('id', responseId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Response not found or access denied' }, { status: 404 })
    }

    const { error: deleteError } = await serviceRole
      .from('survey_link_responses')
      .delete()
      .eq('id', responseId)
      .eq('org_id', orgId)

    if (deleteError) {
      console.error('[delete-response] delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[delete-response] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
