import { provisionalNote, stepText, type PromptContext } from './types'

export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { currentContent, extraContext } = ctx

  if (stepId === '27') {
    const step1Text = stepText(ctx, '1')
    const step2Text = stepText(ctx, '2')
    const step4Text = stepText(ctx, '4')
    const step5Text = stepText(ctx, '5')
    const step6Text = stepText(ctx, '6')
    const step11Text = stepText(ctx, '11')
    const step13Text = stepText(ctx, '13')
    const step17Text = stepText(ctx, '17')

    const inst = {
      name: 'The Set-Up',
      description: `The Set-Up is the opening of a strategic message. It establishes context by naming the endemic problem the buyer is experiencing, stated from their perspective without mentioning the solution. It creates the "yes, that's exactly our problem" moment.`,
      rules: `Write The Set-Up strategic message for this pain point. The Set-Up should:
1) Name the endemic problem in the buyer's language
2) Describe the business consequence if left unsolved
3) Create recognition without introducing the solution
2-3 sentences. No product mentions. Write from the buyer's world.`,
    }

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write ${inst.name} — a strategic message — for the pain point provided in the additional context.

WHAT ${inst.name.toUpperCase()} IS:
${inst.description}

INSTRUCTIONS:
${inst.rules}

GLOBAL RULES:
- 2-3 sentences only. No bullets, no headers, no placeholders.
- Be specific to the pain point provided. Do not write a generic message.
- Do not use the words 'revolutionary', 'cutting-edge', 'game-changing', 'leverage', 'empower', or 'unlock'.

CONFIDENCE SCORING:
- 71-100: Pain point, CVP, KSPs, and competitive context all present and specific
- 41-70: Pain point present but some upstream context is thin
- 0-40: Missing critical context, draft is speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<2-3 sentence strategic message>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

PAIN POINT BEING DRAFTED FOR:
${extraContext || 'No specific pain point provided.'}

STEP 1 — Company Profile (what the company sells):
${step1Text}

STEP 2 — Product / Service Description:
${step2Text}

STEP 4 — Endemic Problem (the buyer's market condition):
${step4Text}

STEP 5 — Root Causes (what creates the problem):
${step5Text}

STEP 6 — Effects (consequences if the problem goes unsolved):
${step6Text}

STEP 11 — Compelling Value Proposition:
${step11Text}

STEP 13 — Key Selling Points:
${step13Text}

STEP 17 — Competitive Landscape:
${step17Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  if (stepId === '28' || stepId === '29' || stepId === '30') {
    const step1Text = stepText(ctx, '1')
    const step4Text = stepText(ctx, '4')
    const step6Text = stepText(ctx, '6')
    const step11Text = stepText(ctx, '11')
    const step17Text = stepText(ctx, '17')

    let messageName: string
    let messageInstruction: string
    let primarySourcesBlock: string

    if (stepId === '28') {
      messageName = 'The Jab'
      messageInstruction = 'Write The Jab using this exact formula: Our solution will [CVP] because of our commitment to [Core Competency]. The CVP comes from Step 11 (Compelling Value Propositions) and the Core Competency comes from Step 14. Be specific -- use the actual CVP and competency text, not placeholders. 2-3 sentences.'
      primarySourcesBlock = `PRIMARY SOURCE — Step 11 (Compelling Value Proposition):
${step11Text}

PRIMARY SOURCE — Step 14 (Core Competency):
${ctx.step14Text}`
    } else if (stepId === '29') {
      messageName = 'Knock-Out'
      messageInstruction = 'Write the Knock-Out using this formula: We are unique because of [specific competitive differentiator from Step 18]. Name the company, state the differentiator specifically, and connect it to why competitors cannot replicate it. 2-3 sentences.'
      primarySourcesBlock = `PRIMARY SOURCE — Step 18 (Competitive Differentiator):
${ctx.step18Text}`
    } else {
      messageName = 'Clean-Up'
      messageInstruction = 'Write the Clean-Up using this formula: [Competitive Advantage] will effectively solve [Effect] because [reason]. Use the specific competitive advantage from Step 19 and the specific effect from Step 6. This is the closing argument that connects your unique strength directly to the buyer\'s pain. 2-3 sentences.'
      primarySourcesBlock = `PRIMARY SOURCE — Step 19 (Competitive Advantage):
${ctx.step19Text}

PRIMARY SOURCE — Step 6 (The Effect):
${step6Text}`
    }

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write ${messageName} — a strategic message — for the pain point provided in the additional context.

INSTRUCTIONS:
${messageInstruction}

GLOBAL RULES:
- 2-3 sentences only. No bullets, no headers, no placeholders.
- Be specific to the pain point provided. Do not write a generic message.
- Do not use the words 'revolutionary', 'cutting-edge', 'game-changing', 'leverage', 'empower', or 'unlock'.

CONFIDENCE SCORING:
- 71-100: Pain point and all primary source steps are present and specific
- 41-70: Pain point present but a primary source is thin or missing
- 0-40: Missing critical context, draft is speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<2-3 sentence strategic message>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

PAIN POINT BEING DRAFTED FOR:
${extraContext || 'No specific pain point provided.'}

${primarySourcesBlock}

SUPPORTING CONTEXT — Step 1 (Company Profile):
${step1Text}

SUPPORTING CONTEXT — Step 4 (Endemic Problem):
${step4Text}

SUPPORTING CONTEXT — Step 17 (Competitive Landscape):
${step17Text}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  return ''
}
