// ── Confidence decay ──────────────────────────────────────────────────────────
//
// Rules:
//   - 1 point lost per 7 days since last_reviewed_at (falls back to created_at)
//   - Floor: 20 (never decays below 20)
//   - approved + null original_confidence → default base 80
//   - draft / pending_approval + null original_confidence → default base 50
//   - not_started → null (no confidence to decay)

export interface StepOutputForDecay {
  status: string
  original_confidence: number | null
  last_reviewed_at: string | null
  created_at: string
}

const DECAY_DAYS_PER_POINT = 7
const CONFIDENCE_FLOOR = 20

function statusDefault(status: string): number | null {
  if (status === 'approved') return 80
  if (status === 'draft' || status === 'pending_approval') return 50
  return null
}

export function calculateDecayedConfidence(
  output: StepOutputForDecay,
): number | null {
  if (output.status === 'not_started') return null

  const base = output.original_confidence ?? statusDefault(output.status)
  if (base === null) return null

  const referenceIso = output.last_reviewed_at ?? output.created_at
  const refMs = Date.parse(referenceIso)
  if (Number.isNaN(refMs)) return base

  const daysSince = (Date.now() - refMs) / (1000 * 60 * 60 * 24)
  const decayPoints = Math.max(0, Math.floor(daysSince / DECAY_DAYS_PER_POINT))

  return Math.max(CONFIDENCE_FLOOR, base - decayPoints)
}
