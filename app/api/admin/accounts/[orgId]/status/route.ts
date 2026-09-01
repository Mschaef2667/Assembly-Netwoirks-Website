import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/superAdmin'

export const runtime = 'nodejs'

// Allowed values match the org_status enum in the DB (baseline_schema.sql).
const ALLOWED_STATUSES = ['trial', 'active', 'suspended', 'churned'] as const
type AllowedStatus = (typeof ALLOWED_STATUSES)[number]

// POST /api/admin/accounts/[orgId]/status
// Super-admin gated. Updates organizations.status. Body: { status: AllowedStatus }.
// Only writes the status column (plus updated_at); no other fields are touched.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string }> },
): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  const svc = auth.service

  const { orgId } = await ctx.params
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  let body: { status?: string }
  try {
    body = (await req.json()) as { status?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status = body.status
  if (!status || !(ALLOWED_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  const { data, error } = await svc
    .from('organizations')
    .update({ status: status as AllowedStatus, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select('id, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const row = data as { id: string; status: string }
  return NextResponse.json({ id: row.id, status: row.status })
}
