import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from '@/lib/auth/superAdmin'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/support-inbox
//
// Unified triage queue for the Support section of the master control panel.
// Reads from THREE eventual sources — beta_feedback, contact_submissions, and
// (future) feature_requests — and returns them as one normalized, newest-first
// list. Only beta_feedback is wired today; the other two are recognized shapes
// so the UI can render source filters against a stable contract before the data
// is there. Add them by extending loadContactItems / loadFeatureItems below.
// ─────────────────────────────────────────────────────────────────────────────

export type SupportSource = 'Feedback' | 'Contact' | 'Feature'
export type SupportStatus = 'open' | 'resolved'
export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'issue' | 'idea'

export interface SupportInboxItem {
  /** Globally unique across sources — synthesized as `${raw_table}:${raw_id}`. */
  id: string
  source: SupportSource
  from_name: string | null
  from_email: string | null
  from_org: string | null
  message: string | null
  /** Source-specific context. For Feedback, kind = feedback type. */
  context: {
    kind: FeedbackType | string | null
    page_url: string | null
    step_id: string | null
  }
  /** ISO timestamp — the row's created_at (or equivalent). */
  date: string
  status: SupportStatus
  /** The underlying row id + table, needed to route resolve/delete actions. */
  raw_id: string
  raw_table: 'beta_feedback' | 'contact_submissions' | 'feature_requests'
}

export interface SupportInboxCounts {
  total: number
  open: number
  resolved: number
  by_source: Record<SupportSource, number>
}

export interface SupportInboxResponse {
  items: SupportInboxItem[]
  counts: SupportInboxCounts
}

interface FeedbackRow {
  id: string
  org_id: string
  user_id: string
  page_url: string | null
  step_id: string | null
  type: string
  message: string | null
  created_at: string
  resolved_at: string | null
}

interface UserRow { id: string; email: string; first_name: string | null; last_name: string | null }
interface OrgRow  { id: string; name: string }

function displayName(u: UserRow | undefined): string | null {
  if (!u) return null
  const parts = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return parts || u.email || null
}

async function loadFeedbackItems(service: SupabaseClient): Promise<SupportInboxItem[]> {
  const { data: rows, error } = await service
    .from('beta_feedback')
    .select('id, org_id, user_id, page_url, step_id, type, message, created_at, resolved_at')
    .order('created_at', { ascending: false })
  if (error || !rows) return []

  const feedback = rows as unknown as FeedbackRow[]
  const userIds = Array.from(new Set(feedback.map(r => r.user_id).filter(Boolean)))
  const orgIds  = Array.from(new Set(feedback.map(r => r.org_id).filter(Boolean)))

  // Stitch user + org names in a second round trip — foreign-table joins via
  // PostgREST require configured relationships and add per-row overhead; two
  // batched queries are simpler and faster for an inbox this size.
  const [usersRes, orgsRes] = await Promise.all([
    userIds.length
      ? service.from('users').select('id, email, first_name, last_name').in('id', userIds)
      : Promise.resolve({ data: [] as UserRow[], error: null }),
    orgIds.length
      ? service.from('organizations').select('id, name').in('id', orgIds)
      : Promise.resolve({ data: [] as OrgRow[], error: null }),
  ])
  const userById = new Map<string, UserRow>()
  for (const u of ((usersRes.data ?? []) as UserRow[])) userById.set(u.id, u)
  const orgById  = new Map<string, OrgRow>()
  for (const o of ((orgsRes.data ?? []) as OrgRow[]))  orgById.set(o.id, o)

  return feedback.map((r): SupportInboxItem => {
    const u = userById.get(r.user_id)
    const o = orgById.get(r.org_id)
    return {
      id: `beta_feedback:${r.id}`,
      source: 'Feedback',
      from_name: displayName(u),
      from_email: u?.email ?? null,
      from_org: o?.name ?? null,
      message: r.message,
      context: {
        kind: r.type,
        page_url: r.page_url,
        step_id: r.step_id,
      },
      date: r.created_at,
      status: r.resolved_at ? 'resolved' : 'open',
      raw_id: r.id,
      raw_table: 'beta_feedback',
    }
  })
}

// Reserved for the next milestone — the shape is fixed so the UI can render
// against the same contract. When contact_submissions is wired, replace this
// with the real query.
async function loadContactItems(): Promise<SupportInboxItem[]> {
  return []
}

// Reserved for a future feature_requests table (Suggest a Feature persistence).
async function loadFeatureItems(): Promise<SupportInboxItem[]> {
  return []
}

export async function GET(): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const [feedback, contact, feature] = await Promise.all([
    loadFeedbackItems(auth.service),
    loadContactItems(),
    loadFeatureItems(),
  ])

  const items = [...feedback, ...contact, ...feature].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  const counts: SupportInboxCounts = {
    total: items.length,
    open: items.filter(i => i.status === 'open').length,
    resolved: items.filter(i => i.status === 'resolved').length,
    by_source: {
      Feedback: feedback.length,
      Contact: contact.length,
      Feature: feature.length,
    },
  }

  return NextResponse.json({ items, counts } satisfies SupportInboxResponse)
}
