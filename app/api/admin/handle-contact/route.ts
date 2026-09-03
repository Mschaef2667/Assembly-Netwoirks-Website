import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/superAdmin'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/handle-contact
//
// Mirrors /api/admin/resolve-feedback, but for the two "inbound message" tables
// in the Support inbox: contact_submissions and feature_requests. Sets
// handled_at to now() when body.handled is true (default), or clears it when
// false so an item can be reopened. Super-admin gated via the shared
// requireSuperAdmin() helper.
//
// body: { id, handled?, table? }
//   table defaults to 'contact_submissions' for backward compatibility with the
//   inbox client before feature_requests wiring landed.
// ─────────────────────────────────────────────────────────────────────────────

type HandleTable = 'contact_submissions' | 'feature_requests'
const ALLOWED_TABLES: readonly HandleTable[] = ['contact_submissions', 'feature_requests']

interface HandleBody {
  id?: string
  handled?: boolean
  table?: string
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

  const table: HandleTable =
    body.table && (ALLOWED_TABLES as readonly string[]).includes(body.table)
      ? (body.table as HandleTable)
      : 'contact_submissions'

  const handled = body.handled ?? true
  const { error } = await auth.service
    .from(table)
    .update({ handled_at: handled ? new Date().toISOString() : null })
    .eq('id', body.id)

  if (error) {
    console.error(`[api/admin/handle-contact] update error on ${table}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
