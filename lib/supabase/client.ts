import { createClient } from '@supabase/supabase-js'

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

if (!url || !key) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Copy .env.local.example to .env.local and fill in your Supabase credentials.'
  )
}

export const supabase = createClient(url, key)
