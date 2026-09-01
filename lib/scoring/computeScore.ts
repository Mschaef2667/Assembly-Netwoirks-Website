import { isJourneyStep, JOURNEY_TOTAL } from '@/lib/journey/canonicalSteps'

// Shared 0-100 performance-score calculator used by both the user dashboard
// (app/dashboard/page.tsx) and the admin account-detail view. Both surfaces
// call this same function against the same shape of inputs so the number
// a client sees is identical to what an admin sees for that account.

// ICP field lists — used to compute the ICP-completeness band (20 pts).
// Filled fields per ICP, over the 19 total fields × 3 ICPs baseline.
export const ICP_TEXT_FIELDS: readonly string[] = [
  'company_size_range', 'decision_making_power', 'budget_range', 'buying_motion',
  'buying_urgency_trigger', 'the_big_win', 'preferred_communication', 'buyer_values',
  'risk_sensitivities', 'tech_stack',
]

export const ICP_ARR_FIELDS: readonly string[] = [
  'job_titles', 'industry_verticals', 'primary_challenges', 'barriers_to_success',
  'success_metrics', 'buying_triggers', 'information_sources', 'purchase_criteria',
  'common_objections',
]

// Shape of a step_output row that computeScore cares about.
// Callers can pass any object that satisfies this — extra fields are ignored.
export interface ScoreStepOutput {
  step_id: string
  status: string
  original_confidence: number | null
}

// Shape of a dcp_analysis row (or null if none exists).
export interface ScoreDcpRow {
  status: string
  overall_confidence: number | null
}

// Breakdown returned to callers. `total` is the clamped 0-100 sum;
// the four band fields expose the sub-scores for UI rendering / debugging.
export interface ScoreBreakdown {
  total: number
  stepPts: number
  icpPts: number
  dcpPts: number
  qualityPts: number
}

/**
 * Compute the workspace's 0-100 performance score. Pure function, no I/O.
 *
 * Bands (all clamped to their max):
 *   Steps (40 pts): approved canonical journey steps / JOURNEY_TOTAL × 40
 *   ICP  (20 pts): filled ICP fields / (19 × 3) × 20
 *   DCP  (20 pts): dcp_analysis.overall_confidence / 100 × 20
 *   Quality (20 pts): mean original_confidence of approved canonical steps / 100 × 20
 */
export function computeScore(
  latestOutputs: Map<string, ScoreStepOutput>,
  icpRows: Array<Record<string, unknown>>,
  dcpRow: ScoreDcpRow | null,
): ScoreBreakdown {
  // Only canonical Journey steps (1..38, excluding 3.5) count toward step completion.
  // Non-canonical artefacts (insights, dcp-map, survey-builder-*, sub-steps) are filtered
  // out so they can never inflate the count past 38.
  const approved = Array.from(latestOutputs.values()).filter(
    s => s.status === 'approved' && isJourneyStep(s.step_id),
  )

  const stepPts = Math.min(40, Math.round((approved.length / JOURNEY_TOTAL) * 40))

  const totalIcpFields = (ICP_TEXT_FIELDS.length + ICP_ARR_FIELDS.length) * 3
  let filled = 0
  for (const icp of icpRows) {
    for (const f of ICP_TEXT_FIELDS) {
      if (typeof icp[f] === 'string' && (icp[f] as string).trim().length > 0) filled++
    }
    for (const f of ICP_ARR_FIELDS) {
      if (Array.isArray(icp[f]) && (icp[f] as unknown[]).length > 0) filled++
    }
  }
  const icpPts = totalIcpFields > 0 ? Math.round((filled / totalIcpFields) * 20) : 0

  const dcpPts = Math.round(((dcpRow?.overall_confidence ?? 0) / 100) * 20)

  const withConf = approved.filter(s => s.original_confidence !== null)
  const avgConf = withConf.length > 0
    ? withConf.reduce((sum, s) => sum + (s.original_confidence ?? 0), 0) / withConf.length
    : 0
  const qualityPts = Math.round((avgConf / 100) * 20)

  return {
    total: Math.min(100, stepPts + icpPts + dcpPts + qualityPts),
    stepPts, icpPts, dcpPts, qualityPts,
  }
}
