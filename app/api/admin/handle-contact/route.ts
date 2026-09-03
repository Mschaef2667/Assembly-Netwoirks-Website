import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/superAdmin'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/handle-contact
//
// Mirrors /api/admin/resolve-feedback, but for contact_submissions. Sets
// handled_at to now() when body.handled is true (default), or clears it when
// false so an item can be reopened in the Support inbox. Super-admin gated via
// the shared requireSuperAdmin() helper.
// ─────────────────────────────────────────────────────────────────────────────

interface HandleBody {
  id?: string
  handled?: boolean
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  let body: HandleBody
  try {
    body = (await req.json()) as HandleBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const handled = body.handled ?? true
  const { error } = await auth.service
    .from('contact_submissions')
    .update({ handled_at: handled ? new Date().toISOString() : null })
    .eq('id', body.id)

  if (error) {
    console.error('[api/admin/handle-contact] update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
