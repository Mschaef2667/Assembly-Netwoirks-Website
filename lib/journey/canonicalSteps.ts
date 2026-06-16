// Canonical Journey step ids — the 38 integer steps 1..38.
//
// step_definition in Supabase has 40 rows: the 38 integer steps PLUS the
// sub-steps "3.5" and "4.5". Sub-steps are NOT counted toward Journey totals
// or the Performance Score step-completion band.
//
// step_output also accumulates non-step artefact rows (insights, dcp-map,
// competitive-discovery-17, survey-builder-*, etc). Anything that is not an
// integer "1".."38" must be excluded from progress counts.

// Sub-step ids that exist in step_definition but are excluded from
// Journey counts. Edit this list if more sub-steps are introduced.
const EXCLUDED_SUBSTEP_IDS = ['3.5', '4.5'] as const

function buildCanonicalIds(): Set<string> {
  const ids = new Set<string>()
  for (let i = 1; i <= 38; i++) ids.add(String(i))
  for (const sub of EXCLUDED_SUBSTEP_IDS) ids.delete(sub)
  return ids
}

export const canonicalStepIds: ReadonlySet<string> = buildCanonicalIds()

export const JOURNEY_TOTAL: number = canonicalStepIds.size

export function isJourneyStep(stepId: string): boolean {
  return canonicalStepIds.has(stepId)
}
