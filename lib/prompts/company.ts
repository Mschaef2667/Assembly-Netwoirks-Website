import { provisionalNote, stepText, type PromptContext } from './types'

export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { currentContent, extraContext } = ctx

  if (stepId === '11') {
    const step1Text = stepText(ctx, '1')
    const step4Text = stepText(ctx, '4')
    const step6Text = stepText(ctx, '6')
    return `You are helping write Compelling Value Propositions (CVPs) using the C3 Method. Each CVP must be written as a promise that directly connects the company's product or service to a specific pain point and its business effect.

FORMULA: 'If you [partner with/use Company], it will solve [specific problem], thereby reducing [ONE specific consequence] on your business.'

HARD CONSTRAINTS:
- Maximum 2 sentences total. No more.
- The "thereby reducing" clause must name ONE specific business consequence only -- not a list.
- No stacking of multiple effects with commas (do NOT write "thereby reducing churn, lost revenue, and missed pipeline" -- pick the single most consequential one).
- Keep the same promise formula structure: If you [partner with/use Company], it will solve [specific problem], thereby reducing [ONE specific consequence] on your business.

CRITICAL ALIGNMENT CHECK: Before writing each CVP, verify that the company's product or service actually and specifically addresses the pain point. If the connection is weak or unclear, do NOT write a generic CVP -- instead flag it as: 'ALIGNMENT GAP: The product/service description does not clearly address this pain point. This is a critical point of failure. Review your product positioning or redefine this pain point.'

REQUIREMENTS:
- One CVP per pain point (3 pain points = 3 CVPs)
- Written as a specific promise, not a generic claim
- Use the company name and actual product/service name
- Connect directly to the pain point title and effect
- If CVP cannot be written due to alignment gap, say so explicitly

CONFIDENCE SCORING:
- 71-100: Step 1 (company/product), Step 4 (pain point), and Step 6 (effect) all present and specific
- 41-70: Pain point present but company product description or effect is thin
- 0-40: Missing critical context, draft is speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<CVP for the pain point, or an ALIGNMENT GAP message>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

PAIN POINT BEING DRAFTED FOR:
${extraContext || 'No specific pain point provided — write a general CVP from the endemic problem in Step 4.'}

PRIMARY SOURCE — Step 1 (Company / Product / Service description):
${step1Text}

PRIMARY SOURCE — Step 4 (Pain Points / Endemic Problem):
${step4Text}

PRIMARY SOURCE — Step 6 (Effects — consequences if the problem goes unsolved):
${step6Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '12') {
    const step1Text = stepText(ctx, '1')
    const step11Text = stepText(ctx, '11')
    return `You are helping define Critical Success Factors for each Compelling Value Proposition. Given the CVP promise below, identify 3-5 specific things the company MUST do, MUST have, or MUST NOT fail at in order to deliver on this promise. These are not aspirational goals -- they are non-negotiable execution requirements. Format as a bulleted list with a brief explanation for each. Be specific to this company and this promise.

CONFIDENCE SCORING:
- 71-100: CVP promise (Step 11) and company profile are both present and specific
- 41-70: CVP present but company profile is thin
- 0-40: Missing critical context, draft is speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-5 bulleted Critical Success Factors, each with a brief explanation>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CVP PROMISE BEING ANALYZED (from Step 11):
${extraContext || 'No specific CVP provided.'}

PRIMARY SOURCE — Step 11 (Compelling Value Propositions):
${step11Text}

SUPPORTING CONTEXT — Step 1 (Company Profile):
${step1Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '13') {
    const step1Text = stepText(ctx, '1')
    const step11Text = stepText(ctx, '11')
    return `Generate the Critical Success Formulas this company needs to fulfill their Critical Success Factors. A formula is a repeatable documented process. For each CSF from Step 12, generate one formula with a clear name and 2-3 sentence description of the process. Return ONLY valid JSON: { "items": [{ "label": "<formula name>", "description": "<2-3 sentence process description>" }] } with 3-5 items. No markdown, no prose, no explanation before or after the JSON.

PRIMARY SOURCE — Step 12 (Critical Success Factors — the promises that must be kept):
${ctx.step12Text}

SUPPORTING CONTEXT — Step 11 (Compelling Value Propositions):
${step11Text}

SUPPORTING CONTEXT — Step 1 (Company Profile):
${step1Text}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
  }

  if (stepId === '14') {
    const step1Text = stepText(ctx, '1')
    return `Generate the Core Competencies this company needs to execute their Critical Success Formulas. A core competency is an internal capability that is difficult to replicate. For each formula from Step 13, identify the underlying competency required. Return ONLY valid JSON: { "items": [{ "label": "<competency name>", "description": "<2-3 sentence description of the capability and why it matters>" }] } with 3-5 items. No markdown, no prose, no explanation before or after the JSON.

PRIMARY SOURCE — Step 13 (Critical Success Formulas — the processes that must be executed):
${ctx.step13Text}

SUPPORTING CONTEXT — Step 12 (Critical Success Factors):
${ctx.step12Text}

SUPPORTING CONTEXT — Step 1 (Company Profile):
${step1Text}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
  }

  if (stepId === '15') {
    const step1Text = stepText(ctx, '1')
    const step11Text = stepText(ctx, '11')
    return `Write the Key Selling Point for this pain point using this exact formula: We will deliver [CVP] by implementing [Critical Success Formula] because of the [Core Competency] we have accumulated. Be specific -- use the actual CVP from Step 11, the actual formula from Step 13, and the actual competency from Step 14. This is the sales narrative that connects promise to process to proof. Maximum 2-3 sentences. Write in first person plural (We will...). Do not use placeholders -- use the real content from the upstream steps.

CONFIDENCE SCORING:
- 71-100: Steps 11, 13, and 14 are all present and specific
- 41-70: One of Steps 11, 13, or 14 is thin or missing
- 0-40: Multiple primary sources missing, draft is speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<Key Selling Point, maximum 2-3 sentences>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CVP BEING DRAFTED FOR:
${extraContext || 'No specific CVP provided.'}

PRIMARY SOURCE — Step 11 (Compelling Value Propositions):
${step11Text}

PRIMARY SOURCE — Step 13 (Critical Success Formulas):
${ctx.step13Text}

PRIMARY SOURCE — Step 14 (Core Competencies):
${ctx.step14Text}

SUPPORTING CONTEXT — Step 1 (Company Profile):
${step1Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '16') {
    const step1Text = stepText(ctx, '1')
    const step3Text = stepText(ctx, '3')
    const step11Text = stepText(ctx, '11')
    return `CRITICAL: Respond with ONLY a valid JSON object. Start your response with { and end with }. No markdown, no backticks, no prose before or after the JSON.

CRITICAL: Respond with ONLY valid JSON starting with {

You are helping complete the Acid Test for the C3 Method. Based ONLY on the decision makers actually defined in Step 3 (do not invent, substitute, or add generic roles), the CVPs in Step 11, the formulas in Step 13, and the competencies in Step 14, assess how likely each decision maker is to believe the company can deliver each CVP. Return ONLY valid JSON: { "matrix": [{ "cvp_index": <number>, "cvp_label": "<short label>", "ratings": [{ "role": "<decision maker role or title exactly as written in Step 3>", "belief": "yes" | "likely" | "unlikely" | "no", "reason": "<one sentence reason>" }], "current_evidence": "<what proof currently exists>", "strengthen": "<specific actions to build more credibility with these decision makers>" }] } No markdown no prose.

Rules:
- Decision makers MUST come ONLY from Step 3 (specific_title if present, otherwise role_category) — never use generic titles like "CEO" or "VP of Sales" unless they appear in Step 3.
- Use those Step 3 labels exactly as written for the "role" field in each rating. Do not paraphrase or normalise them.
- Produce one matrix entry per CVP from Step 11 (use the by_pain_point index as cvp_index).
- Belief must be one of: yes, likely, unlikely, no — all lowercase.
- Be honest: if Step 13 formulas or Step 14 competencies are thin or missing, lean toward unlikely or no for senior buyers.

LENGTH CONSTRAINTS (enforce strictly — total response must stay well under token limit):
- "cvp_label": maximum 8 words.
- "reason": maximum 15 words. One short sentence grounded in Steps 13/14 and the buyer's primary concerns from Step 3.
- "current_evidence": maximum 20 words. Summarise what proof currently exists (references, case studies, DCP research, demos, pilot results). If proof is missing, say so explicitly.
- "strengthen": maximum 30 words, bullet points only. List concrete actions to build credibility — name the asset, audience, and measurable outcome where possible. No vague guidance like "gather more proof".

PRIMARY SOURCE — Step 3 (Key Decision Makers — the ONLY allowed source for decision maker roles in this step):
${step3Text}

PRIMARY SOURCE — Step 11 (Compelling Value Propositions — one per pain point index):
${step11Text}

PRIMARY SOURCE — Step 13 (Critical Success Formulas — repeatable processes):
${ctx.step13Text}

PRIMARY SOURCE — Step 14 (Core Competencies — internal capabilities):
${ctx.step14Text}

SUPPORTING CONTEXT — Step 1 (Company Profile):
${step1Text}
${provisionalNote(ctx)}`
  }

  return ''
}
