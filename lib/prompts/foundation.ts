import { provisionalNote, stepText, type PromptContext } from './types'

export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { currentContent, extraContext } = ctx

  if (stepId === '1') {
    return `You are a JSON generator. Return ONLY a valid JSON object starting with { and ending with }. No markdown, no prose, no explanation. Use this exact shape:
{
  "draft": "<2-3 paragraphs describing the company profile based on the search results provided>",
  "confidence": <integer 0-100>,
  "sources": ["<URL or source used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should verify>"],
  "verification_checks": ["<factual claim to verify>"]
}

The draft must be 2-3 paragraphs covering: what the company sells, who they sell to, primary use case or outcome delivered, key industries served, and what makes them different from alternatives. Write from the company's perspective using specific language from the search results. Do not use generic phrases.

Confidence scoring — apply these rules exactly based on what is present in the SEARCH RESULTS:
- Score 71-100: A company website was found AND specific product, service, or cause details, target customers, or differentiators were identified
- Score 41-70: A company website was found but product information is thin, vague, or generic
- Score 0-40: No company website was found, or the company could not be identified online`
  }

  if (stepId === '2') {
    const step1Text = stepText(ctx, '1')
    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Analyze the three target market segments defined for Step 2 and provide strategic insights for each.

For each segment provide:
- Why this segment is a strong fit based on the company profile
- The primary buying trigger that would cause this segment to seek a solution
- The biggest risk or challenge in selling to this segment
- One specific recommendation to strengthen the segment definition

OUTPUT FORMAT: Return ONLY valid JSON with no markdown fences:
{
  "draft": "<3 paragraphs, one per segment, each starting with the segment name in bold>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONFIDENCE: 71-100 if all 3 segments have name and industry defined, 41-70 if 1-2 segments defined, 0-40 if no segments defined.

STEP 1 — Company Profile (what the company sells):
${step1Text}
${provisionalNote(ctx)}
CURRENT CONTENT (segments the user has defined):
${currentContent || '(empty — no segments defined yet)'}
${extraContext ? `\nADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
  }

  if (stepId === '3') {
    const step1Text = stepText(ctx, '1')
    const step2Text = stepText(ctx, '2')
    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Analyze the key decision makers identified for each segment and provide strategic selling insights.

For each segment and decision maker provide:
- The most effective first message to get their attention based on their primary concerns
- The objection they are most likely to raise and how to overcome it
- The metric or outcome they care most about that Assembly AI should lead with

OUTPUT FORMAT: Return ONLY valid JSON with no markdown fences:
{
  "draft": "<organized by segment, each decision maker on its own line with their name and key insight>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONFIDENCE: 71-100 if decision makers have roles and primary concerns defined, 41-70 if partial, 0-40 if empty.

STEP 1 — Company Profile (what the company sells):
${step1Text}

STEP 2 — Target Market Segments:
${step2Text}
${provisionalNote(ctx)}
CURRENT CONTENT (decision makers the user has defined):
${currentContent || '(empty — no decision makers defined yet)'}
${extraContext ? `\nADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
  }

  return ''
}
