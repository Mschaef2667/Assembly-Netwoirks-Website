import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoryInsight {
  insights: string[]
  confidence: number
}

interface InsightsPayload {
  generated_at: string
  overall_confidence: number
  categories: {
    internal_external_gap: CategoryInsight
    product_gaps: CategoryInsight
    key_competitors: CategoryInsight
    decision_signals: CategoryInsight
    brand_perception: CategoryInsight
    segment_differences: CategoryInsight
  }
}

interface SurveyResponseRow {
  id: string
  audience: string
  segment_slug: string | null
  answers: Record<string, string>
}

interface DcpQuestionRow {
  id: string
  stage_number: number
  question_text: string
}

interface DcpAnalysisRow {
  stage_summaries: unknown
  overall_confidence: number | null
}

interface StepOutputRow {
  step_id: string
  content: Record<string, unknown>
  version: number
}

// ── POST /api/intelligence/generate-insights ──────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleGenerateInsights(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[generate-insights] unhandled error:', message)
    if (stack) console.error('[generate-insights] stack:', stack)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleGenerateInsights(_req: NextRequest): Promise<Response> {
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users').select('org_id').eq('id', user.id).single()
  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const orgId = String((userRow as Record<string, unknown>)['org_id'] ?? '')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { data: orgRow } = await supabase
    .from('organizations').select('preferred_model').eq('id', orgId).single()
  const model = orgRow
    ? String((orgRow as Record<string, unknown>)['preferred_model'] ?? 'claude-sonnet-4-5')
    : 'claude-sonnet-4-5'

  // Fetch responses, DCP questions, DCP analysis, and Phase 1 data in parallel
  const [responsesRes, questionsRes, dcpRes, phaseRes] = await Promise.all([
    supabase
      .from('survey_link_responses')
      .select('id, audience, segment_slug, answers')
      .eq('org_id', orgId)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('dcp_questions')
      .select('id, stage_number, question_text')
      .order('stage_number'),
    supabase
      .from('dcp_analysis')
      .select('stage_summaries, overall_confidence')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('step_output')
      .select('step_id, content, version')
      .eq('workspace_id', orgId)
      .in('step_id', ['1', '2', '3'])
      .order('version', { ascending: false }),
  ])

  const responses = (responsesRes.data ?? []) as SurveyResponseRow[]
  const dcpQuestions = (questionsRes.data ?? []) as DcpQuestionRow[]
  const dcpAnalysis = (dcpRes.data ?? null) as DcpAnalysisRow | null

  if (responses.length === 0) {
    return NextResponse.json({
      error: 'No survey responses found. Collect responses before generating insights.',
    }, { status: 422 })
  }

  // Extract Phase 1 step content (latest version per step)
  let step1: Record<string, unknown> | null = null
  let step2: Record<string, unknown> | null = null
  let step3: Record<string, unknown> | null = null
  const seen = new Set<string>()
  for (const row of (phaseRes.data ?? []) as StepOutputRow[]) {
    if (seen.has(row.step_id)) continue
    seen.add(row.step_id)
    if (row.step_id === '1') step1 = row.content
    else if (row.step_id === '2') step2 = row.content
    else if (row.step_id === '3') step3 = row.content
  }

  // Build question_id → text & stage map
  const questionTextMap = new Map<string, string>()
  const questionStageMap = new Map<string, number>()
  for (const q of dcpQuestions) {
    questionTextMap.set(q.id, q.question_text)
    questionStageMap.set(q.id, q.stage_number)
  }

  // Group answers by audience for the prompt
  const answersByAudience = new Map<string, Array<{ question: string; stage: number; text: string; segment: string }>>()
  for (const r of responses) {
    const list = answersByAudience.get(r.audience) ?? []
    for (const [qid, answerText] of Object.entries(r.answers ?? {})) {
      if (!answerText?.trim()) continue
      list.push({
        question: questionTextMap.get(qid) ?? qid,
        stage: questionStageMap.get(qid) ?? 0,
        text: answerText.trim(),
        segment: r.segment_slug ?? 'unspecified',
      })
    }
    answersByAudience.set(r.audience, list)
  }

  const audienceBlocks: string[] = []
  for (const [audience, items] of answersByAudience.entries()) {
    if (items.length === 0) continue
    const lines = items.slice(0, 80).map(a => `  [Stage ${a.stage} | ${a.segment}] Q: ${a.question}\n    A: ${a.text}`)
    audienceBlocks.push(`Audience: ${audience} (${items.length} answers)\n${lines.join('\n')}`)
  }

  const dcpSummary = dcpAnalysis && Array.isArray(dcpAnalysis.stage_summaries)
    ? JSON.stringify(dcpAnalysis.stage_summaries, null, 2).slice(0, 6000)
    : 'No DCP analysis available yet.'

  const phase1Summary = [
    step1 ? `Product, Service, or Cause:\n${JSON.stringify(step1, null, 2)}` : 'Product, Service, or Cause: not yet provided.',
    step2 ? `Target Segments:\n${JSON.stringify(step2, null, 2)}` : 'Target Segments: not yet provided.',
    step3 ? `Decision Makers:\n${JSON.stringify(step3, null, 2)}` : 'Decision Makers: not yet provided.',
  ].join('\n\n').slice(0, 4000)

  const systemPrompt = `CRITICAL: Respond with ONLY a valid JSON object. Start your response with { and end with }. No markdown, no backticks, no prose before or after the JSON.

You are Assembly AI Copilot analyzing buyer decision intelligence to surface strategic insights. You will receive survey responses from multiple audiences (internal stakeholders, current customers, lost customers, potential customers) and a DCP analysis. Generate insights across 6 categories. For each category provide 3-5 specific, actionable insight bullets grounded in the actual response data. Be specific -- reference actual patterns from the data, not generic observations.

Categories:
1) internal_external_gap — Where the internal team's beliefs differ from what real buyers (current, lost, potential) said. Compare internal answers against external audience answers and surface concrete divergences.
2) product_gaps — Unmet needs surfaced in the response data. Things buyers want that the company does not currently offer or emphasize.
3) key_competitors — Who came up most often in responses and in what context. Competitive threats and opportunities.
4) decision_signals — The highest-leverage moments in the buying journey. What triggers action, what accelerates decisions, what causes stalls.
5) brand_perception — How buyers describe the company versus how the company describes itself. Language gaps and positioning opportunities.
6) segment_differences — Where different target segments differ in their decision process (e.g. B2B SaaS vs Professional Services).

Confidence scoring per category (0-100):
- 75-100: Rich, consistent data across multiple respondents
- 50-74: Good data with some gaps
- 25-49: Thin data, limited respondents
- 5-24: Insufficient data

Return ONLY valid JSON in this exact shape:
{
  "generated_at": "<ISO 8601 timestamp>",
  "overall_confidence": <integer 0-100>,
  "categories": {
    "internal_external_gap": { "insights": ["<insight>", "<insight>"], "confidence": <integer> },
    "product_gaps": { "insights": ["<insight>"], "confidence": <integer> },
    "key_competitors": { "insights": ["<insight>"], "confidence": <integer> },
    "decision_signals": { "insights": ["<insight>"], "confidence": <integer> },
    "brand_perception": { "insights": ["<insight>"], "confidence": <integer> },
    "segment_differences": { "insights": ["<insight>"], "confidence": <integer> }
  }
}`

  const userMessage = `Total responses: ${responses.length}

# Company Context (Phase 1)
${phase1Summary}

# DCP Analysis (stage summaries)
${dcpSummary}

# Survey Responses by Audience
${audienceBlocks.join('\n\n---\n\n').slice(0, 16000)}

Generate the 6-category insights now. Be specific and quote/paraphrase real patterns from the response data above.`

  const anthropic = new Anthropic({ apiKey })
  const startMs = Date.now()
  let rawText = ''
  let claudeError: string | null = null

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
  } catch (err) {
    claudeError = err instanceof Error ? err.message : String(err)
  }

  const latencyMs = Date.now() - startMs

  try {
    await supabase.from('copilot_run').insert({
      workspace_id: orgId,
      step_id: 'insights',
      model,
      status: claudeError ? 'error' : 'success',
      error_code: claudeError ?? null,
      latency_ms: latencyMs,
    })
  } catch { /* non-fatal */ }

  if (claudeError) return NextResponse.json({ error: claudeError }, { status: 502 })

  let parsed: InsightsPayload
  try {
    const firstBrace = rawText.indexOf('{')
    const lastBrace = rawText.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('No JSON object found in response')
    }
    parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as InsightsPayload
  } catch (parseErr) {
    console.error('[generate-insights] JSON parse error:', parseErr instanceof Error ? parseErr.message : String(parseErr))
    console.error('[generate-insights] Raw response (first 500 chars):', rawText.slice(0, 500))
    return NextResponse.json({ error: 'Copilot returned invalid JSON', raw: rawText }, { status: 502 })
  }

  if (!parsed.categories || typeof parsed.categories !== 'object') {
    return NextResponse.json({ error: 'Copilot response missing categories', raw: rawText }, { status: 502 })
  }

  const generatedAt = parsed.generated_at && typeof parsed.generated_at === 'string'
    ? parsed.generated_at
    : new Date().toISOString()
  const insights: InsightsPayload = {
    generated_at: generatedAt,
    overall_confidence: typeof parsed.overall_confidence === 'number' ? parsed.overall_confidence : 0,
    categories: parsed.categories,
  }

  // Save to step_output with step_id='insights' (upsert by workspace_id + step_id)
  const now = new Date().toISOString()
  const { data: existing } = await supabase
    .from('step_output')
    .select('id')
    .eq('workspace_id', orgId)
    .eq('step_id', 'insights')
    .maybeSingle()

  if (existing) {
    const existingId = String((existing as Record<string, unknown>)['id'] ?? '')
    await supabase
      .from('step_output')
      .update({
        content: insights as unknown as Record<string, unknown>,
        last_saved_at: now,
        last_updated_at: now,
        copilot_assisted: true,
      })
      .eq('id', existingId)
  } else {
    await supabase
      .from('step_output')
      .insert({
        workspace_id: orgId,
        step_id: 'insights',
        version: 1,
        status: 'draft',
        content: insights as unknown as Record<string, unknown>,
        copilot_assisted: true,
        last_saved_at: now,
        last_updated_at: now,
      })
  }

  return NextResponse.json(insights)
}
