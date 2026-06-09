import { provisionalNote, stepText, type PromptContext } from './types'

export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { currentContent, extraContext } = ctx

  if (
    stepId === '31' || stepId === '32' || stepId === '33' || stepId === '34' ||
    stepId === '35' || stepId === '36' || stepId === '37' || stepId === '38'
  ) {
    const step1Text = stepText(ctx, '1')
    const step2Text = stepText(ctx, '2')
    const step3Text = stepText(ctx, '3')
    const step4Text = stepText(ctx, '4')
    const step11Text = stepText(ctx, '11')
    const step13Text = stepText(ctx, '13')
    const step17Text = stepText(ctx, '17')

    const step27 = ctx.contextPacket.prerequisites.find(p => p.step_id === '27')
    const step28 = ctx.contextPacket.prerequisites.find(p => p.step_id === '28')
    const step29 = ctx.contextPacket.prerequisites.find(p => p.step_id === '29')
    const step30 = ctx.contextPacket.prerequisites.find(p => p.step_id === '30')

    const messagesBlock = [
      step27 ? `Step 27 — The Set-Up:\n${JSON.stringify(step27.content, null, 2)}` : '',
      step28 ? `Step 28 — The Jab:\n${JSON.stringify(step28.content, null, 2)}` : '',
      step29 ? `Step 29 — Knock-Out:\n${JSON.stringify(step29.content, null, 2)}` : '',
      step30 ? `Step 30 — Clean-Up:\n${JSON.stringify(step30.content, null, 2)}` : '',
    ].filter(Boolean).join('\n\n') || 'Strategic messages not yet available.'

    const stepGuidance: Record<string, { name: string; focus: string }> = {
      '31': { name: 'Create Opportunities',     focus: 'How to generate new pipeline opportunities using the approved messaging and ICP.' },
      '32': { name: 'Get Into Position',        focus: 'How to establish competitive positioning before entering a sales conversation.' },
      '33': { name: 'Grow Support',             focus: 'How to build internal champions and expand relationships within target accounts.' },
      '34': { name: 'Close The Sale',           focus: 'The specific closing approach aligned to how this buyer makes decisions (from DCP).' },
      '35': { name: 'Pat Them On The Back',     focus: 'Post-sale validation and early success milestones to prevent buyer\'s remorse.' },
      '36': { name: 'Retrench',                 focus: 'How to re-engage stalled or lost opportunities using competitive intelligence.' },
      '37': { name: 'Resources and Tools',      focus: 'Specific sales enablement assets needed to execute this GTM strategy.' },
      '38': { name: 'Opportunity Evaluation',   focus: 'Criteria for qualifying and scoring opportunities against the ICP.' },
    }

    const guide = stepGuidance[stepId]!

    return `You are Assembly AI Copilot helping complete the Action Plan section of the C3 Method Strategic Plan. Each Action Plan step represents a phase of go-to-market execution. Using the approved strategic messages, CVPs, competitive analysis, and ICP from upstream steps, generate a specific, actionable plan for this step.

THIS STEP — Step ${stepId}: ${guide.name}
FOCUS: ${guide.focus}

INSTRUCTIONS:
- Generate 3-5 specific, actionable tactics for this step.
- Use the upstream context to make recommendations specific to this company, segment, and buyer.
- Tactics must be concrete (named channels, roles, plays, cadences, artifacts) — not generic best-practice statements.
- Do not use the words 'revolutionary', 'cutting-edge', 'game-changing', 'leverage', 'empower', or 'unlock'.

CONFIDENCE SCORING:
- 71-100: Strategic messages, CVP, competitive analysis, and ICP/segments all present and approved
- 41-70: Some upstream context missing or unapproved
- 0-40: Major upstream context missing, plan is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<3-5 specific tactics, one per line or short paragraph>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

CONTEXT FOR THIS ACTION PLAN STEP:
${extraContext || 'No specific pain point or scorecard context provided — generate from upstream strategy.'}

STEP 1 — Company Profile:
${step1Text}

STEP 2 — Target Market Segments:
${step2Text}

STEP 3 — Key Decision Makers:
${step3Text}

STEP 4 — Endemic Problem:
${step4Text}

STEP 11 — Compelling Value Proposition:
${step11Text}

STEP 13 — Key Selling Points:
${step13Text}

STEP 17 — Competitive Landscape:
${step17Text}

STRATEGIC MESSAGES (Steps 27-30):
${messagesBlock}
${provisionalNote(ctx)}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`
  }

  return ''
}
