import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * GET   /api/admin/gtm-assessment/[id]  — load one assessment (intake + report).
 * PATCH /api/admin/gtm-assessment/[id]  — save the edited report (report_final).
 * Super-admin only.
 */

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Returns null when the caller is a super admin, or a Response to return otherwise. */
async function superAdminGuard(): Promise<Response | null> {
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

  const { data: meRow } = await serviceClient()
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!meRow || !(meRow as { is_super_admin?: boolean }).is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params
    const denied = await superAdminGuard()
    if (denied) return denied

    const { data, error } = await serviceClient()
      .from('gtm_assessments')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    return NextResponse.json({ assessment: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params
    const denied = await superAdminGuard()
    if (denied) return denied

    let body: { report_final?: unknown }
    try {
      body = (await req.json()) as { report_final?: unknown }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (body.report_final === undefined) {
      return NextResponse.json({ error: 'report_final required' }, { status: 400 })
    }

    const { error } = await serviceClient()
      .from('gtm_assessments')
      .update({ report_final: body.report_final, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
