import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface AgreeBody {
  user_id?: string
  org_id?: string
  agreement_version?: string
}

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

    let body: AgreeBody
    try {
      body = (await req.json()) as AgreeBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
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
    const agreementVersion = body.agreement_version || 'beta-v1'

    const forwardedFor = req.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip') || null
    const userAgent = req.headers.get('user-agent') || null

    const { error: insertError } = await supabase
      .from('beta_agreements')
      .insert({
        user_id: user.id,
        org_id: orgId,
        agreement_version: agreementVersion,
        ip_address: ipAddress,
        user_agent: userAgent,
      })

    if (insertError) {
      console.error('[beta/agree] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to record agreement' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[beta/agree] unhandled error:', message)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
