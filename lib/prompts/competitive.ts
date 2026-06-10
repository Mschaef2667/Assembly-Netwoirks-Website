import { provisionalNote, stepText, type PromptContext } from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

interface SavedCompetitor {
  index?: number
  name?: string
  why_buyers_choose?: string
  key_promise?: string
  vulnerability?: string
  deal_loss_frequency?: string
}

// Parses the structured competitor array saved by CompetitorStepEditor out of
// the currentContent JSON blob. Returns a formatted block, or empty string if
// no usable competitor data is present.
function formatCompetitorBlock(currentContent: string): string {
  if (!currentContent) return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(currentContent)
  } catch {
    return ''
  }
  if (!parsed || typeof parsed !== 'object') return ''
  const competitors = (parsed as Record<string, unknown>)['competitors']
  if (!Array.isArray(competitors)) return ''

  const lines: string[] = []
  for (const raw of competitors as SavedCompetitor[]) {
    const name = (raw.name ?? '').trim()
    if (!name) continue
    const idx = raw.index ?? lines.length + 1
    lines.push(`Competitor ${idx} — ${name}`)
    if (raw.why_buyers_choose && raw.why_buyers_choose.trim()) {
      lines.push(`  Why buyers choose them: ${raw.why_buyers_choose.trim()}`)
    }
    if (raw.key_promise && raw.key_promise.trim()) {
      lines.push(`  Their key promise: ${raw.key_promise.trim()}`)
    }
    if (raw.vulnerability && raw.vulnerability.trim()) {
      lines.push(`  Their vulnerability: ${raw.vulnerability.trim()}`)
    }
    if (raw.deal_loss_frequency && raw.deal_loss_frequency.trim()) {
      lines.push(`  Deal loss frequency: ${raw.deal_loss_frequency.trim()}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

// Steps 17-26 — Steps 17, 18, 19 have custom prompts; 20-26 fall through to the generic builder.
export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { currentContent, extraContext } = ctx

  if (stepId === '17-autofill') {
    return `CRITICAL: Respond with ONLY a valid JSON object. Start your response with { and end with }. No markdown, no backticks, no prose before or after the JSON.

Based on this competitor profile, generate three short answers (1-2 sentences each): 1) Why do B2B SaaS buyers choose this competitor over a GTM strategy consultancy? 2) What is their primary value proposition or key promise to buyers? 3) Where are they most vulnerable or what do they fail to deliver? Return ONLY valid JSON: { why_buyers_choose_them: string, their_key_promise: string, their_vulnerability: string }

COMPETITOR PROFILE:
${extraContext ?? 'Not provided.'}

Respond with ONLY the JSON object. No markdown, no backticks, no prose. Start with { and end with }.`
  }

  if (stepId === '17') {
    const step1Text = stepText(ctx, '1')
    const step2Text = stepText(ctx, '2')
    const step4Text = stepText(ctx, '4')
    const step11Text = stepText(ctx, '11')
    const step13Text = stepText(ctx, '13')

    const competitorBlock = formatCompetitorBlock(currentContent)
    const competitorSection = competitorBlock
      ? `USER-PROVIDED COMPETITORS (from the Step 17 competitor form — name, why buyers choose them, their key promise, their vulnerability, deal-loss frequency):
${competitorBlock}

Use these competitors verbatim. Do not invent additional competitors when the user has provided structured entries above — only enrich what they listed. Preserve each user-provided name in your output.`
      : 'USER-PROVIDED COMPETITORS: None. Use the company context, CVP, and KSPs to identify likely competitor archetypes.'

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write a structured competitive analysis for Step 17 — Target Competition.

For each competitor produce:
1. Competitor name and category (agency / consultancy / fractional / internal / status quo / direct vendor)
2. Why buyers choose them: the reason this competitor wins deals against you
3. Their key promise: their primary value proposition or CVP
4. Their vulnerability: their most exploitable weakness given this company's CVP and KSPs
5. Deal-loss frequency: Frequently / Sometimes / Rarely / Unknown — based on user input when given, otherwise your best estimate

The analysis must be grounded in the company's specific CVP and Key Selling Points and, when present, in the user-provided competitor data below. Every weakness and counter-position must trace back to something specific in the context.

RULES:
- When the user has provided competitor entries, use those names and enrich the missing fields. Do not replace user names with your own.
- If the user provided no competitors, surface 3-5 plausible archetypes (e.g. 'Large ERP vendor', 'Spreadsheet-based approach', 'Status quo / do nothing').
- Always include 'Status quo / do nothing' as a competitor if the user did not already capture it.
- Each competitor entry is a structured object, not prose.
- Do not use the words 'revolutionary', 'cutting-edge', 'game-changing', 'leverage', 'empower', or 'unlock'.

CONFIDENCE SCORING:
- 71-100: User provided structured competitor data, plus CVP and KSPs are present
- 41-70: CVP or KSPs missing, or user provided only competitor names
- 0-40: Minimal context; analysis is largely speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<structured competitor analysis as readable prose, one paragraph per competitor, each starting with the competitor name/category>",
  "competitors": [
    {
      "name": "<competitor name or archetype>",
      "category": "<agency | consultancy | fractional | internal | status quo | direct vendor>",
      "why_buyers_choose": "<reason this competitor wins deals>",
      "key_promise": "<their primary value proposition>",
      "vulnerability": "<their most exploitable weakness>",
      "deal_loss_frequency": "<Frequently | Sometimes | Rarely | Unknown>"
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

${competitorSection}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
  }

  if (stepId === '18') {
    const step4Text = stepText(ctx, '4')
    const step13Text = stepText(ctx, '13')
    const step17Text = stepText(ctx, '17')

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write the Competitive Differentiator for this pain point. A differentiator explains how the company's Critical Success Formulas solve this pain point DIFFERENTLY than the target competitors.

Structure the response as:
1) The differentiator statement (how we solve it differently)
2) Classification: Exclusive (only we have this), Relative (we do it better), or First-Mover (we got there first)
3) Why competitors cannot easily replicate this

Maximum 3 sentences total. Be specific — reference the actual formula from Step 13 and the actual competitors from Step 17.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<the 3-sentence differentiator covering statement, classification, and why-not-replicable>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question to sharpen the differentiator>"],
  "verification_checks": ["<factual claim to verify>"]
}

STEP 4 — Pain Points (The Problem):
${step4Text}

STEP 13 — Critical Success Formulas:
${step13Text}

STEP 17 — Target Competition:
${step17Text}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
  }

  if (stepId === '20') {
    const step17Text = stepText(ctx, '17')
    const step18Text = stepText(ctx, '18')
    const step19Text = stepText(ctx, '19')

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write the Competitive Threat for this specific competitor. A competitive threat identifies what makes THIS competitor's approach BETTER than ours in specific situations.

Structure:
1) The threat statement (what they do better and when)
2) Classification: Exclusive, Relative, or First-Mover
3) Which buyer types or deal situations where this threat is most dangerous

Maximum 3 sentences. Be honest — understanding real threats is how you prepare to counter them.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<the 3-sentence threat covering statement, classification, and where it's most dangerous>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question to sharpen the threat assessment>"],
  "verification_checks": ["<factual claim to verify>"]
}

STEP 17 — Target Competition:
${step17Text}

STEP 18 — Competitive Differentiators:
${step18Text}

STEP 19 — Competitive Advantages:
${step19Text}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}
FORMATTING: Return plain text only. Do not use markdown formatting like **bold**, bullet points with *, or any other markdown syntax. Use numbered lists (1. 2. 3.) and plain text only.`
  }

  if (stepId === '21') {
    const step3Text = stepText(ctx, '3')
    const step14Text = stepText(ctx, '14')
    const step17Text = stepText(ctx, '17')
    const step20Text = stepText(ctx, '20')

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write the Competitive Acid Test for this competitor. The acid test asks: Does this competitor have the core competencies to implement their critical success formulas? And do the key decision makers in Step 3 believe this competitor can deliver?

Structure:
1) Assessment of competitor's competency (do they have what it takes?)
2) What decision makers likely believe about this competitor's capability
3) The key vulnerability this reveals

Maximum 3 sentences. Be analytical and honest.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<the 3-sentence acid test covering competency assessment, decision-maker belief, and key vulnerability>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question to sharpen the acid test>"],
  "verification_checks": ["<factual claim to verify>"]
}

STEP 3 — Decision Makers:
${step3Text}

STEP 14 — Core Competencies:
${step14Text}

STEP 17 — Target Competition:
${step17Text}

STEP 20 — Competitive Threats:
${step20Text}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}
FORMATTING: Return plain text only. Do not use markdown formatting like **bold**, bullet points with *, or any other markdown syntax. Use numbered lists (1. 2. 3.) and plain text only.`
  }

  if (stepId === '24') {
    const step17Text = stepText(ctx, '17')
    const step18Text = stepText(ctx, '18')
    const step20Text = stepText(ctx, '20')

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Write the Competitive Retaliation strategy for this specific competitor. Given what makes them threatening (from Step 20) and our differentiators (from Step 18), identify 3-4 specific actions we can take to minimize this competitor's threat and strengthen our position against them. Each action should be concrete and executable — not generic advice. Format as a numbered list with brief explanation for each action. Focus on neutralizing their strengths and exploiting their vulnerabilities identified in Step 17.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<numbered list of 3-4 specific retaliation actions, each with brief explanation>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question to sharpen the retaliation plan>"],
  "verification_checks": ["<factual claim to verify>"]
}

STEP 17 — Target Competition (includes each competitor's vulnerability):
${step17Text}

STEP 18 — Competitive Differentiators:
${step18Text}

STEP 20 — Competitive Threats:
${step20Text}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}
FORMATTING: Return plain text only. Do not use markdown formatting like **bold**, bullet points with *, or any other markdown syntax. Use numbered lists (1. 2. 3.) and plain text only.`
  }

  if (stepId === '22') {
    const step3Block = ctx.step3Text && ctx.step3Text !== 'Not yet available.'
      ? ctx.step3Text
      : stepText(ctx, '3')
    const step17Block = ctx.step17Text && ctx.step17Text !== 'Not yet available.'
      ? ctx.step17Text
      : stepText(ctx, '17')
    const dcpStage4 = ctx.dcpStage4Summary || 'Not yet available.'
    const dcpStage5 = ctx.dcpStage5Summary || 'Not yet available.'
    const dcpStage6 = ctx.dcpStage6Summary || 'Not yet available.'

    return `CRITICAL: Respond with ONLY a valid JSON object. Start your response with { and end with }. No markdown, no backticks, no prose before or after the JSON.

You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Write the Competitive Evaluation playbook for this company. Using the DCP Map intelligence and decision maker data, describe how buyers evaluate GTM strategy partners in each phase of the process. Be specific and actionable — this is a deal playbook, not generic advice.

Return ONLY valid JSON: { introduction: string, evaluation: string, presentation: string, proposal: string, execution: string, length: string, decision_criteria: string, keys_to_winning: string } No markdown no prose.

SECTION GUIDANCE:
- introduction: how buyers typically enter a competitive evaluation (referral, outreach, RFP, inbound)
- evaluation: the formal evaluation activities (interviews, demos, trials, scoring rubrics, site visits)
- presentation: expected pitch format, attendees, length
- proposal: what a winning proposal contains and the format buyers expect
- execution: what happens immediately after selection — onboarding, kickoff
- length: realistic duration from first contact to signed contract
- decision_criteria: top 3-5 selection criteria with relative weighting
- keys_to_winning: specific actions, proof points, or behaviors that win these deals

STEP 3 — Decision Makers:
${step3Block}

STEP 17 — Target Competition:
${step17Block}

DCP MAP — Stage 4 (Evaluation):
${dcpStage4}

DCP MAP — Stage 5 (Selection):
${dcpStage5}

DCP MAP — Stage 6 (Implementation / Post-Selection):
${dcpStage6}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
  }

  if (stepId === '23') {
    const step2Text = stepText(ctx, '2')
    const step3Block = ctx.step3Text && ctx.step3Text !== 'Not yet available.'
      ? ctx.step3Text
      : stepText(ctx, '3')
    const dcpStage6 = ctx.dcpStage6Summary || 'Not yet available.'

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Based on the decision factor ranking provided and the DCP Stage 6 (Purchase Decision) intelligence, write a 2-3 sentence Decision Pattern describing how this segment makes their final GTM partner selection. What drives the final choice? Who has final say? What tips the decision? Be specific to this segment.

Return plain text only — no JSON, no markdown fences, no bullet points. Just 2-3 sentences of clear, specific prose.

STEP 2 — Target Segments:
${step2Text}

STEP 3 — Decision Makers:
${step3Block}

DCP MAP — Stage 6 (Purchase Decision):
${dcpStage6}

${extraContext ?? ''}
${provisionalNote(ctx)}`
  }

  if (stepId === '19') {
    const step17Text = stepText(ctx, '17')
    const step18Text = stepText(ctx, '18')

    return `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write the Competitive Advantage over this specific competitor. A competitive advantage explains what makes the company's differentiators BETTER than this specific competitor.

Structure the response as:
1) The advantage statement (why we win against this competitor specifically)
2) Classification: Exclusive, Relative, or First-Mover
3) The competitor's vulnerability that this advantage exploits (from Step 17 vulnerability field)

Maximum 3 sentences. Be specific — name the competitor and reference actual differentiators from Step 18.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<the 3-sentence advantage covering statement, classification, and the competitor's vulnerability>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question to sharpen the advantage>"],
  "verification_checks": ["<factual claim to verify>"]
}

STEP 17 — Target Competition (includes each competitor's vulnerability):
${step17Text}

STEP 18 — Competitive Differentiators:
${step18Text}
${provisionalNote(ctx)}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
  }

  return ''
}
