import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Shared super-admin auth for admin API routes (Master Control Panel and others).
// The app gates on the `users.is_super_admin` boolean.

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export type SuperAdminResult =
  | { ok: true; userId: string; service: SupabaseClient }
  | { ok: false; response: NextResponse }

/**
 * Verifies the caller is a signed-in super admin.
 * On success returns the caller's userId and a service-role client.
 * On failure returns a 401/403 NextResponse to return from the route.
 */
export async function requireSuperAdmin(): Promise<SuperAdminResult> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options)
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const service = serviceClient()
  const { data: me } = await service.from('users').select('is_super_admin').eq('id', user.id).maybeSingle()
  if (!me || !(me as { is_super_admin?: boolean }).is_super_admin) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id, service }
}
