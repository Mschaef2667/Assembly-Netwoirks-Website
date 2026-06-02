import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StageAnalysis {
  stage_number: number
  stage_name: string
  summary: string
  key_signals: string[]
  gaps: string[]
  confidence: number
  recommended_actions: string[]
  response_count: number
}

interface ClaudePayload {
  overall_confidence: number
  stages: Omit<StageAnalysis, 'response_count'>[]
}

interface DcpQuestion {
  id: string
  stage_number: number
  question_text: string
}

interface SurveyLinkQuestion {
  id: string
  stageId: number
  stage_id?: number
  text: string
}

interface SurveyLinkRow {
  id: string
  questions: SurveyLinkQuestion[] | null
}

interface SurveyResponseRow {
  id: string
  audience: string
  survey_link_id: string | null
  answers: Record<string, string>
}

interface AnalyzeResponse {
  stages: StageAnalysis[]
  overall_confidence: number
  dcp_map_id: string
  analysis_version: number
}

// ── Stage definitions ─────────────────────────────────────────────────────────

const STAGES = [
  { stage_number: 1, stage_name: 'Need Recognition' },
  { stage_number: 2, stage_name: 'Trigger / Catalyst' },
  { stage_number: 3, stage_name: 'Search / Awareness' },
  { stage_number: 4, stage_name: 'Evaluation / Consideration' },
  { stage_number: 5, stage_name: 'Select-Set / Shortlist' },
  { stage_number: 6, stage_name: 'Decision / Purchase' },
  { stage_number: 7, stage_name: 'Confirmation / Validation' },
]

// ── POST /api/intelligence/analyze-dcp ────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleAnalyzeDcp(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[analyze-dcp] unhandled error:', message)
    if (stack) console.error('[analyze-dcp] stack:', stack)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleAnalyzeDcp(_req: NextRequest): Promise<Response> {
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

  // Fetch responses, dcp_questions, and survey_links in parallel
  const [responsesRes, questionsRes, linksRes] = await Promise.all([
    supabase
      .from('survey_link_responses')
      .select('id, audience, survey_link_id, answers')
      .eq('org_id', orgId)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('dcp_questions')
      .select('id, stage_number, question_text')
      .order('stage_number'),
    supabase
      .from('survey_links')
      .select('id, questions')
      .eq('org_id', orgId),
  ])

  const responses = (responsesRes.data ?? []) as SurveyResponseRow[]
  const dcpQuestions = (questionsRes.data ?? []) as DcpQuestion[]
  const surveyLinks = (linksRes.data ?? []) as SurveyLinkRow[]

  if (responses.length === 0) {
    return NextResponse.json({ error: 'No survey responses found for this workspace' }, { status: 422 })
  }

  // Build question_id → stage_number map from dcp_questions (canonical source)
  const questionStageMap = new Map<string, number>()
  const questionTextMap = new Map<string, string>()
  for (const q of dcpQuestions) {
    questionStageMap.set(q.id, q.stage_number)
    questionTextMap.set(q.id, q.question_text)
  }

  // Supplement with questions from survey_links snapshots
  for (const link of surveyLinks) {
    if (!Array.isArray(link.questions)) continue
    for (const q of link.questions) {
      if (!questionStageMap.has(q.id)) {
        const stageNum = q.stageId ?? q.stage_id
        if (stageNum) questionStageMap.set(q.id, stageNum)
        if (q.text) questionTextMap.set(q.id, q.text)
      }
    }
  }

  // Group answer texts by stage number
  const stageAnswers = new Map<number, Array<{ audience: string; text: string }>>()
  for (let i = 1; i <= 7; i++) stageAnswers.set(i, [])

  for (const response of responses) {
    for (const [questionId, answerText] of Object.entries(response.answers)) {
      if (!answerText?.trim()) continue
      const stageNum = questionStageMap.get(questionId)
      if (!stageNum) continue
      stageAnswers.get(stageNum)?.push({
        audience: response.audience,
        text: answerText.trim(),
      })
    }
  }

  // Count responses (distinct responses that have at least one mapped answer) per stage
  const stageResponseCounts = new Map<number, Set<string>>()
  for (let i = 1; i <= 7; i++) stageResponseCounts.set(i, new Set())
  for (const response of responses) {
    for (const questionId of Object.keys(response.answers)) {
      const stageNum = questionStageMap.get(questionId)
      if (stageNum && response.answers[questionId]?.trim()) {
        stageResponseCounts.get(stageNum)?.add(response.id)
      }
    }
  }

  // Build context packet for Claude
  const stageContexts = STAGES.map(({ stage_number, stage_name }) => {
    const answers = stageAnswers.get(stage_number) ?? []
    if (answers.length === 0) {
      return `Stage ${stage_number}: ${stage_name}\n[No responses collected for this stage]`
    }
    const lines = answers.slice(0, 60).map(a => `[${a.audience}] ${a.text}`)
    return `Stage ${stage_number}: ${stage_name}\n${lines.join('\n')}`
  }).join('\n\n---\n\n')

  const systemPrompt = `You are Assembly AI Copilot analyzing buyer decision intelligence using the C3 Method. You will receive survey responses from multiple audiences (internal, current, lost, potential) organized by the 7 stages of the Decision Clarity Process.

For each stage analyze ALL responses and generate:
1) A stage summary (2-3 sentences describing the key patterns across audiences)
2) Key signals (3-5 bullet points of the most important findings)
3) Gaps identified (where internal beliefs differ from external reality, or where data is missing — empty array if none)
4) Confidence score (0-100 based on response quality and quantity)
5) Recommended actions (2-3 specific things the company should do based on this intelligence)

Confidence scoring:
- 75-100: Rich, consistent responses with clear patterns across multiple respondents
- 50-74: Good responses with some gaps or inconsistency
- 25-49: Thin responses, limited data, high variance
- 5-24: Insufficient data to draw meaningful conclusions

Return ONLY valid JSON (no markdown fences, no prose):
{
  "overall_confidence": <integer 0-100>,
  "stages": [
    {
      "stage_number": <integer>,
      "stage_name": "<string>",
      "summary": "<2-3 sentence synthesis writing in second-person: Your buyers...>",
      "key_signals": ["<signal>", "<signal>", "<signal>"],
      "gaps": ["<gap>"],
      "confidence": <integer 0-100>,
      "recommended_actions": ["<action>", "<action>", "<action>"]
    }
  ]
}`

  const userMessage = `Analyze these ${responses.length} survey responses:\n\n${stageContexts.slice(0, 14000)}`

  const anthropic = new Anthropic({ apiKey })
  const startMs = Date.now()
  let rawText = ''
  let claudeError: string | null = null

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 4000,
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
      step_id: 'dcp-map',
      model,
      status: claudeError ? 'error' : 'success',
      error_code: claudeError ?? null,
      latency_ms: latencyMs,
    })
  } catch { /* non-fatal */ }

  if (claudeError) return NextResponse.json({ error: claudeError }, { status: 502 })

  let parsed: ClaudePayload
  try {
    parsed = JSON.parse(rawText) as ClaudePayload
  } catch {
    return NextResponse.json({ error: 'Copilot returned invalid JSON', raw: rawText }, { status: 502 })
  }

  if (!Array.isArray(parsed.stages)) {
    return NextResponse.json({ error: 'Copilot response missing stages array', raw: rawText }, { status: 502 })
  }

  // Inject response counts into stage data
  const stages: StageAnalysis[] = parsed.stages.map(s => ({
    ...s,
    key_signals: Array.isArray(s.key_signals) ? s.key_signals : [],
    gaps: Array.isArray(s.gaps) ? s.gaps : [],
    recommended_actions: Array.isArray(s.recommended_actions) ? s.recommended_actions : [],
    response_count: stageResponseCounts.get(s.stage_number)?.size ?? 0,
  }))
  const overall_confidence = typeof parsed.overall_confidence === 'number' ? parsed.overall_confidence : 0

  // Upsert dcp_analysis — increment analysis_version on each re-run
  const now = new Date().toISOString()
  let dcpMapId = ''
  let analysisVersion = 1

  const { data: existing } = await supabase
    .from('dcp_analysis').select('id, analysis_version').eq('org_id', orgId).maybeSingle()

  if (existing) {
    const exRow = existing as Record<string, unknown>
    dcpMapId = String(exRow['id'] ?? '')
    analysisVersion = Number(exRow['analysis_version'] ?? 1) + 1
    await supabase.from('dcp_analysis').update({
      stage_summaries: stages,
      overall_confidence,
      analysis_version: analysisVersion,
      status: 'draft',
      updated_at: now,
    }).eq('id', dcpMapId)
  } else {
    const { data: inserted } = await supabase.from('dcp_analysis').insert({
      org_id: orgId,
      stage_summaries: stages,
      overall_confidence,
      analysis_version: 1,
      status: 'draft',
      created_at: now,
      updated_at: now,
    }).select('id').single()
    if (inserted) dcpMapId = String((inserted as Record<string, unknown>)['id'] ?? '')
  }

  const result: AnalyzeResponse = { stages, overall_confidence, dcp_map_id: dcpMapId, analysis_version: analysisVersion }
  return NextResponse.json(result)
}
