import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { allowedCustomerCategory, categoryAppliesTo } from '@/lib/icp/customer-categories'

// Tag (or clear) a survey response's best-customer category.
//
// survey_link_responses has RLS with SELECT + INSERT policies but no UPDATE
// policy, so a direct client update is silently filtered to zero rows. This
// route mirrors delete-response: authenticate via the cookie session, confirm
// the row belongs to the user's org, then write with the service role.

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => { for (const { name, value, options } of toSet) cookieStore.set(name, value, options) },
        },
      },
    )

    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: { responseId?: string; category?: string | null }
    try {
      body = (await req.json()) as { responseId?: string; category?: string | null }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const responseId = typeof body.responseId === 'string' ? body.responseId : ''
    if (!responseId) return NextResponse.json({ error: 'Missing responseId' }, { status: 400 })

    // Empty/null clears the tag; otherwise it must be one of the known categories.
    const rawCategory = typeof body.category === 'string' ? body.category.trim() : ''
    const category = rawCategory ? allowedCustomerCategory(rawCategory) : null
    if (rawCategory && !category) {
      return NextResponse.json({ error: 'Unknown category' }, { status: 400 })
    }

    const { data: userRow } = await authClient.from('users').select('org_id').eq('id', user.id).single()
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 403 })
    const orgId = (userRow as Record<string, unknown>)['org_id'] as string

    const serviceRole = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Confirm the row is in the caller's org, and read its audience.
    const { data: existing, error: fetchError } = await serviceRole
      .from('survey_link_responses')
      .select('id, audience')
      .eq('id', responseId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'Response not found or access denied' }, { status: 404 })

    // Only current customers can carry a best-customer category. Clearing is
    // always allowed regardless of audience.
    const audience = (existing as Record<string, unknown>)['audience']
    if (category && !categoryAppliesTo(typeof audience === 'string' ? audience : '')) {
      return NextResponse.json({ error: 'Only current-customer responses can be categorized' }, { status: 400 })
    }

    const { error: updateError } = await serviceRole
      .from('survey_link_responses')
      .update({ customer_category: category })
      .eq('id', responseId)
      .eq('org_id', orgId)

    if (updateError) {
      console.error('[update-response-category] update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, category })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[update-response-category] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
