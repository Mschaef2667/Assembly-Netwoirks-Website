import { provisionalNote, stepText, type PromptContext } from './types'

// Steps 17-26 — only Step 17 has a custom prompt; 18-26 fall through to the generic builder.
export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { currentContent, extraContext } = ctx

  if (stepId === '17') {
    const step1Text = stepText(ctx, '1')
    const step2Text = stepText(ctx, '2')
    const step4Text = stepText(ctx, '4')
    const step11Text = stepText(ctx, '11')
    const step13Text = stepText(ctx, '13')

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write a structured competitive analysis for Step 17 — Target Competition.

For each competitor relevant to this company, produce:
1. Competitor name and category (direct / indirect / status quo)
2. Positioning angle: how they position themselves to the same buyer
3. Key differentiator: the single most important way this company wins against them
4. Vulnerability: the competitor's most exploitable weakness given this company's CVP and KSPs

The analysis must be grounded in the company's specific CVP and Key Selling Points. Do not produce a generic competitor overview — every differentiator and vulnerability must trace back to something specific in the context below.

RULES:
- Analyse 3-5 competitors. If fewer are evident from context, surface 3 minimum (include 'status quo / do nothing' as a competitor type if needed).
- Each competitor entry is a structured object, not prose.
- Do not invent competitor names not supported by the context. If competitor names are unknown, describe competitor archetypes (e.g. 'Large ERP vendor', 'Spreadsheet-based approach').
- Do not use the words 'revolutionary', 'cutting-edge', 'game-changing', 'leverage', 'empower', or 'unlock'.

CONFIDENCE SCORING:
- 71-100: Company profile, CVP, and KSPs all present; competitor names or archetypes are identifiable from context
- 41-70: CVP or KSPs missing; analysis relies more heavily on company profile and endemic problem
- 0-40: Minimal context; analysis is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<structured competitor analysis as readable prose, one paragraph per competitor, each starting with the competitor name/category>",
  "competitors": [
    {
      "name": "<competitor name or archetype>",
      "category": "<direct | indirect | status quo>",
      "positioning_angle": "<how they position to the same buyer>",
      "key_differentiator": "<how this company wins against them>",
      "vulnerability": "<their most exploitable weakness>"
    }
  ],
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer to sharpen the analysis>"],
  "verification_checks": ["<factual claim to verify>"]
}

STEP 1 — Company Profile:
${step1Text}

STEP 2 — Product / Service Description:
${step2Text}

STEP 4 — Endemic Problem (shared buyer pain):
${step4Text}

STEP 11 — Compelling Value Proposition:
${step11Text}

STEP 13 — Key Selling Points:
${step13Text}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}${currentContent ? `\nCURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  return ''
}
