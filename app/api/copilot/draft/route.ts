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

  // ── Steps 4-9: fetch DCP stage summaries (lives in dcp_analysis) ──
  let dcpStage1Summary = ''
  let dcpStage2Summary = ''
  let dcpStage3Summary = ''
  let dcpStage4Summary = ''
  const ENDEMIC_STEPS = new Set(['4', '5', '6', '7', '8', '9'])
  if (ENDEMIC_STEPS.has(stepId)) {
    try {
      const { data: dcpRow } = await supabase
        .from('dcp_analysis')
        .select('stage_summaries')
        .eq('org_id', workspaceId)
        .maybeSingle()
      if (dcpRow) {
        const summaries = (dcpRow as Record<string, unknown>)['stage_summaries'] as
          Array<{ stage_number: number; summary: string }> | null
        const findStage = (n: number) => summaries?.find(s => s.stage_number === n)?.summary ?? ''
        dcpStage1Summary = findStage(1)
        dcpStage2Summary = findStage(2)
        dcpStage3Summary = findStage(3)
        dcpStage4Summary = findStage(4)
      }
    } catch { /* non-fatal — proceed with lower confidence */ }
  }

  const DCP_RESEARCH_INSTRUCTION = 'DCP RESEARCH: Use the following buyer research to ground this step in real data rather than assumptions. The research reflects what actual buyers told us about their decision journey.'

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

  // ── Survey-builder (main + autowording): fetch Steps 1, 2, 3 directly ──────────
  let surveyBuilderStep1 = ''
  let surveyBuilderStep2 = ''
  let surveyBuilderStep3 = ''
  let surveyBuilderIcpBlock = ''
  if (stepId === 'survey-builder' || stepId === 'survey-builder-autowording') {
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

    try {
      const { data: icpRows } = await supabase
        .from('icp_definition')
        .select('segment_name, buyer_type, job_titles, primary_challenges, buying_urgency_trigger')
        .eq('org_id', workspaceId)
        .order('segment_index')
      if (icpRows && icpRows.length > 0) {
        const parts: string[] = []
        for (const row of icpRows as Array<Record<string, unknown>>) {
          const segment = String(row['segment_name'] ?? '').trim()
          const buyer = String(row['buyer_type'] ?? '').trim()
          const header = [segment, buyer].filter(Boolean).join(' — ') || 'ICP'
          const jobTitlesRaw = row['job_titles']
          const jobTitles = Array.isArray(jobTitlesRaw)
            ? (jobTitlesRaw as unknown[]).map(v => String(v).trim()).filter(Boolean).join(', ')
            : ''
          const challenges = String(row['primary_challenges'] ?? '').trim()
          const trigger = String(row['buying_urgency_trigger'] ?? '').trim()
          const lines = [`ICP: ${header}`]
          if (jobTitles)  lines.push(`  Job Titles: ${jobTitles}`)
          if (challenges) lines.push(`  Key Challenges: ${challenges}`)
          if (trigger)    lines.push(`  Buying Trigger: ${trigger}`)
          parts.push(lines.join('\n'))
        }
        surveyBuilderIcpBlock = parts.join('\n\n')
      }
    } catch { /* non-fatal — proceed without ICP context */ }
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

PAIN POINTS:
- Generate 3 DISTINCT pain points. Each pain point should represent a different facet of the endemic problem from the buyer perspective.
- Pain Point 1 = the strategic/systemic problem.
- Pain Point 2 = the operational/execution problem.
- Pain Point 3 = the measurement/visibility problem.
- Do not repeat the same content across pain points.

CONFIDENCE SCORING:
- 71-100: DCP Stage 1 and Stage 2 summaries are present and specific; company profile is complete
- 41-70: DCP stages present but thin, or company profile is partially complete
- 0-40: No DCP data available; draft is speculative from company profile alone

${DCP_RESEARCH_INSTRUCTION}

PRIMARY SOURCE — DCP Map, Stage 1 (Need Recognition):
${dcpStage1Summary || 'Not yet available — draft from company profile with low confidence.'}

PRIMARY SOURCE — DCP Map, Stage 2 (Motivation to Act):
${dcpStage2Summary || 'Not yet available — draft from company profile with low confidence.'}

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
  } else if (stepId === '5' || stepId === '6' || stepId === '7' || stepId === '8' || stepId === '9') {
    // Steps 5-9: Endemic Problems — grounded in DCP Map research
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step4 = contextPacket.prerequisites.find(p => p.step_id === '4')
    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step4Text = step4 ? JSON.stringify(step4.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    const endemicConfig: Record<string, { name: string; focus: string; dcpLabel: string; dcpSummary: string }> = {
      '5': {
        name: 'The Cause',
        focus: 'The root causes that create the endemic problem from Step 4. What conditions, gaps, or triggers produce this problem in the buyer\'s world?',
        dcpLabel: 'DCP Map, Stage 1 (Need Recognition) — root causes and key signals',
        dcpSummary: dcpStage1Summary,
      },
      '6': {
        name: 'The Effect',
        focus: 'The downstream business consequences if the endemic problem is left unsolved — quantified where possible.',
        dcpLabel: 'DCP Map, Stage 2 (Motivation to Act) — consequences and key signals',
        dcpSummary: dcpStage2Summary,
      },
      '7': {
        name: 'The Realization',
        focus: 'The specific trigger moment when buyers recognize they have this problem and need to act.',
        dcpLabel: 'DCP Map, Stage 2 (Motivation to Act) — trigger moments',
        dcpSummary: dcpStage2Summary,
      },
      '8': {
        name: 'The Solution Criteria',
        focus: 'The evaluation signals and criteria buyers use to judge an ideal resolution to this problem.',
        dcpLabel: 'DCP Map, Stage 4 (Evaluation of Alternatives) — evaluation signals and key signals',
        dcpSummary: dcpStage4Summary,
      },
      '9': {
        name: 'The Search',
        focus: 'How buyers search for information and solutions — channels, sources, and information search patterns.',
        dcpLabel: 'DCP Map, Stage 3 (Information Search) — information search patterns and key signals',
        dcpSummary: dcpStage3Summary,
      },
    }

    const cfg = endemicConfig[stepId]!

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

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
${provisionalNote}
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

  } else if (stepId === '10') {
    // Step 10: The Formula — If you do [Solution - Step 8] it will solve [Problem - Step 4] thereby reducing [Effect - Step 6]
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step4 = contextPacket.prerequisites.find(p => p.step_id === '4')
    const step6 = contextPacket.prerequisites.find(p => p.step_id === '6')
    const step8 = contextPacket.prerequisites.find(p => p.step_id === '8')

    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step4Text = step4 ? JSON.stringify(step4.content, null, 2) : 'Not yet available.'
    const step6Text = step6 ? JSON.stringify(step6.content, null, 2) : 'Not yet available.'
    const step8Text = step8 ? JSON.stringify(step8.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

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
${provisionalNote}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`

  } else if (stepId === '11') {
    // Step 11: Compelling Value Propositions
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step4 = contextPacket.prerequisites.find(p => p.step_id === '4')
    const step6 = contextPacket.prerequisites.find(p => p.step_id === '6')

    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step4Text = step4 ? JSON.stringify(step4.content, null, 2) : 'Not yet available.'
    const step6Text = step6 ? JSON.stringify(step6.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    systemPrompt = `You are helping write Compelling Value Propositions (CVPs) using the C3 Method. Each CVP must be written as a promise that directly connects the company's product or service to a specific pain point and its business effect.

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
${provisionalNote}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`

  } else if (stepId === '12') {
    // Step 12: Critical Success Factors — execution requirements per CVP promise
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step11 = contextPacket.prerequisites.find(p => p.step_id === '11')

    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step11Text = step11 ? JSON.stringify(step11.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    systemPrompt = `You are helping define Critical Success Factors for each Compelling Value Proposition. Given the CVP promise below, identify 3-5 specific things the company MUST do, MUST have, or MUST NOT fail at in order to deliver on this promise. These are not aspirational goals -- they are non-negotiable execution requirements. Format as a bulleted list with a brief explanation for each. Be specific to this company and this promise.

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

  } else if (stepId === '27') {
    // Step 27: The Set-Up — strategic message opener
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step2 = contextPacket.prerequisites.find(p => p.step_id === '2')
    const step4 = contextPacket.prerequisites.find(p => p.step_id === '4')
    const step5 = contextPacket.prerequisites.find(p => p.step_id === '5')
    const step6 = contextPacket.prerequisites.find(p => p.step_id === '6')
    const step11 = contextPacket.prerequisites.find(p => p.step_id === '11')
    const step13 = contextPacket.prerequisites.find(p => p.step_id === '13')
    const step17 = contextPacket.prerequisites.find(p => p.step_id === '17')

    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step2Text = step2 ? JSON.stringify(step2.content, null, 2) : 'Not yet available.'
    const step4Text = step4 ? JSON.stringify(step4.content, null, 2) : 'Not yet available.'
    const step5Text = step5 ? JSON.stringify(step5.content, null, 2) : 'Not yet available.'
    const step6Text = step6 ? JSON.stringify(step6.content, null, 2) : 'Not yet available.'
    const step11Text = step11 ? JSON.stringify(step11.content, null, 2) : 'Not yet available.'
    const step13Text = step13 ? JSON.stringify(step13.content, null, 2) : 'Not yet available.'
    const step17Text = step17 ? JSON.stringify(step17.content, null, 2) : 'Not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    const inst = {
      name: 'The Set-Up',
      description: `The Set-Up is the opening of a strategic message. It establishes context by naming the endemic problem the buyer is experiencing, stated from their perspective without mentioning the solution. It creates the "yes, that's exactly our problem" moment.`,
      rules: `Write The Set-Up strategic message for this pain point. The Set-Up should:
1) Name the endemic problem in the buyer's language
2) Describe the business consequence if left unsolved
3) Create recognition without introducing the solution
2-3 sentences. No product mentions. Write from the buyer's world.`,
    }

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

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
${provisionalNote}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`

  } else if (stepId === '28' || stepId === '29' || stepId === '30') {
    // Steps 28-30: Strategic Messages with formula-based prompts (Jab, Knock-Out, Clean-Up)
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step4 = contextPacket.prerequisites.find(p => p.step_id === '4')
    const step6 = contextPacket.prerequisites.find(p => p.step_id === '6')
    const step11 = contextPacket.prerequisites.find(p => p.step_id === '11')
    const step17 = contextPacket.prerequisites.find(p => p.step_id === '17')

    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step4Text = step4 ? JSON.stringify(step4.content, null, 2) : 'Not yet available.'
    const step6Text = step6 ? JSON.stringify(step6.content, null, 2) : 'Not yet available.'
    const step11Text = step11 ? JSON.stringify(step11.content, null, 2) : 'Not yet available.'
    const step17Text = step17 ? JSON.stringify(step17.content, null, 2) : 'Not yet available.'

    // Steps 14, 18, 19 are not in step_dependency for 28-30 — fetch directly
    let step14Text = 'Not yet available.'
    let step18Text = 'Not yet available.'
    let step19Text = 'Not yet available.'
    try {
      const { data: extraRows } = await supabase
        .from('step_output')
        .select('step_id, content, version')
        .eq('workspace_id', workspaceId)
        .in('step_id', ['14', '18', '19'])
        .order('version', { ascending: false })
      if (extraRows) {
        const seen = new Set<string>()
        for (const row of extraRows as Array<{ step_id: string; content: Record<string, unknown> }>) {
          if (!seen.has(row.step_id)) {
            seen.add(row.step_id)
            const text = JSON.stringify(row.content, null, 2)
            if (row.step_id === '14') step14Text = text
            if (row.step_id === '18') step18Text = text
            if (row.step_id === '19') step19Text = text
          }
        }
      }
    } catch { /* non-fatal — primary sources may be missing */ }

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

    let messageName: string
    let messageInstruction: string
    let primarySourcesBlock: string

    if (stepId === '28') {
      messageName = 'The Jab'
      messageInstruction = 'Write The Jab using this exact formula: Our solution will [CVP] because of our commitment to [Core Competency]. The CVP comes from Step 11 (Compelling Value Propositions) and the Core Competency comes from Step 14. Be specific -- use the actual CVP and competency text, not placeholders. 2-3 sentences.'
      primarySourcesBlock = `PRIMARY SOURCE — Step 11 (Compelling Value Proposition):
${step11Text}

PRIMARY SOURCE — Step 14 (Core Competency):
${step14Text}`
    } else if (stepId === '29') {
      messageName = 'Knock-Out'
      messageInstruction = 'Write the Knock-Out using this formula: We are unique because of [specific competitive differentiator from Step 18]. Name the company, state the differentiator specifically, and connect it to why competitors cannot replicate it. 2-3 sentences.'
      primarySourcesBlock = `PRIMARY SOURCE — Step 18 (Competitive Differentiator):
${step18Text}`
    } else {
      messageName = 'Clean-Up'
      messageInstruction = 'Write the Clean-Up using this formula: [Competitive Advantage] will effectively solve [Effect] because [reason]. Use the specific competitive advantage from Step 19 and the specific effect from Step 6. This is the closing argument that connects your unique strength directly to the buyer\'s pain. 2-3 sentences.'
      primarySourcesBlock = `PRIMARY SOURCE — Step 19 (Competitive Advantage):
${step19Text}

PRIMARY SOURCE — Step 6 (The Effect):
${step6Text}`
    }

    systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

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
${provisionalNote}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`

  } else if (
    stepId === '31' || stepId === '32' || stepId === '33' || stepId === '34' ||
    stepId === '35' || stepId === '36' || stepId === '37' || stepId === '38'
  ) {
    // Steps 31-38: Action Plan (Strategic Plan execution phases)
    const step1 = contextPacket.prerequisites.find(p => p.step_id === '1')
    const step2 = contextPacket.prerequisites.find(p => p.step_id === '2')
    const step3 = contextPacket.prerequisites.find(p => p.step_id === '3')
    const step4 = contextPacket.prerequisites.find(p => p.step_id === '4')
    const step11 = contextPacket.prerequisites.find(p => p.step_id === '11')
    const step13 = contextPacket.prerequisites.find(p => p.step_id === '13')
    const step17 = contextPacket.prerequisites.find(p => p.step_id === '17')
    const step27 = contextPacket.prerequisites.find(p => p.step_id === '27')
    const step28 = contextPacket.prerequisites.find(p => p.step_id === '28')
    const step29 = contextPacket.prerequisites.find(p => p.step_id === '29')
    const step30 = contextPacket.prerequisites.find(p => p.step_id === '30')

    const step1Text = step1 ? JSON.stringify(step1.content, null, 2) : 'Not yet available.'
    const step2Text = step2 ? JSON.stringify(step2.content, null, 2) : 'Not yet available.'
    const step3Text = step3 ? JSON.stringify(step3.content, null, 2) : 'Not yet available.'
    const step4Text = step4 ? JSON.stringify(step4.content, null, 2) : 'Not yet available.'
    const step11Text = step11 ? JSON.stringify(step11.content, null, 2) : 'Not yet available.'
    const step13Text = step13 ? JSON.stringify(step13.content, null, 2) : 'Not yet available.'
    const step17Text = step17 ? JSON.stringify(step17.content, null, 2) : 'Not yet available.'
    const messagesBlock = [
      step27 ? `Step 27 — The Set-Up:\n${JSON.stringify(step27.content, null, 2)}` : '',
      step28 ? `Step 28 — The Jab:\n${JSON.stringify(step28.content, null, 2)}` : '',
      step29 ? `Step 29 — Knock-Out:\n${JSON.stringify(step29.content, null, 2)}` : '',
      step30 ? `Step 30 — Clean-Up:\n${JSON.stringify(step30.content, null, 2)}` : '',
    ].filter(Boolean).join('\n\n') || 'Strategic messages not yet available.'

    const provisionalNote = contextPacket.is_provisional
      ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
      : ''

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

    systemPrompt = `You are Assembly AI Copilot helping complete the Action Plan section of the C3 Method Strategic Plan. Each Action Plan step represents a phase of go-to-market execution. Using the approved strategic messages, CVPs, competitive analysis, and ICP from upstream steps, generate a specific, actionable plan for this step.

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
${provisionalNote}
${currentContent ? `CURRENT DRAFT (refine if present, otherwise replace):\n${currentContent}` : ''}`

  } else if (stepId === 'survey-builder') {
    const audienceMatch = typeof extraContext === 'string' ? extraContext.match(/^Audience:\s*(.+)$/m) : null
    const audienceLabel = audienceMatch ? audienceMatch[1].trim() : 'Current Customers'

    systemPrompt = `CRITICAL: Your response must start with { and end with }. No markdown, no backticks, no prose, no explanation before or after the JSON.

ROLE: You are Co-CSO, an AI-forward customer decision intelligence strategist using the C3 Method.

GOAL: Generate exactly 15 survey questions that uncover how buyers make decisions when purchasing the client's product or service. Questions must work across all target segments and decision maker roles defined in Phase 1 data. Questions should be generic enough to apply across segments but specific enough to surface real buying behavior.

QUESTION STYLE (follow these rules strictly):
- Behavioral: 'What most often triggers...' 'Who typically initiates...'
- Comparative: 'Which of these best describes...' 'Rank the following...'
- Process: 'Who did what, and when?' 'How many partners made your shortlist?'
- Risk/objection: 'What most often eliminates a partner?' 'What would cause you to delay?'
- Keep each question under 20 words
- No jargon, no double-barreled questions
- Use 'Other (please specify)' where appropriate
- Response types must be analyzable: include at least 2 ranking questions, 2 select-all-that-apply, 2 numeric/range or scale questions

STAGE FRAMEWORK (use these exact stage names and distribute questions exactly as shown):
Stage 1 — Need Recognition (2 questions): What triggers the search? How urgent is the need?
Stage 2 — Motivation to Act (2 questions): What outcome is expected? What is the cost of inaction?
Stage 3 — Information Search (2 questions): Who initiates the search? Where do they look first?
Stage 4 — Evaluation of Alternatives (3 questions): Which options are considered? What partner type? What proof is required?
Stage 5 — Select Set (2 questions): How many make the shortlist? What eliminates a partner?
Stage 6 — Purchase Decision (2 questions): Who controls budget? What is the investment range?
Stage 7 — Confirmation (2 questions): Who has final approval? What determines success?

AUDIENCE FRAMING: Apply the selected audience framing to every question:
- Current Customers: past tense -- 'When you chose...' 'Looking back on your decision...'
- Internal Stakeholders: internal perspective -- 'How do your customers typically...' 'What do you believe your buyers care most about...'
- Lost Customers: competitor focus -- 'When you evaluated solutions...' 'What led you to choose a different provider...'
- Potential Customers: present/future tense -- 'As you think about this problem today...' 'When you eventually evaluate solutions...'

SELECTED AUDIENCE: ${audienceLabel}

STAKEHOLDER COVERAGE: Include at least 3 questions that explicitly identify:
1. Who initiates the search
2. Who controls the budget
3. Who has final approval or veto power
Use the decision maker roles and titles from the Phase 1 data as response options where relevant.

PHASE 1 CONTEXT: Use the company profile, target segments, and decision maker data from Phase 1 to tailor response options. For example, if the client has identified 3 segments, include those segment-relevant titles in stakeholder questions. If they have specific industries, reference those in trigger event options.

OUTPUT FORMAT: Return ONLY valid JSON starting with { and ending with }. No markdown, no prose.
{
  "draft": "<one sentence summary of the survey>",
  "confidence": <integer 0-100>,
  "sources": ["<source used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<something the user should verify>"],
  "verification_checks": ["<factual claim to verify>"],
  "survey": {
    "stage_1": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_2": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_3": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_4": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_5": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_6": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_7": [{"text": "<question>", "type": "open | scale | multiple_choice"}]
  }
}

Type values must be exactly: "open", "scale", or "multiple_choice"

CONFIDENCE SCORING:
- 71-100: Phase 1 complete with segments, decision makers, and company profile
- 41-70: Partial Phase 1 data
- 0-40: No Phase 1 data available

STEP 1 — Company Profile (what the company sells and who it sells to):
${surveyBuilderStep1 || 'Not yet available — generate generic DCP questions.'}

STEP 2 — Target Market Segments:
${surveyBuilderStep2 || 'Not yet available.'}

STEP 3 — Key Decision Makers Per Segment:
${surveyBuilderStep3 || 'Not yet available.'}`

  } else if (stepId === 'survey-builder-autowording') {
    // Parse extraContext JSON: { segment, audience, questions: [{stage, text}] }
    let segmentName  = 'All Segments'
    let audienceLabel = 'Current Customers'
    let questionTexts: Array<{ stage: number; text: string }> = []
    try {
      const ctx = JSON.parse(extraContext ?? '{}') as {
        segment?: string
        audience?: string
        questions?: Array<{ stage: number; text: string }>
      }
      if (ctx.segment)   segmentName   = ctx.segment
      if (ctx.audience)  audienceLabel = ctx.audience
      if (ctx.questions) questionTexts = ctx.questions
    } catch { /* non-fatal — proceed with defaults */ }

    const questionsBlock = questionTexts
      .map((q, i) => `${i + 1}. [Stage ${q.stage}] ${q.text}`)
      .join('\n')

    systemPrompt = `You are an expert survey designer. You will receive 15 DCP survey questions and context about a specific company, target segment, and audience. Reword each question to fit the specific context — replace generic terms with the company name, product/service description, ICP-specific job titles, key challenges, and buying triggers. Use the actual ICP profiles below (not just segment names) so questions reference the real roles, pains, and triggers buyers experience. Keep the core meaning and structure of each question identical. Return ONLY valid JSON: { "questions": [{ "stage": <number>, "text": "<reworded question>" }] } with exactly 15 items in the same order received. No markdown, no prose.

COMPANY PROFILE (Step 1):
${surveyBuilderStep1 || 'Not yet available.'}

TARGET SEGMENTS (Step 2):
${surveyBuilderStep2 || 'Not yet available.'}

KEY DECISION MAKERS (Step 3):
${surveyBuilderStep3 || 'Not yet available.'}

ICP PROFILES (use these job titles, key challenges, and buying triggers when rewording questions):
${surveyBuilderIcpBlock || 'No ICP profiles defined yet — fall back to segment names and decision maker roles above.'}

TARGET SEGMENT: ${segmentName}
AUDIENCE: ${audienceLabel}

AUDIENCE FRAMING RULES:
- Current Customers: reword so the respondent reflects on their own past buying experience with this company.
- Lost Customers: reword so the respondent reflects on why they left or chose a competitor.
- Prospects / Never Customers: reword so the respondent describes their own evaluation and buying process.
- CRITICAL for Internal Stakeholders: Every question must be reframed from a third-person perspective. The respondent is an internal team member describing what they BELIEVE about their prospects/buyers — NOT a buyer describing their own experience. Replace "you/your" with "they/their/prospects/buyers/a typical buyer". Add context like "your prospects", "their leadership team", "a typical buyer" before key phrases. Example transformations: "What most often triggers your organization to consider outside GTM help?" → "What most often triggers your B2B prospects to consider hiring a GTM strategy partner like [Company]?" | "How urgent is the need once recognized?" → "How urgent is the need for [Company's solution] once a prospect recognizes it?" | "Who typically initiates the search?" → "Who in a prospect organization typically initiates the search for a solution like [Company's]?"

QUESTIONS TO REWORD (keep the same order, return exactly 15):
${questionsBlock || '(no questions provided — return the 15 standard DCP questions unchanged)'}`

  } else if (stepId === 'survey-builder-interview-probes') {
    // Parse extraContext: { questions: [{ question_id, text, stage }] }
    let interviewQuestions: Array<{ question_id: string; text: string; stage: number }> = []
    try {
      const ctx = JSON.parse(extraContext ?? '{}') as {
        questions?: Array<{ question_id: string; text: string; stage: number }>
      }
      if (ctx.questions) interviewQuestions = ctx.questions
    } catch { /* non-fatal */ }

    const questionsBlock = interviewQuestions
      .map((q, i) => `${i + 1}. [ID: ${q.question_id}] [Stage ${q.stage}] ${q.text}`)
      .join('\n')

    systemPrompt = `You are an expert qualitative researcher using the C3 Method buyer decision journey. You will receive a list of survey questions. For each question generate exactly 3 probing follow-up sub-questions a skilled interviewer would ask to go deeper. Sub-questions must be behavioral and specific. Keep each sub-question under 15 words. Return ONLY valid JSON starting with { and ending with }: { "probes": [{ "question_id": "<id>", "subs": ["<sub1>", "<sub2>", "<sub3>"] }] } with exactly one entry per question received. No markdown no prose no explanation.

QUESTIONS:
${questionsBlock || '(no questions provided)'}`

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
  const maxTokens = stepId === 'survey-builder' ? 4000
    : stepId === 'survey-builder-autowording' ? 2000
    : stepId === 'survey-builder-interview-probes' ? 3000
    : 1500

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
