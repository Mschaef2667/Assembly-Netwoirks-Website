import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { workspaceName?: string }
    const rawName = (
      body.workspaceName ||
      (user.user_metadata?.['workspace_name'] as string | undefined) ||
      user.email?.split('@')[0] ||
      'My Workspace'
    ).trim()
    const workspaceName = rawName.length > 0 ? rawName : 'My Workspace'

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    const serviceClient = createClient(serviceUrl, serviceKey)

    // Idempotent — return existing org if already provisioned
    const { data: existingUser } = await serviceClient
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (existingUser && typeof (existingUser as { org_id: string }).org_id === 'string') {
      return NextResponse.json({ orgId: (existingUser as { org_id: string }).org_id })
    }

    const slug = workspaceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 44)
    const uniqueSlug = `${slug}-${user.id.slice(0, 6)}`

    const { data: org, error: orgError } = await serviceClient
      .from('organizations')
      .insert({ name: workspaceName, slug: uniqueSlug, status: 'active' })
      .select('id')
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: orgError?.message ?? 'Failed to create organization' },
        { status: 500 }
      )
    }

    const orgId = (org as { id: string }).id

    const { error: userError } = await serviceClient
      .from('users')
      .insert({ id: user.id, org_id: orgId, role: 'org_admin', email: user.email ?? '', is_active: true })

    if (userError) {
      await serviceClient.from('organizations').delete().eq('id', orgId)
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    return NextResponse.json({ orgId })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
