import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Self-service workspace creation is DISABLED. Accounts are created through an
// invitation link (/api/invite/accept), which associates the new user with an
// existing organization. This route now only resolves the org for an already
// provisioned user; it never creates a new organization.
export async function POST(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anon || !svcKey) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    const anonClient = createServerClient(url, anon, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    })

    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createClient(url, svcKey)
    const { data: existingUser } = await serviceClient
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (existingUser && typeof (existingUser as { org_id: string }).org_id === 'string') {
      return NextResponse.json({ orgId: (existingUser as { org_id: string }).org_id })
    }

    return NextResponse.json(
      { error: 'Your account is not associated with an organization. Please use an invitation link.' },
      { status: 403 },
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
