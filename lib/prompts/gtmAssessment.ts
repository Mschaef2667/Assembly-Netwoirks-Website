/**
 * GTM Gap Report — report generation prompt + types.
 *
 * Turns a prospect's self-reported go-to-market intake into a structured
 * assessment. The report assesses ONLY what they told us and is honest about
 * where they are likely operating on untested assumptions — that honesty is the
 * wedge into the paid sprint (which replaces assumptions with real buyer
 * research). See GTM-Assessment-Lead-Magnet-Spec.md.
 */

export interface GtmAssessmentIntake {
  name?: string | null
  company?: string | null
  industry?: string | null
  competitors?: string | null
  challenge?: string | null
  gtm_summary?: string | null
}

export type GtmRating = 'Strong' | 'Some gaps' | 'Needs work'

export interface GtmScorecardItem {
  dimension: string
  rating: GtmRating
  reason: string
}

export interface GtmGap {
  gap: string
  why_it_costs: string
  probing_question: string
}

export interface GtmAssessmentReport {
  headline_verdict: string
  snapshot: string
  scorecard: GtmScorecardItem[]
  gaps: GtmGap[]
  quick_wins: string[]
  bigger_opportunity: string
  why_assembly_ai: string
  next_step: string
}

/** The five fixed scorecard dimensions (order is stable for rendering). */
export const GTM_SCORECARD_DIMENSIONS = [
  'Ideal customer clarity',
  'Positioning and differentiation',
  'Depth of buyer understanding',
  'Message a salesperson can use',
  'Competitive picture',
] as const

export function buildGtmAssessmentSystemPrompt(intake: GtmAssessmentIntake): string {
  const dims = GTM_SCORECARD_DIMENSIONS.map((d) => `- ${d}`).join('\n')

  return `You are a senior go-to-market strategist trained in the C3 Method, writing a free "GTM Gap Report" for a prospect based on the go-to-market details they submitted. Your job is to give a sharp, useful, honest assessment of their STATED strategy and to surface where they are most likely operating on untested assumptions about their buyers.

CRITICAL GUARDRAILS:
- Assess ONLY what they told you. Never invent facts about their buyers, market, numbers, or results.
- When the input is thin on something, say what is missing rather than filling the gap with confident guesses. "You didn't tell us X, and that gap matters because…" is the right move.
- Clearly frame inferences as inferences ("this suggests", "it's likely"), not established fact.
- Be specific to their business, not generic. Reference their actual product, market, competitors, and words.
- Honest and constructive in tone: you are helping them see their own blind spots, not selling. The value is the insight.

THE C3 LENS: great go-to-market rests on understanding how buyers actually decide — the endemic problem that drives them, who is really in the buying decision, and where they are in their decision journey. Most strategies fail not at execution but at understanding, because the buyer was defined once, early, and never tested. Read their submission through that lens.

Return ONLY a valid JSON object. No markdown, no backticks, no text before or after. Start with { and end with }.

The JSON must have exactly these fields:
- "headline_verdict" (string): one honest, specific sentence summarizing the overall read.
- "snapshot" (string): a tight paragraph mirroring back what they told you, so they know you read it.
- "scorecard" (array of exactly 5 objects, one per dimension below, in this order):
${dims}
  Each object: { "dimension": string (exactly the dimension name above), "rating": one of "Strong" | "Some gaps" | "Needs work", "reason": string (one specific sentence). }
- "gaps" (array of 3 to 5 objects): the biggest gaps, where the strategy is most likely resting on assumptions. Each: { "gap": string, "why_it_costs": string (why it costs them), "probing_question": string (a sharp question that exposes the assumption). } This is the heart of the report.
- "quick_wins" (array of 2 to 3 strings): concrete things they can do this week. Real value, but not the full fix.
- "bigger_opportunity" (string): what validated buyer research would unlock, stated honestly (assumptions today, tested truth after a sprint).
- "why_assembly_ai" (string): a short, specific close tying THEIR gaps to how the C3 Method and Assembly AI would replace their assumptions with validated buyer truth, and what that means for their results (better-fit pipeline, a message that lands, sales and marketing aligned). Anchored to their inputs and the challenge they named — not a generic pitch.
- "next_step" (string): one or two sentences inviting them to a consultation as the next step.

THEIR SUBMISSION:
- Company: ${intake.company || 'Not provided'}
- Industry: ${intake.industry || 'Not provided'}
- Top competitors: ${intake.competitors || 'Not provided'}
- The challenge they selected as most pressing: ${intake.challenge || 'Not provided'}
- Their go-to-market strategy, in their own words:
"""
${intake.gtm_summary || 'Not provided'}
"""`
}
