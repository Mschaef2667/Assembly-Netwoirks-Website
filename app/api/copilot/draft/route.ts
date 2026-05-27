import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { resolveContextPacket, type ContextFetcher } from '@/lib/context/resolveContextPacket'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftRequestBody {
  stepId: string
  workspaceId: string
  stepTitle: string
  stepDescription: string
  currentContent: string
  preferredModel?: string
  extraContext?: string
}

// ── Route config ─────────────────────────────────────────────────────────────

export const maxDuration = 30

// ── POST /api/copilot/draft ───────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleDraft(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[copilot/draft] unhandled error:', message)
    if (stack) console.error('[copilot/draft] stack:', stack)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleDraft(req: NextRequest): Promise<Response> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: DraftRequestBody
  try {
    body = (await req.json()) as DraftRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { stepId, workspaceId, stepTitle, stepDescription, currentContent, preferredModel, extraContext } = body
  const isImprove = typeof extraContext === 'string' && extraContext.includes('Improve this draft')
  if (!stepId || !workspaceId) {
    return NextResponse.json({ error: 'stepId and workspaceId are required' }, { status: 400 })
  }

  const model = preferredModel ?? 'claude-sonnet-4-5'
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  // Resolve context packet using the authenticated server-side supabase client.
  // The default fetcher in resolveContextPacket uses the browser client, which has
  // no auth context in a server route and would fail RLS checks.
  const serverFetcher: ContextFetcher = {
    async fetchDirectDeps(sid) {
      const { data } = await supabase
        .from('step_dependency')
        .select('prerequisite_step_id')
        .eq('step_id', sid)
      return (data ?? []) as { prerequisite_step_id: string }[]
    },
    async fetchIndirectDeps(stepIds) {
      if (stepIds.length === 0) return []
      const { data } = await supabase
        .from('step_dependency')
        .select('prerequisite_step_id')
        .in('step_id', stepIds)
      return (data ?? []) as { prerequisite_step_id: string }[]
    },
    async fetchOutputs(depIds, workspaceId: string) {
      if (depIds.length === 0) return []
      const { data } = await supabase
        .from('step_output')
        .select('step_id, content, status, version')
        .eq('workspace_id', workspaceId)
        .in('step_id', depIds)
        .order('version', { ascending: false })
      return (data ?? []) as { step_id: string; content: Record<string, unknown>; status: string; version: number }[]
    },
  }

  const contextPacket = await resolveContextPacket(stepId, workspaceId, serverFetcher)

  // ── Step 4: fetch DCP Stage 1 summary (not in step_output — lives in dcp_analysis) ──
  let dcpStage1Summary = ''
  if (stepId === '4') {
    try {
      const { data: dcpRow } = await supabase
        .from('dcp_analysis')
        .select('stage_summaries')
        .eq('org_id', workspaceId)
        .maybeSingle()
      if (dcpRow) {
        const summaries = (dcpRow as Record<string, unknown>)['stage_summaries'] as
          Array<{ stage_number: number; summary: string }> | null
        const stage1 = summaries?.find(s => s.stage_number === 1)
        if (stage1) dcpStage1Summary = stage1.summary
      }
    } catch { /* non-fatal — proceed with lower confidence */ }
  }

  // ── Step 1: fetch company name for web search ────────────────────────────────
  let orgName = ''
  if (stepId === '1' && !isImprove) {
    try {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', workspaceId)
        .maybeSingle()
      if (orgRow) orgName = String((orgRow as Record<string, unknown>)['name'] ?? '')
    } catch { /* non-fatal */ }
  }

  // ── Survey-builder: fetch Steps 1, 2, 3 directly (no step_dependency entry needed) ──
  let surveyBuilderStep1 = ''
  let surveyBuilderStep2 = ''
  let surveyBuilderStep3 = ''
  if (stepId === 'survey-builder') {
    try {
      const { data: sbOutputs } = await supabase
        .from('step_output')
        .select('step_id, content')
        .eq('workspace_id', workspaceId)
        .in('step_id', ['1', '2', '3'])
        .order('version', { ascending: false })
      if (sbOutputs) {
        const seen = new Set<string>()
        for (const row of sbOutputs as Array<{ step_id: string; content: Record<string, unknown> }>) {
          if (!seen.has(row.step_id)) {
            seen.add(row.step_id)
            if (row.step_id === '1') surveyBuilderStep1 = JSON.stringify(row.content, null, 2)
            if (row.step_id === '2') surveyBuilderStep2 = JSON.stringify(row.content, null, 2)
            if (row.step_id === '3') surveyBuilderStep3 = JSON.stringify(row.content, null, 2)
          }
        }
      }
    } catch { /* non-fatal — proceed without Phase 1 context */ }
  }

  // ── Build system prompt ───────────────────────────────────────────────────────

  let systemPrompt: string

  if (isImprove) {
    systemPrompt = `You are Assembly AI Copilot. Your task is to improve the following draft — make it more specific, more compelling, and tighter. Do not change the core meaning or add new claims not supported by the context. Remove generic language. Strengthen the buyer outcome. Keep the same length or shorter. Return the same JSON format with an improved draft field.

DRAFT TO IMPROVE:
${currentContent || '(empty — nothing to improve)'}

Return ONLY valid JSON (no markdown fences, no prose) with this exact shape:
{
  "draft": "<improved draft>",
  "confidence": <integer 0-100>,
  "sources": [],
  "assumptions": [],
  "open_questions": [],
  "verification_checks": []
}`

  } else if (stepId === '1') {
    systemPrompt = `You are a JSON generator. Return ONLY a valid JSON object starting with { and ending with }. No markdown, no prose, no explanation. Use this exact shape:
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
- Score 71-100: A company website was found AND specific product/service details, target customers, or differentiators were identified
- Score 41-70: A company website was found but product information is thin, vague, or generic
- Score 0-40: No company website was found, or the company could not be identified online`

  } else if (stepId === '2') {
    // Step 2: Target Market Segments
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

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
${provisionalNote}
CURRENT CONTENT (segments the user has defined):
${currentContent || '(empty — no segments defined yet)'}
${extraContext ? `\nADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`

  } else if (stepId === '3') {
    // Step 3: Key Decision Makers
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step2 = contextPacket.prerequisites.find(p => p.step_id === '2')
    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step2Text = step2 ? JSON.stringify(step2.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

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
${provisionalNote}
CURRENT CONTENT (decision makers the user has defined):
${currentContent || '(empty — no decision makers defined yet)'}
${extraContext ? `\nADDITIONAL CONTEXT:\n${extraContext}\n` : ''}`

  } else if (stepId === '4') {
    // Extract Step 1 and Step 3 content from prerequisites
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step3 = contextPacket.prerequisites.find(p => p.step_id === '3')
    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step3Text = step3 ? JSON.stringify(step3.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write Step 4 — The Problem — for this workspace.

The Problem is the endemic problem buyers experience in their market, independent of any vendor. It is a structural condition that exists whether or not the company's product exists. State it from the buyer's perspective.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<2-4 sentence endemic problem statement>",
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

CONFIDENCE SCORING:
- 71-100: DCP Stage 1 summary is present and specific; company profile is complete
- 41-70: DCP Stage 1 present but thin, or company profile is partially complete
- 0-40: No DCP data available; draft is speculative from company profile alone

PRIMARY SOURCE — DCP Map, Stage 1 (Need Recognition):
${dcpStage1Summary || 'Not yet available — draft from company profile with low confidence.'}

SUPPORTING CONTEXT — Step 1 (What the company sells):
${step1Text}

SUPPORTING CONTEXT — Step 3 (Key decision makers):
${step3Text}
${provisionalNote}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}

In the "assumptions" array always include these four entries in addition to any data assumptions:
- "Step 5 (Root Cause) will refine the specific triggers and conditions that create this problem"
- "Step 6 (Effect) will surface the downstream business consequences if the problem goes unsolved"
- "Step 7 (Realization) will define the moment buyers recognise they have this problem"
- "Step 8 (Solution Criteria) will establish what an ideal resolution looks like to the buyer"`
  } else if (stepId === '11') {
    // Step 11: Compelling Value Propositions
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step2 = contextPacket.prerequisites.find(p => p.step_id === '2')
    const step4 = contextPacket.prerequisites.find(p => p.step_id === '4')
    const step5 = contextPacket.prerequisites.find(p => p.step_id === '5')
    const step6 = contextPacket.prerequisites.find(p => p.step_id === '6')

    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step2Text = step2 ? JSON.stringify(step2.content, null, 2) : 'Not yet available.'
    const step4Text = step4 ? JSON.stringify(step4.content, null, 2) : 'Not yet available.'
    const step5Text = step5 ? JSON.stringify(step5.content, null, 2) : 'Not yet available.'
    const step6Text = step6 ? JSON.stringify(step6.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write a Compelling Value Proposition (CVP) for Step 11.

A CVP is a 2-3 sentence statement that connects a specific buyer pain point to the company's unique solution and the measurable outcome the buyer achieves. It is written FROM the buyer's perspective, addresses their specific endemic problem, and leads with the outcome they care about most.

STRUCTURE OF A STRONG CVP:
- Sentence 1: Name the pain point and its business consequence (from the buyer's world)
- Sentence 2: Describe how the solution addresses it in a way competitors cannot
- Sentence 3: State the specific measurable outcome or transformation the buyer achieves

RULES:
- 2-3 sentences only. No bullets, no headers, no placeholders.
- Lead with the buyer outcome, not the product feature.
- Be specific to the pain point provided. Do not write a generic value proposition.
- Use the company name and specific language from the context below.
- Do not use the words 'revolutionary', 'cutting-edge', 'game-changing', 'leverage', 'empower', or 'unlock'.

CONFIDENCE SCORING:
- 71-100: Pain point, company profile, and product description all present and specific
- 41-70: Pain point present but company context is thin
- 0-40: Missing critical context, draft is speculative

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<2-3 sentence CVP>",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

PAIN POINT BEING DRAFTED FOR:
${extraContext || 'No specific pain point provided — write a general CVP from the endemic problem in Step 4.'}

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
${provisionalNote}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`

  } else if (stepId === '13') {
    // Step 13: Key Selling Points
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step2 = contextPacket.prerequisites.find(p => p.step_id === '2')
    const step11 = contextPacket.prerequisites.find(p => p.step_id === '11')
    const step4 = contextPacket.prerequisites.find(p => p.step_id === '4')

    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step2Text = step2 ? JSON.stringify(step2.content, null, 2) : 'Not yet available.'
    const step11Text = step11 ? JSON.stringify(step11.content, null, 2) : 'Not yet available.'
    const step4Text = step4 ? JSON.stringify(step4.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Your task: Write Key Selling Points (KSPs) for Step 13.

Key Selling Points are 3-5 specific proof points that support the Compelling Value Proposition from Step 11. Each KSP is a single sentence containing a concrete claim or metric that a sales rep can use in conversation to substantiate the CVP. They are NOT features — they are evidence that the CVP is true.

RULES:
- Write exactly 3-5 KSPs. Each is one sentence.
- Each KSP must contain a concrete, specific claim — a metric, a named capability, a quantified outcome, or a verifiable fact.
- KSPs must directly support the CVP from Step 11. If Step 11 is not yet available, derive KSPs from the company profile and endemic problem.
- Do not use vague language like 'best-in-class', 'industry-leading', or 'proven'. Use specific claims instead.
- If a metric is not available in the context, use a reasonable placeholder in brackets, e.g. [X%] or [Y days].

CONFIDENCE SCORING:
- 71-100: CVP (Step 11) and company profile are both present and specific
- 41-70: CVP is missing but company profile is sufficient to derive KSPs
- 0-40: Neither CVP nor sufficient company context is available

OUTPUT FORMAT: Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "draft": "<KSP 1>\\n<KSP 2>\\n<KSP 3>\\n[<KSP 4>]\\n[<KSP 5>]",
  "confidence": <integer 0-100>,
  "sources": ["<sources used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer to sharpen a KSP>"],
  "verification_checks": ["<factual claim the user should verify before using in sales conversations>"]
}

STEP 11 — Compelling Value Proposition (what the KSPs must prove):
${step11Text}

STEP 1 — Company Profile:
${step1Text}

STEP 2 — Product / Service Description:
${step2Text}

STEP 4 — Endemic Problem (buyer context):
${step4Text}
${provisionalNote}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}${currentContent ? `\nCURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`

  } else if (stepId === '17') {
    // Step 17: Target Competition
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step2 = contextPacket.prerequisites.find(p => p.step_id === '2')
    const step4 = contextPacket.prerequisites.find(p => p.step_id === '4')
    const step11 = contextPacket.prerequisites.find(p => p.step_id === '11')
    const step13 = contextPacket.prerequisites.find(p => p.step_id === '13')

    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step2Text = step2 ? JSON.stringify(step2.content, null, 2) : 'Not yet available.'
    const step4Text = step4 ? JSON.stringify(step4.content, null, 2) : 'Not yet available.'
    const step11Text = step11 ? JSON.stringify(step11.content, null, 2) : 'Not yet available.'
    const step13Text = step13 ? JSON.stringify(step13.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

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
${provisionalNote}
${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}${currentContent ? `\nCURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`

  } else if (stepId === 'survey-builder') {
    const audienceMatch = typeof extraContext === 'string' ? extraContext.match(/^Audience:\s*(.+)$/m) : null
    const audienceLabel = audienceMatch ? audienceMatch[1].trim() : 'Current Customers'

    const audienceInstructions =
      audienceLabel === 'Internal Stakeholders'
        ? `AUDIENCE: Internal Stakeholders
Frame all 15 questions for your internal sales and marketing team answering about HOW BUYERS make decisions — not about the company's own capabilities.
- Use language like "How do your customers typically...", "What do you believe your buyers care most about...", "In your experience, when do prospects..."
- Questions reveal where internal perception may align or diverge from buyer reality
- 2 of the 15 questions must focus on internal alignment: (1) whether sales and marketing agree on the primary buyer motivation, and (2) how confidently the team can describe the buyer's key decision criteria
`
        : audienceLabel === 'Lost Customers'
        ? `AUDIENCE: Lost Customers (prospects who evaluated but chose a competitor)
Frame all questions to understand why they chose a different provider.
- Use language like "When you evaluated solutions...", "What ultimately led you to choose a different provider...", "Looking back on your evaluation process..."
- 2 of the 15 questions must focus specifically on competitor comparison: (1) which competitor they chose and what primarily drove that choice, and (2) what that competitor offered that was absent or unclear from your solution
`
        : audienceLabel === 'Potential Customers'
        ? `AUDIENCE: Potential Customers (have not yet purchased)
Frame all questions in present tense about the respondent's current situation and future buying intent.
- Use language like "As you think about this problem today...", "When you eventually evaluate solutions...", "In your current environment...", "What would need to be true for you to..."
- Questions should uncover current pain, urgency, and buying readiness
`
        : /* Current Customers — default */
        `AUDIENCE: Current Customers
Frame all questions in past tense about the respondent's actual buying experience with your company.
- Use language like "When you chose us...", "Looking back on your decision...", "At the time you selected us...", "What convinced you to move forward with..."
- Questions should uncover the real reasons behind the choice, not post-purchase rationalisations
`

    systemPrompt = `CRITICAL: Your response must start with { and end with }. No markdown, no backticks, no prose, no explanation before or after the JSON.

You are Assembly AI Copilot, a B2B buyer research specialist.

Your task: Generate a tailored Decision Clarity Process (DCP) survey with EXACTLY 15 questions distributed across 7 buying journey stages, based on the Phase 1 company profile below.

${audienceInstructions}
REQUIRED DISTRIBUTION (must be exact):
- Stage 1 Need Recognition: 3 questions
- Stage 2 Information Search: 2 questions
- Stage 3 Evaluation of Alternatives: 2 questions
- Stage 4 Purchase Decision: 3 questions
- Stage 5 Purchase Process: 2 questions
- Stage 6 Post-Purchase Evaluation: 2 questions
- Stage 7 Loyalty and Advocacy: 1 question

REQUIRED TYPE DISTRIBUTION (total across all 15 questions):
- open: 10 questions
- scale: 3 questions
- multiple_choice: 2 questions

QUESTION WRITING RULES:
- Keep each question under 15 words — no sub-questions, no follow-ups, no compound sentences
- All questions follow the audience framing above — apply it consistently to every question
- Be specific to the industry, segments, and decision maker roles from the Phase 1 data below
- Every question must be tailored — no generic filler questions
- Open-ended: starts with "How", "What", "Why", "Describe", "Walk me through", "Tell me about", etc.
- Scale 1-10: assesses urgency, priority, or magnitude of something in the respondent's experience
- Multiple choice: offers 4 specific, realistic options directly relevant to the respondent's context

CONFIDENCE SCORING:
- 71-100: Phase 1 data (company profile, segments, decision makers) is complete and specific
- 41-70: Phase 1 data is partially available — some questions will be partially generic
- 0-40: Phase 1 data is missing — questions are generic DCP questions only

Return ONLY valid JSON with no markdown fences in this exact shape:
{
  "draft": "<1-2 sentence summary of the survey approach and what makes it tailored to this audience>",
  "confidence": <integer 0-100>,
  "sources": ["Step 1", "Step 2", "Step 3"],
  "assumptions": ["<assumption made about the buyer context>"],
  "open_questions": ["<something the user should verify before sending the survey>"],
  "verification_checks": ["<factual claim to verify>"],
  "survey": {
    "stage_1": [{"text": "<question>", "type": "open"}, {"text": "<question>", "type": "scale"}, {"text": "<question>", "type": "open"}],
    "stage_2": [{"text": "<question>", "type": "open"}, {"text": "<question>", "type": "open"}],
    "stage_3": [{"text": "<question>", "type": "open"}, {"text": "<question>", "type": "multiple_choice"}],
    "stage_4": [{"text": "<question>", "type": "scale"}, {"text": "<question>", "type": "open"}, {"text": "<question>", "type": "open"}],
    "stage_5": [{"text": "<question>", "type": "open"}, {"text": "<question>", "type": "open"}],
    "stage_6": [{"text": "<question>", "type": "scale"}, {"text": "<question>", "type": "open"}],
    "stage_7": [{"text": "<question>", "type": "multiple_choice"}]
  }
}

The type distribution in the shape above is prescriptive — follow it exactly.
Type values must be exactly: "open", "scale", or "multiple_choice"

STEP 1 — Company Profile (what the company sells and who it sells to):
${surveyBuilderStep1 || 'Not yet available — generate generic DCP questions.'}

STEP 2 — Target Market Segments:
${surveyBuilderStep2 || 'Not yet available.'}

STEP 3 — Key Decision Makers Per Segment:
${surveyBuilderStep3 || 'Not yet available.'}`

  } else {
    // Generic prompt for all other steps
    const prerequisiteBlock = contextPacket.prerequisites.length > 0
      ? contextPacket.prerequisites.map(p =>
          `### Step ${p.step_id} (hop ${p.hop_distance}, status: ${p.status})\n${JSON.stringify(p.content, null, 2)}`
        ).join('\n\n')
      : 'No prerequisites available.'

    const missingBlock = contextPacket.missing_prerequisites.length > 0
      ? `Missing prerequisite steps: ${contextPacket.missing_prerequisites.join(', ')}`
      : ''

    const provisionalNote = contextPacket.is_provisional
      ? 'NOTE: Some prerequisite data is not yet approved — treat this draft as provisional.'
      : ''

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist.

You are helping complete Step: "${stepTitle}"
Description: ${stepDescription || 'No description provided.'}

PREREQUISITE CONTEXT (upstream step outputs):
${prerequisiteBlock}

${missingBlock}
${provisionalNote}

CURRENT CONTENT (what the user has written so far):
${currentContent || '(empty — generate a first draft)'}

Your task: produce a structured JSON response for this step. Return ONLY valid JSON (no markdown fences, no prose) with this exact shape:
{
  "draft": "<the proposed content as a plain string>",
  "confidence": <integer 0-100>,
  "sources": ["<step_id or label used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<question the user should answer>"],
  "verification_checks": ["<factual claim to verify>"]
}

Confidence scoring:
- 71-100: all required prerequisites present and approved, draft is well-grounded
- 41-70: some prerequisites missing or unapproved, draft involves assumptions
- 0-40: major prerequisites missing, draft is highly speculative

Be specific, actionable, and grounded in the prerequisite data. Do not hallucinate facts not present in the context. Draft directly — do not ask the user for more information.${extraContext ? `\n\n${extraContext}` : ''}`
  }

  // Stream the response to the client
  const anthropic = new Anthropic({ apiKey })
  const maxTokens = stepId === 'survey-builder' ? 4000 : 1500

  // ── Step 1: two-step web search (search first, then generate clean JSON) ────
  let webSearchResults = ''
  if (stepId === '1' && !isImprove) {
    const searchTarget = orgName || (currentContent ? currentContent.slice(0, 200) : 'the company')
    const searchQuery = `Search for ${searchTarget} and return only the raw facts you find: company description, products/services, target customers, key differentiators. No prose, just facts.`
    try {
      const searchResponse = await anthropic.messages.create({
        model,
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: searchQuery }],
      })
      for (const block of searchResponse.content) {
        if (block.type === 'text') webSearchResults += block.text
      }
    } catch (searchErr) {
      const msg = searchErr instanceof Error ? searchErr.message : String(searchErr)
      console.warn('[copilot/draft] Step 1 web search pre-call failed:', msg)
    }
  }

  const userMessage = stepId === '1' && !isImprove
    ? `SEARCH RESULTS:\n${webSearchResults || '(no results found)'}\n\nGenerate the JSON now.`
    : stepId === 'survey-builder'
    ? 'Respond with only the JSON object. Start your response with { immediately.'
    : 'Generate the draft now.'

  let fullText = ''
  let streamError: string | null = null
  let streamErrorCode = 'unknown'
  const maxAttempts = 3

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      outer: for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const claudeStream = anthropic.messages.stream({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: userMessage }],
            system: systemPrompt,
          })

          for await (const chunk of claudeStream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const text = chunk.delta.text
              fullText += text
              controller.enqueue(encoder.encode(text))
            }
          }
          break outer // success
        } catch (err) {
          const status =
            typeof err === 'object' && err !== null && 'status' in err
              ? Number((err as { status: unknown }).status) || 0
              : 0

          streamError = err instanceof Error ? err.message : String(err)
          console.error(
            `[copilot/draft] Claude error on attempt ${attempt}/${maxAttempts} (HTTP ${status}):`,
            streamError,
          )

          // Retry on 5xx only if no content has been sent yet
          if (status >= 500 && status < 600 && fullText.length === 0 && attempt < maxAttempts) {
            await new Promise<void>(resolve => setTimeout(resolve, 1000))
            continue outer
          }

          streamErrorCode = status > 0 ? String(status) : 'unknown'
          controller.enqueue(encoder.encode(`\n__STREAM_ERROR__:${streamErrorCode}`))
          break outer
        }
      }

      // Write to copilot_run — non-fatal
      try {
        await supabase.from('copilot_run').insert({
          workspace_id: workspaceId,
          step_id: stepId,
          model,
          status: streamError ? 'error' : 'success',
          error_code: streamError ?? null,
        })
      } catch (insertErr) {
        const msg = insertErr instanceof Error ? insertErr.message : String(insertErr)
        console.error('[copilot/draft] copilot_run insert failed:', msg)
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Provisional': contextPacket.is_provisional ? '1' : '0',
      'X-Missing-Prerequisites': contextPacket.missing_prerequisites.join(','),
      'X-Estimated-Tokens': String(contextPacket.estimated_tokens),
    },
  })
}
