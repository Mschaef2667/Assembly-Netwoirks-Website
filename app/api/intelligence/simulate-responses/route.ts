import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SimulateBody {
  audience: string
  segmentSlug: string
  segmentName: string
  count: number
}

interface SurveyQuestion {
  id: string
  text: string
  stageId: number
}

interface SimulatedRespondent {
  name: string
  title: string
  company: string
  company_size: string
  decision_role: string
}

interface SimulatedResponse {
  respondent: SimulatedRespondent
  answers: Record<string, string>
}

interface ClaudePayload {
  responses: SimulatedResponse[]
}

const STAGE_NAMES: Record<number, string> = {
  1: 'Need Recognition',
  2: 'Motivation to Act',
  3: 'Information Search',
  4: 'Evaluation of Alternatives',
  5: 'Select Set',
  6: 'Purchase Decision',
  7: 'Confirmation',
}

const AUDIENCE_LABELS: Record<string, string> = {
  internal: 'Internal Stakeholders',
  current: 'Current Customers',
  lost: 'Lost Customers',
  potential: 'Potential Customers',
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleSimulate(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[simulate-responses] unhandled error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleSimulate(req: NextRequest): Promise<Response> {
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

  let body: SimulateBody
  try {
    body = (await req.json()) as SimulateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { audience, segmentSlug, segmentName } = body
  const count = Math.min(Math.max(1, Number(body.count) || 1), 10)
  if (!audience || !segmentSlug) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  // Fetch Phase 1 (Steps 1, 2, 3) and survey questions in parallel
  const surveyStepId = `survey-builder-${audience}-${segmentSlug}`
  const [phaseRes, surveyRes, orgRes] = await Promise.all([
    supabase
      .from('step_output')
      .select('step_id, content, version')
      .eq('workspace_id', orgId)
      .in('step_id', ['1', '2', '3'])
      .order('version', { ascending: false }),
    supabase
      .from('step_output')
      .select('content')
      .eq('workspace_id', orgId)
      .eq('step_id', surveyStepId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('organizations').select('preferred_model').eq('id', orgId).single(),
  ])

  // Extract step contents (latest version per step_id)
  let step1: Record<string, unknown> | null = null
  let step2: Record<string, unknown> | null = null
  let step3: Record<string, unknown> | null = null
  const seen = new Set<string>()
  for (const row of (phaseRes.data ?? []) as Array<{ step_id: string; content: Record<string, unknown> }>) {
    if (seen.has(row.step_id)) continue
    seen.add(row.step_id)
    if (row.step_id === '1') step1 = row.content
    else if (row.step_id === '2') step2 = row.content
    else if (row.step_id === '3') step3 = row.content
  }

  // Extract survey questions
  const questions: SurveyQuestion[] = []
  if (surveyRes.data) {
    const content = (surveyRes.data as Record<string, unknown>)['content'] as Record<string, unknown>
    const questionsMap = (content['questions'] ?? content) as Record<string, unknown>
    for (let stage = 1; stage <= 7; stage++) {
      const stageQs = questionsMap[String(stage)]
      if (!Array.isArray(stageQs)) continue
      for (const q of stageQs as Array<Record<string, unknown>>) {
        if (typeof q['id'] === 'string' && typeof q['text'] === 'string') {
          questions.push({ id: q['id'] as string, text: q['text'] as string, stageId: stage })
        }
      }
    }
  }

  if (questions.length === 0) {
    return NextResponse.json({
      error: `No survey found for this audience and segment. Build your survey first in the Survey Builder.`,
    }, { status: 422 })
  }

  const model = orgRes.data
    ? String((orgRes.data as Record<string, unknown>)['preferred_model'] ?? 'claude-sonnet-4-5')
    : 'claude-sonnet-4-5'

  // Pull decision makers for this segment from Step 3
  let segmentDecisionMakers = 'Not specified.'
  if (step3) {
    const segments = (step3['segments'] ?? step3) as Record<string, unknown>
    if (segments && typeof segments === 'object') {
      const segData = (segments as Record<string, unknown>)[segmentSlug] ?? (segments as Record<string, unknown>)[segmentName]
      if (segData) {
        segmentDecisionMakers = JSON.stringify(segData, null, 2)
      } else {
        segmentDecisionMakers = JSON.stringify(step3, null, 2)
      }
    } else {
      segmentDecisionMakers = JSON.stringify(step3, null, 2)
    }
  }

  const step1Text = step1 ? JSON.stringify(step1, null, 2) : 'Not yet available.'
  const step2Text = step2 ? JSON.stringify(step2, null, 2) : 'Not yet available.'

  const systemPrompt = `CRITICAL: Respond with ONLY a valid JSON object. Start your response with { and end with }. No markdown, no backticks, no prose before or after the JSON.

You are simulating realistic survey responses from potential B2B buyers who are actively evaluating outside GTM strategy partners but have not yet made a purchase decision. They are in the research and evaluation phase. Generate responses that reflect the perspective of a prospect -- their current pain points, what they are looking for in a partner, how they are thinking about the decision. Make responses feel authentic with specific business context and natural language. Vary perspectives based on the decision maker roles provided.

Return ONLY valid JSON starting with { and ending with }:
{
  "responses": [
    {
      "respondent": {
        "name": "<realistic full name>",
        "title": "<realistic job title>",
        "company": "<realistic company name>",
        "company_size": "<one of: 1-10 employees, 11-50 employees, 51-200 employees, 201-500 employees, 501-1,000 employees, 1,000+ employees>",
        "decision_role": "<one of: Final Decision Maker, Strong Influence, Evaluator / Analyst, Champion (internal advocate), Gatekeeper / Procurement, End User>"
      },
      "answers": {
        "<question_id>": "<2-5 sentence realistic answer in first person>"
      }
    }
  ]
}`

  // Build questions list with stable IDs
  const questionsBlock = questions.map((q, i) =>
    `[${q.id}] (Stage ${q.stageId} - ${STAGE_NAMES[q.stageId] ?? `Stage ${q.stageId}`}) Q${i + 1}: ${q.text}`,
  ).join('\n')

  const userMessage = `COMPANY PROFILE (Step 1):
${step1Text}

TARGET MARKET SEGMENTS (Step 2):
${step2Text}

DECISION MAKERS FOR SEGMENT "${segmentName}" (Step 3):
${segmentDecisionMakers}

AUDIENCE TYPE: ${AUDIENCE_LABELS[audience] ?? audience}
SEGMENT: ${segmentName}

SURVEY QUESTIONS (use the bracketed id verbatim as the answer key):
${questionsBlock}

Generate ${count} simulated response${count !== 1 ? 's' : ''}. The "answers" object MUST use the exact bracketed question ids above as keys.`

  const anthropic = new Anthropic({ apiKey })
  const startMs = Date.now()
  let rawText = ''
  let claudeError: string | null = null

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 5000,
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
      step_id: 'simulate-responses',
      model,
      status: claudeError ? 'error' : 'success',
      error_code: claudeError ?? null,
      latency_ms: latencyMs,
    })
  } catch { /* non-fatal */ }

  if (claudeError) return NextResponse.json({ error: claudeError }, { status: 502 })

  let parsed: ClaudePayload
  try {
    const firstBrace = rawText.indexOf('{')
    const lastBrace = rawText.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('No JSON object found in response')
    }
    parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as ClaudePayload
  } catch (parseErr) {
    console.error('[simulate-responses] JSON parse error:', parseErr instanceof Error ? parseErr.message : String(parseErr))
    console.error('[simulate-responses] Raw response (first 500 chars):', rawText.slice(0, 500))
    return NextResponse.json({ error: 'Copilot returned invalid JSON', raw: rawText.slice(0, 500) }, { status: 502 })
  }

  if (!Array.isArray(parsed.responses)) {
    return NextResponse.json({ error: 'Copilot response missing responses array' }, { status: 502 })
  }

  return NextResponse.json({
    responses: parsed.responses,
    questions,
  })
}
