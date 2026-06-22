// Single source of truth for the 7 stages of the C3 Decision Clarity Process.
// Consumed by the DecisionJourneyVisual explainer component.
//
// Existing inline copies of a 7-stage list live in:
//   - app/api/intelligence/analyze-dcp/route.ts
//   - app/api/intelligence/analyze/route.ts
//   - app/dashboard/intelligence/dcp-map/page.tsx
// Those will be consolidated to this file in a follow-up pass — left alone for
// now to keep the scope of this change to the explainer component.

export interface DecisionStage {
  number: number
  name: string
  description: string
}

export const DECISION_STAGES: DecisionStage[] = [
  { number: 1, name: 'Need',         description: 'The buyer realizes something is missing or could be better.' },
  { number: 2, name: 'Trigger',      description: 'Something happens that turns the need into a reason to act now.' },
  { number: 3, name: 'Search',       description: 'They start looking for possible ways to solve it.' },
  { number: 4, name: 'Evaluation',   description: 'They compare options against what matters to them.' },
  { number: 5, name: 'Select Set',   description: 'They narrow to a short list of real contenders.' },
  { number: 6, name: 'Decision',     description: 'They choose, and justify the choice to themselves and others.' },
  { number: 7, name: 'Confirmation', description: 'They look for reassurance they made the right call.' },
]
