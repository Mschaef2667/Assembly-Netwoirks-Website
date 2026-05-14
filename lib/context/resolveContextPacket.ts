import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StepStatus = 'draft' | 'pending_approval' | 'approved'

export interface PrerequisiteContext {
  step_id: string
  content: Record<string, unknown>
  status: StepStatus
  version: number
  /** 1 = direct prerequisite of stepId; 2 = prerequisite of a prerequisite */
  hop_distance: 1 | 2
}

export interface ContextPacket {
  step_id: string
  workspace_id: string
  prerequisites: PrerequisiteContext[]
  /** step IDs whose step_output record is missing for this workspace */
  missing_prerequisites: string[]
  /** true if any prerequisite has status other than 'approved' */
  is_provisional: boolean
  /** total estimated token count after any trimming (char count / 4) */
  estimated_tokens: number
  /** true if indirect (hop 2) content was truncated to fit token budget */
  trimmed: boolean
}

// ── Internal types ────────────────────────────────────────────────────────────

interface StepDepRow {
  prerequisite_step_id: string
}

interface StepOutputRow {
  step_id: string
  content: Record<string, unknown>
  status: string
  version: number
}

// ── Fetcher abstraction (injectable for tests) ────────────────────────────────

export interface ContextFetcher {
  fetchDirectDeps(stepId: string): Promise<StepDepRow[]>
  fetchIndirectDeps(stepIds: string[]): Promise<StepDepRow[]>
  fetchOutputs(depIds: string[], workspaceId: string): Promise<StepOutputRow[]>
}

const defaultFetcher: ContextFetcher = {
  async fetchDirectDeps(stepId) {
    const { data } = await supabase
      .from('step_dependency')
      .select('prerequisite_step_id')
      .eq('step_id', stepId)
    return (data ?? []) as StepDepRow[]
  },

  async fetchIndirectDeps(stepIds) {
    if (stepIds.length === 0) return []
    const { data } = await supabase
      .from('step_dependency')
      .select('prerequisite_step_id')
      .in('step_id', stepIds)
    return (data ?? []) as StepDepRow[]
  },

  async fetchOutputs(depIds, workspaceId) {
    if (depIds.length === 0) return []
    const { data } = await supabase
      .from('step_output')
      .select('step_id, content, status, version')
      .eq('workspace_id', workspaceId)
      .in('step_id', depIds)
      .order('version', { ascending: false })
    return (data ?? []) as StepOutputRow[]
  },
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TOKENS = 3000
const INDIRECT_SUMMARY_CHARS = 300

// ── Helpers ───────────────────────────────────────────────────────────────────

function estimateTokens(content: Record<string, unknown>): number {
  return Math.ceil(JSON.stringify(content).length / 4)
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function resolveContextPacket(
  stepId: string,
  workspaceId: string,
  fetcher: ContextFetcher = defaultFetcher,
): Promise<ContextPacket> {
  // 1. Fetch direct prerequisites (hop 1)
  const directRows = await fetcher.fetchDirectDeps(stepId)
  const directDepIds = directRows.map(r => r.prerequisite_step_id)

  // 2. Fetch indirect prerequisites (hop 2) — deps-of-deps
  //    hopMap: step_id → minimum hop distance from stepId
  const hopMap = new Map<string, 1 | 2>()
  for (const id of directDepIds) {
    hopMap.set(id, 1)
  }

  const indirectRows = await fetcher.fetchIndirectDeps(directDepIds)
  for (const row of indirectRows) {
    const id = row.prerequisite_step_id
    if (!hopMap.has(id) && id !== stepId) {
      hopMap.set(id, 2)
    }
  }

  const allDepIds = Array.from(hopMap.keys())

  // 3. Fetch latest step_output per prerequisite
  //    The fetcher returns rows ordered version DESC; first occurrence per step_id = latest
  const outputRows = await fetcher.fetchOutputs(allDepIds, workspaceId)
  const latestByStep = new Map<string, StepOutputRow>()
  for (const row of outputRows) {
    if (!latestByStep.has(row.step_id)) {
      latestByStep.set(row.step_id, row)
    }
  }

  // 4. Build prerequisites list and collect missing / provisional flags
  const prerequisites: PrerequisiteContext[] = []
  const missing_prerequisites: string[] = []
  let is_provisional = false

  for (const [depId, hopDistance] of hopMap.entries()) {
    const row = latestByStep.get(depId)
    if (!row) {
      missing_prerequisites.push(depId)
      continue
    }

    if (row.status !== 'approved') {
      is_provisional = true
    }

    prerequisites.push({
      step_id: depId,
      content: row.content,
      status: row.status as StepStatus,
      version: row.version,
      hop_distance: hopDistance,
    })
  }

  // 5. Token budget — trim indirect prerequisites if over limit
  let totalTokens = prerequisites.reduce((sum, p) => sum + estimateTokens(p.content), 0)
  let trimmed = false

  if (totalTokens > MAX_TOKENS) {
    trimmed = true
    console.log(
      `[resolveContextPacket] step=${stepId} token estimate ${totalTokens} exceeds ${MAX_TOKENS}` +
      ` — trimming ${prerequisites.filter(p => p.hop_distance >= 2).length} indirect prerequisite(s)`,
    )

    for (const prereq of prerequisites) {
      if (prereq.hop_distance >= 2) {
        const summary = JSON.stringify(prereq.content).slice(0, INDIRECT_SUMMARY_CHARS)
        prereq.content = { _summary: summary, _trimmed: true }
      }
    }

    totalTokens = prerequisites.reduce((sum, p) => sum + estimateTokens(p.content), 0)
  }

  return {
    step_id: stepId,
    workspace_id: workspaceId,
    prerequisites,
    missing_prerequisites,
    is_provisional,
    estimated_tokens: totalTokens,
    trimmed,
  }
}
