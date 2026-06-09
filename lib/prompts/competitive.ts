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
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
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
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`
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
