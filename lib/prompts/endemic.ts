import { DCP_RESEARCH_INSTRUCTION, provisionalNote, stepText, type PromptContext } from './types'

export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { currentContent, extraContext } = ctx

  if (stepId === '4') {
    const step1Text = stepText(ctx, '1')
    const step3Text = stepText(ctx, '3')
    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write Step 4 — The Problem — for this workspace.

The Problem is the endemic problem buyers experience in their market, independent of any vendor. It is a structural condition that exists whether or not the company's product exists. State it from the buyer's perspective.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<2-4 sentence endemic problem statement for THIS pain point>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": [],
  "verification_checks": ["<factual claim to verify>"]
}

RULES FOR THE DRAFT:
- Write 2-4 sentences, no more. Plain prose, no bullets, no questions, no placeholders.
- Write from the buyer's perspective — do not mention the company's product or solution.
- Draft directly from the available context below. Do not ask for more information.
- Be specific to the industry and buyer roles shown. Avoid generic statements.

PAIN POINTS — IMPORTANT:
- This call generates ONE pain point only, for the active tab. Return a single "draft" string for that pain point. Do NOT return multiple pain points.
- Step 4 captures up to three pain points across tabs, and each must be DISTINCT. Use the ADDITIONAL CONTEXT block below to determine which pain point (1, 2, or 3) you are writing for, and which other pain points already exist that you must NOT duplicate.
- The three pain points should cover different facets of the endemic problem. Use this framing as a guide for how they differ:
  • Pain Point 1 → the strategic/systemic problem
  • Pain Point 2 → the operational/execution problem
  • Pain Point 3 → the measurement/visibility problem
- Anchor this draft to the facet implied by the active pain point number, and explicitly differentiate it from the OTHER PAIN POINTS listed in the ADDITIONAL CONTEXT.

CONFIDENCE SCORING:
- 71-100: DCP Stage 1 and Stage 2 summaries are present and specific; company profile is complete
- 41-70: DCP stages present but thin, or company profile is partially complete
- 0-40: No DCP data available; draft is speculative from company profile alone

${DCP_RESEARCH_INSTRUCTION}

PRIMARY SOURCE — DCP Map, Stage 1 (Need Recognition):
${ctx.dcpStage1Summary || 'Not yet available — draft from company profile with low confidence.'}

PRIMARY SOURCE — DCP Map, Stage 2 (Motivation to Act):
${ctx.dcpStage2Summary || 'Not yet available — draft from company profile with low confidence.'}

SUPPORTING CONTEXT — Step 1 (What the company sells):
${step1Text}

SUPPORTING CONTEXT — Step 3 (Key decision makers):
${step3Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}${extraContext ? `\n\nADDITIONAL CONTEXT:\n${extraContext}` : ''}

In the "assumptions" array always include these four entries in addition to any data assumptions:
- "Step 5 (Root Cause) will refine the specific triggers and conditions that create this problem"
- "Step 6 (Effect) will surface the downstream business consequences if the problem goes unsolved"
- "Step 7 (Realization) will define the moment buyers recognise they have this problem"
- "Step 8 (Solution Criteria) will establish what an ideal resolution looks like to the buyer"`
  }

  if (stepId === '5' || stepId === '6' || stepId === '7' || stepId === '8' || stepId === '9') {
    const step1Text = stepText(ctx, '1')
    const step4Text = stepText(ctx, '4')

    const endemicConfig: Record<string, { name: string; focus: string; dcpLabel: string; dcpSummary: string }> = {
      '5': {
        name: 'The Cause',
        focus: 'The root causes that create the endemic problem from Step 4. What conditions, gaps, or triggers produce this problem in the buyer\'s world?',
        dcpLabel: 'DCP Map, Stage 1 (Need Recognition) — root causes and key signals',
        dcpSummary: ctx.dcpStage1Summary,
      },
      '6': {
        name: 'The Effect',
        focus: 'The downstream business consequences if the endemic problem is left unsolved — quantified where possible.',
        dcpLabel: 'DCP Map, Stage 2 (Motivation to Act) — consequences and key signals',
        dcpSummary: ctx.dcpStage2Summary,
      },
      '7': {
        name: 'The Realization',
        focus: 'The specific trigger moment when buyers recognize they have this problem and need to act.',
        dcpLabel: 'DCP Map, Stage 2 (Motivation to Act) — trigger moments',
        dcpSummary: ctx.dcpStage2Summary,
      },
      '8': {
        name: 'The Solution Criteria',
        focus: 'The evaluation signals and criteria buyers use to judge an ideal resolution to this problem.',
        dcpLabel: 'DCP Map, Stage 4 (Evaluation of Alternatives) — evaluation signals and key signals',
        dcpSummary: ctx.dcpStage4Summary,
      },
      '9': {
        name: 'The Search',
        focus: 'How buyers search for information and solutions — channels, sources, and information search patterns.',
        dcpLabel: 'DCP Map, Stage 3 (Information Search) — information search patterns and key signals',
        dcpSummary: ctx.dcpStage3Summary,
      },
    }
    const cfg = endemicConfig[stepId]!

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write Step ${stepId} — ${cfg.name} — for this workspace.

FOCUS: ${cfg.focus}

RULES FOR THE DRAFT:
- Write 2-4 sentences of plain prose, no bullets, no questions, no placeholders.
- Write from the buyer's perspective — do not mention the company's product or solution.
- Draft directly from the available context below. Do not ask for more information.
- Be specific to the industry and buyer roles shown. Avoid generic statements.

CONFIDENCE SCORING:
- 71-100: Relevant DCP stage summary is present and specific; Step 4 endemic problem is defined
- 41-70: DCP stage data is thin or Step 4 is partially defined
- 0-40: No DCP data available; draft is speculative

${DCP_RESEARCH_INSTRUCTION}

PRIMARY SOURCE — ${cfg.dcpLabel}:
${cfg.dcpSummary || 'Not yet available — draft from upstream context with low confidence. If Copilot struggles to populate from DCP data, the research may be incomplete.'}

SUPPORTING CONTEXT — Step 1 (What the company sells):
${step1Text}

SUPPORTING CONTEXT — Step 4 (The endemic Problem):
${step4Text}
${provisionalNote(ctx)}
OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<2-4 sentence ${cfg.name.toLowerCase()} statement>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}
${currentContent ? `\nCURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}${extraContext ? `\n\nADDITIONAL CONTEXT:\n${extraContext}` : ''}`
  }

  if (stepId === '10') {
    const step1Text = stepText(ctx, '1')
    const step4Text = stepText(ctx, '4')
    const step6Text = stepText(ctx, '6')
    const step8Text = stepText(ctx, '8')

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write The Formula for this pain point as a tight, direct promise. This is the bridge between problem understanding and solution positioning.

FORMULA: If you [specific solution from Step 8 -- keep it to one clear action], it will solve [specific problem from Step 4 -- one sentence max], thereby reducing [specific effect from Step 6 -- one concrete business consequence] on your business.

HARD CONSTRAINTS:
- Maximum 2 sentences total. No more.
- The solution clause must name the company or product specifically (pull the name from Step 1 / Company Profile).
- The problem clause must be specific to this pain point, not a generic restatement of the endemic problem.
- The effect clause must name a concrete business metric or outcome (pipeline, revenue, board confidence, win rate, deal velocity, retention, margin, etc.). Do not use abstract or emotional language.
- No run-on sentences. Use plain, direct language. Short clauses.
- Write it like a promise, not a description. Active voice. Confident tone.
- Never leave bracketed placeholders in the output. Replace every bracket with real content from Steps 1, 4, 6, and 8.
- Do not use the words 'revolutionary', 'cutting-edge', 'game-changing', 'leverage', 'empower', or 'unlock'.

CONFIDENCE SCORING:
- 71-100: Steps 4, 6, and 8 are all present and specific
- 41-70: One of Steps 4, 6, or 8 is thin or missing
- 0-40: Multiple primary sources missing, draft is speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<Formula statement, maximum 2 sentences>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

PAIN POINT BEING DRAFTED FOR:
${extraContext || 'No specific pain point provided.'}

PRIMARY SOURCE — Step 4 (The Problem):
${step4Text}

PRIMARY SOURCE — Step 6 (The Effect):
${step6Text}

PRIMARY SOURCE — Step 8 (The Solution Criteria):
${step8Text}

SUPPORTING CONTEXT — Step 1 (Company Profile):
${step1Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  return ''
}
