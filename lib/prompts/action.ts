import { provisionalNote, stepText, type PromptContext } from './types'

export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { currentContent, extraContext } = ctx

  if (stepId === '31') {
    const step3Text = stepText(ctx, '3')
    const step4Text = stepText(ctx, '4')
    const step5Text = stepText(ctx, '5')
    const step6Text = stepText(ctx, '6')
    const step7Text = stepText(ctx, '7')

    return `You are Assembly AI Copilot helping complete Step 31 — Create Opportunities of the C3 Method Strategic Plan.

FORMULA: What 3-4 specific actions can the company take to raise awareness of the causes (Step 5) and effects (Step 6) of each pain point (Step 4) in order to trigger a search for a solution by the key decision makers (Step 3)? Consider the realization triggers from Step 7.

INSTRUCTIONS:
Write 3-4 specific Create Opportunity actions for this pain point. These actions should raise awareness of the cause and effect of this pain point among the key decision makers, triggering them to start searching for a solution. Each action should:
- Name a specific tactic (content, outreach, event, partnership, etc.)
- Identify which decision maker it targets
- Explain how it surfaces the cause or effect
- Connect to the realization trigger from Step 7

Format the draft as a plain numbered list. No headers. No bold. No markdown. Maximum 200 words.

CONFIDENCE SCORING:
- 71-100: Steps 3, 4, 5, 6, 7 all present and approved
- 41-70: Some upstream context missing or unapproved
- 0-40: Major upstream context missing, plan is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-4 actions as a plain numbered list, max 200 words>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONTEXT FOR THIS PAIN POINT:
${extraContext || 'No specific pain point context provided.'}

STEP 3 — Key Decision Makers:
${step3Text}

STEP 4 — Endemic Problem:
${step4Text}

STEP 5 — The Cause:
${step5Text}

STEP 6 — The Effect:
${step6Text}

STEP 7 — The Realization:
${step7Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '32') {
    const step17Text = stepText(ctx, '17')
    const step18Text = stepText(ctx, '18')
    const step19Text = stepText(ctx, '19')
    const step27Text = stepText(ctx, '27')
    const step28Text = stepText(ctx, '28')
    const step29Text = stepText(ctx, '29')
    const step30Text = stepText(ctx, '30')

    return `You are Assembly AI Copilot helping complete Step 32 — Get Into Position of the C3 Method Strategic Plan.

PURPOSE: What actions can the company take to establish competitive positioning before entering a sales conversation?

INSTRUCTIONS:
Write 3-4 specific Get Into Position actions. These prepare the company to win competitive evaluations before the first sales conversation. Each action should build credibility, establish positioning, or create awareness of differentiators with the target decision makers.

Format the draft as a plain numbered list. No headers. No bold. No markdown. Maximum 200 words.

CONFIDENCE SCORING:
- 71-100: Steps 17, 18, 19, 27, 28, 29, 30 all present and approved
- 41-70: Some upstream context missing or unapproved
- 0-40: Major upstream context missing, plan is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-4 actions as a plain numbered list, max 200 words>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONTEXT FOR THIS ACTION:
${extraContext || 'No specific context provided.'}

STEP 17 — Target Competition:
${step17Text}

STEP 18 — Competitive Differentiators:
${step18Text}

STEP 19 — Competitive Advantages:
${step19Text}

STEP 27 — The Set-Up:
${step27Text}

STEP 28 — The Jab:
${step28Text}

STEP 29 — Knock-Out:
${step29Text}

STEP 30 — Clean-Up:
${step30Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '33') {
    const step3Text = stepText(ctx, '3')
    const step11Text = stepText(ctx, '11')
    const step15Text = stepText(ctx, '15')
    const step28Text = stepText(ctx, '28')

    return `You are Assembly AI Copilot helping complete Step 33 — Grow Support of the C3 Method Strategic Plan.

PURPOSE: How to build internal champions and expand relationships within target accounts.

INSTRUCTIONS:
Write 3-4 specific Grow Support actions. These build internal champions and expand relationships within target accounts to strengthen the buying coalition. Each action should identify a specific decision maker from Step 3, explain how to engage them, and connect to a CVP or KSP that resonates with their concerns.

Format the draft as a plain numbered list. No headers. No bold. No markdown. Maximum 200 words.

CONFIDENCE SCORING:
- 71-100: Steps 3, 11, 15, 28 all present and approved
- 41-70: Some upstream context missing or unapproved
- 0-40: Major upstream context missing, plan is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-4 actions as a plain numbered list, max 200 words>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONTEXT FOR THIS ACTION:
${extraContext || 'No specific context provided.'}

STEP 3 — Key Decision Makers:
${step3Text}

STEP 11 — Compelling Value Propositions:
${step11Text}

STEP 15 — Key Selling Points:
${step15Text}

STEP 28 — The Jab:
${step28Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '34') {
    const step3Text = stepText(ctx, '3')
    const step22Text = stepText(ctx, '22')
    const step23Text = stepText(ctx, '23')
    const step27Text = stepText(ctx, '27')
    const step28Text = stepText(ctx, '28')
    const step29Text = stepText(ctx, '29')
    const step30Text = stepText(ctx, '30')

    return `You are Assembly AI Copilot helping complete Step 34 — Close The Sale of the C3 Method Strategic Plan.

PURPOSE: The specific closing approach aligned to how this buyer makes decisions from the DCP.

INSTRUCTIONS:
Write 3-4 specific Close The Sale actions. These are the final steps that convert an evaluation into a signed contract. Each action should align to the decision process from Step 22 and the decision factors from Step 23, addressing the final barriers to commitment.

Format the draft as a plain numbered list. No headers. No bold. No markdown. Maximum 200 words.

CONFIDENCE SCORING:
- 71-100: Steps 3, 22, 23, 27, 28, 29, 30 all present and approved
- 41-70: Some upstream context missing or unapproved
- 0-40: Major upstream context missing, plan is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-4 actions as a plain numbered list, max 200 words>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONTEXT FOR THIS ACTION:
${extraContext || 'No specific context provided.'}

STEP 3 — Key Decision Makers:
${step3Text}

STEP 22 — Competitive Evaluation:
${step22Text}

STEP 23 — Decision Factors:
${step23Text}

STEP 27 — The Set-Up:
${step27Text}

STEP 28 — The Jab:
${step28Text}

STEP 29 — Knock-Out:
${step29Text}

STEP 30 — Clean-Up:
${step30Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '35') {
    const step11Text = stepText(ctx, '11')
    const step15Text = stepText(ctx, '15')
    const step22Text = stepText(ctx, '22')

    return `You are Assembly AI Copilot helping complete Step 35 — Pat Them On The Back of the C3 Method Strategic Plan.

PURPOSE: Post-sale validation and early success milestones to prevent buyer regret.

INSTRUCTIONS:
Write 3-4 specific Pat Them On The Back actions. These are post-sale activities that validate the buying decision and build early confidence. Each action should deliver a quick win, confirm a leading indicator, or create visible proof that the engagement is working within the first 30-90 days.

Format the draft as a plain numbered list. No headers. No bold. No markdown. Maximum 200 words.

CONFIDENCE SCORING:
- 71-100: Steps 11, 15, 22 all present and approved
- 41-70: Some upstream context missing or unapproved
- 0-40: Major upstream context missing, plan is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-4 actions as a plain numbered list, max 200 words>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONTEXT FOR THIS ACTION:
${extraContext || 'No specific context provided.'}

STEP 11 — Compelling Value Propositions:
${step11Text}

STEP 15 — Key Selling Points:
${step15Text}

STEP 22 — Competitive Evaluation:
${step22Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '36') {
    const step17Text = stepText(ctx, '17')
    const step20Text = stepText(ctx, '20')
    const step24Text = stepText(ctx, '24')
    const step26Text = stepText(ctx, '26')

    return `You are Assembly AI Copilot helping complete Step 36 — Retrench of the C3 Method Strategic Plan.

PURPOSE: How to re-engage stalled or lost opportunities using competitive intelligence.

INSTRUCTIONS:
Write 3-4 specific Retrench actions. These re-engage stalled deals or recover lost opportunities. Each action should use competitive intelligence from Steps 20 and 24 to identify a new angle, address an unresolved objection, or demonstrate progress since the last conversation.

Format the draft as a plain numbered list. No headers. No bold. No markdown. Maximum 200 words.

CONFIDENCE SCORING:
- 71-100: Steps 17, 20, 24, 26 all present and approved
- 41-70: Some upstream context missing or unapproved
- 0-40: Major upstream context missing, plan is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-4 actions as a plain numbered list, max 200 words>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONTEXT FOR THIS ACTION:
${extraContext || 'No specific context provided.'}

STEP 17 — Target Competition:
${step17Text}

STEP 20 — Competitive Strengths and Weaknesses:
${step20Text}

STEP 24 — Competitive Retaliation:
${step24Text}

STEP 26 — Competitive Opportunities:
${step26Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '37') {
    const step11Text = stepText(ctx, '11')
    const step15Text = stepText(ctx, '15')
    const step27Text = stepText(ctx, '27')
    const step28Text = stepText(ctx, '28')
    const step29Text = stepText(ctx, '29')
    const step30Text = stepText(ctx, '30')

    return `You are Assembly AI Copilot helping complete Step 37 — Resources and Tools of the C3 Method Strategic Plan.

PURPOSE: Specific sales enablement assets needed to execute this GTM strategy.

INSTRUCTIONS:
Write 3-4 specific Resources and Tools needed to execute this GTM strategy. These are the sales enablement assets, templates, tools, and frameworks that the sales and marketing teams need to deliver the strategic messages and close deals. Each resource should connect to a specific step in the C3 Method and explain how it will be used in the field.

Format the draft as a plain numbered list. No headers. No bold. No markdown. Maximum 200 words.

CONFIDENCE SCORING:
- 71-100: Steps 11, 15, 27, 28, 29, 30 all present and approved
- 41-70: Some upstream context missing or unapproved
- 0-40: Major upstream context missing, plan is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-4 resources as a plain numbered list, max 200 words>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONTEXT FOR THIS ACTION:
${extraContext || 'No specific context provided.'}

STEP 11 — Compelling Value Propositions:
${step11Text}

STEP 15 — Key Selling Points:
${step15Text}

STEP 27 — The Set-Up:
${step27Text}

STEP 28 — The Jab:
${step28Text}

STEP 29 — Knock-Out:
${step29Text}

STEP 30 — Clean-Up:
${step30Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '38') {
    const step2Text = stepText(ctx, '2')
    const step3Text = stepText(ctx, '3')
    const step11Text = stepText(ctx, '11')
    const step23Text = stepText(ctx, '23')

    return `You are Assembly AI Copilot helping complete Step 38 — Opportunity Evaluation of the C3 Method Strategic Plan.

PURPOSE: Criteria for qualifying and scoring opportunities against the ICP.

INSTRUCTIONS:
Write 3-4 specific Opportunity Evaluation criteria. These are the qualifying questions and scoring criteria that help the team identify which opportunities are worth pursuing and prioritize their time. Each criterion should connect to the ICP from Step 2, the decision makers from Step 3, or the decision factors from Step 23.

Format the draft as a plain numbered list. No headers. No bold. No markdown. Maximum 200 words.

CONFIDENCE SCORING:
- 71-100: Steps 2, 3, 11, 23 all present and approved
- 41-70: Some upstream context missing or unapproved
- 0-40: Major upstream context missing, plan is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-4 criteria as a plain numbered list, max 200 words>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONTEXT FOR THIS ACTION:
${extraContext || 'No specific context provided.'}

STEP 2 — Target Market Segments:
${step2Text}

STEP 3 — Key Decision Makers:
${step3Text}

STEP 11 — Compelling Value Propositions:
${step11Text}

STEP 23 — Decision Factors:
${step23Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  return ''
}
