import { createBrowserClient } from '@supabase/ssr'

// ── Table types ───────────────────────────────────────────────────────────────

export type StepStatus = 'draft' | 'pending_approval' | 'approved'

export interface StepOutput {
  id: string
  workspace_id: string
  step_id: string
  version: number
  status: StepStatus
  content: Record<string, unknown>
  copilot_assisted: boolean
  last_saved_at: string
  last_updated_at: string
  last_reviewed_at: string | null
  original_confidence: number | null
  last_updated_by: string | null
}

export type StepOutputInsert = {
  id?: string
  workspace_id: string
  step_id: string
  version: number
  status: StepStatus
  content: Record<string, unknown>
  copilot_assisted: boolean
  last_saved_at: string
  last_updated_at: string
  last_reviewed_at?: string | null
  original_confidence?: number | null
  last_updated_by?: string | null
}

export type StepOutputUpdate = {
  content?: Record<string, unknown>
  last_saved_at?: string
  last_updated_at?: string
  status?: StepStatus
  version?: number
}

export interface AssemblyUser {
  id: string
  org_id: string
  role: 'admin' | 'contributor' | 'approver'
  email: string
}

// ── Client ────────────────────────────────────────────────────────────────────
// Untyped client — explicit type assertions on query results keep the code
// fully typed without fighting supabase-js Database generic compatibility.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Do NOT throw at module load. A hard throw here crashes the whole build (during
// Next.js "collecting page data") for any deployment that happens to lack these
// vars — e.g. a throwaway preview build on a project that only sets them for its
// Production environment. Real deployments inline the real values at build time,
// so this only affects builds that were never going to run anyway. Fall back to
// harmless placeholders (a valid-looking URL so the client constructor doesn't
// throw) and log a warning instead.
if (!url || !key) {
  console.warn(
    '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Using placeholders — this build will not connect to Supabase at runtime.'
  )
}

export const supabase = createBrowserClient(
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder-anon-key',
)
