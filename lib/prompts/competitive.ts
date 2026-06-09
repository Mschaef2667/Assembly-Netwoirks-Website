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

// Steps 17-26 — only Step 17 has a custom prompt; 18-26 fall through to the generic builder.
export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { currentContent, extraContext } = ctx

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

  return ''
}
