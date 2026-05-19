import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/company-profile'

  if (code) {
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

    const { error: exchangeError } = await anonClient.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      const { data: { user } } = await anonClient.auth.getUser()

      if (user) {
        const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (serviceUrl && serviceKey) {
          const serviceClient = createClient(serviceUrl, serviceKey)

          const { data: existingUser } = await serviceClient
            .from('users')
            .select('org_id')
            .eq('id', user.id)
            .single()

          if (!existingUser) {
            const rawName = (user.user_metadata?.['workspace_name'] as string | undefined)?.trim()
            const workspaceName = rawName && rawName.length > 0
              ? rawName
              : (user.email?.split('@')[0] ?? 'My Workspace')

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

            if (!orgError && org) {
              const orgId = (org as { id: string }).id
              const { error: userError } = await serviceClient
                .from('users')
                .insert({ id: user.id, org_id: orgId, role: 'org_admin', email: user.email ?? '', is_active: true })

              if (userError) {
                await serviceClient.from('organizations').delete().eq('id', orgId)
              }
            }
          }
        }
      }

      return NextResponse.redirect(new URL(next, origin))
    }
  }

  return NextResponse.redirect(new URL('/auth/login?error=callback_failed', origin))
}
