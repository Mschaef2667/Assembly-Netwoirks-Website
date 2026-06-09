import type { PromptContext } from './types'

export function buildImprovePrompt(ctx: PromptContext): string {
  return `You are Assembly AI Copilot. Your task is to improve the following draft — make it more specific, more compelling, and tighter. Do not change the core meaning or add new claims not supported by the context. Remove generic language. Strengthen the buyer outcome. Keep the same length or shorter. Return the same JSON format with an improved draft field.

DRAFT TO IMPROVE:
${ctx.currentContent || '(empty — nothing to improve)'}

Return ONLY valid JSON (no markdown fences, no prose) with this exact shape:
{
  "draft": "<improved draft>",
  "confidence": <integer 0-100>,
  "sources": [],
  "assumptions": [],
  "open_questions": [],
  "verification_checks": []
}`
}

export function buildGenericPrompt(ctx: PromptContext): string {
  const { stepTitle, stepDescription, currentContent, extraContext, contextPacket } = ctx

  const prerequisiteBlock = contextPacket.prerequisites.length > 0
    ? contextPacket.prerequisites.map(p =>
        `### Step ${p.step_id} (hop ${p.hop_distance}, status: ${p.status})\n${JSON.stringify(p.content, null, 2)}`
      ).join('\n\n')
    : 'No prerequisites available.'

  const missingBlock = contextPacket.missing_prerequisites.length > 0
    ? `Missing prerequisite steps: ${contextPacket.missing_prerequisites.join(', ')}`
    : ''

  const provNote = contextPacket.is_provisional
    ? 'NOTE: Some prerequisite data is not yet approved — treat this draft as provisional.'
    : ''

  return `You are Assembly AI Copilot, an expert B2B go-to-market strategist.

You are helping complete Step: "${stepTitle}"
Description: ${stepDescription || 'No description provided.'}

PREREQUISITE CONTEXT (upstream step outputs):
${prerequisiteBlock}

${missingBlock}
${provNote}

CURRENT CONTENT (what the user has written so far):
${currentContent || '(empty — generate a first draft)'}

Your task: produce a structured JSON response for this step. Return ONLY valid JSON (no markdown fences, no prose) with this exact shape:
{
  "draft": "<the proposed content as a plain string>",
  "confidence": <integer 0-100>,
  "sources": ["<step_id or label used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

Confidence scoring:
- 71-100: all required prerequisites present and approved, draft is well-grounded
- 41-70: some prerequisites missing or unapproved, draft involves assumptions
- 0-40: major prerequisites missing, draft is highly speculative

Be specific, actionable, and grounded in the prerequisite data. Do not hallucinate facts not present in the context. Draft directly — do not ask the user for more information.${extraContext ? `\n\n${extraContext}` : ''}`
}
