import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyzeRequestBody {
  orgId: string
}

interface StageSummary {
  stage_number: number
  stage_name: string
  summary: string
  confidence_score: number
}

interface AnalyzeResponse {
  stage_summaries: StageSummary[]
  overall_confidence: number
  dcp_map_id: string
}

// ── Stage definitions (canonical) ─────────────────────────────────────────────

const STAGES = [
  { stage_number: 1, stage_name: 'Need Recognition' },
  { stage_number: 2, stage_name: 'Trigger / Catalyst' },
  { stage_number: 3, stage_name: 'Search / Awareness' },
  { stage_number: 4, stage_name: 'Evaluation / Consideration' },
  { stage_number: 5, stage_name: 'Select-Set / Shortlist' },
  { stage_number: 6, stage_name: 'Decision / Purchase' },
  { stage_number: 7, stage_name: 'Confirmation / Validation' },
]

// ── POST /api/intelligence/analyze ────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleAnalyze(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[intelligence/analyze] unhandled error:', message)
    if (stack) console.error('[intelligence/analyze] stack:', stack)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleAnalyze(req: NextRequest): Promise<Response> {
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

  let body: AnalyzeRequestBody
  try {
    body = (await req.json()) as AnalyzeRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orgId } = body
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  // Load preferred model
  const { data: orgRow } = await supabase
    .from('organizations').select('preferred_model').eq('id', orgId).single()
  const model = orgRow
    ? String((orgRow as Record<string, unknown>)['preferred_model'] ?? 'claude-sonnet-4-20250514')
    : 'claude-sonnet-4-20250514'

  // Load latest survey responses
  const { data: responseRow } = await supabase
    .from('survey_responses')
    .select('parsed_responses, response_count')
    .eq('org_id', orgId)
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!responseRow) {
    return NextResponse.json({ error: 'No survey responses found for this workspace' }, { status: 422 })
  }

  const row = responseRow as Record<string, unknown>
  const parsedResponses = row['parsed_responses']
  const responseCount = Number(row['response_count'] ?? 0)

  const responseSample = JSON.stringify(parsedResponses).slice(0, 8000)

  // Build prompt
  const systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market analyst.

You have received ${responseCount} buyer survey responses. Your task is to analyze them and produce a structured Decision Criteria Profile (DCP) across 7 buying journey stages.

Return ONLY valid JSON (no markdown fences, no prose) with this exact shape:
{
  "stage_summaries": [
    {
      "stage_number": 1,
      "stage_name": "Need Recognition",
      "summary": "<2-4 sentence synthesis of what buyers said about this stage>",
      "confidence_score": <integer 0-100>
    },
    ... (all 7 stages)
  ],
  "overall_confidence": <integer 0-100>
}

Confidence scoring guidance:
- 75-100: Rich, consistent responses with clear patterns across multiple respondents
- 50-74: Good responses with some gaps or inconsistency
- 25-49: Thin responses, limited data, high variance
- 5-24: Insufficient data to draw conclusions

Stages to analyze:
${STAGES.map(s => `${s.stage_number}. ${s.stage_name}`).join('\n')}

Be specific and actionable. Identify patterns, common themes, and notable outliers. Write summaries in second-person ("Your buyers...").`

  const userMessage = `Here are the survey responses to analyze:\n\n${responseSample}`

  const anthropic = new Anthropic({ apiKey })
  const startMs = Date.now()

  let rawText = ''
  let claudeError: string | null = null

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 2000,
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

  // Write to copilot_run
  try {
    await supabase.from('copilot_run').insert({
      workspace_id: orgId,
      step_id: 'dcp-map',
      model,
      status: claudeError ? 'error' : 'success',
      error_code: claudeError ?? null,
      latency_ms: latencyMs,
    })
  } catch {
    // non-fatal
  }

  if (claudeError) {
    return NextResponse.json({ error: claudeError }, { status: 502 })
  }

  // Parse Claude response
  let parsed: { stage_summaries: StageSummary[]; overall_confidence: number }
  try {
    parsed = JSON.parse(rawText) as typeof parsed
  } catch {
    return NextResponse.json({ error: 'Copilot returned invalid JSON', raw: rawText }, { status: 502 })
  }

  const { stage_summaries, overall_confidence } = parsed

  // Upsert into dcp_maps
  const now = new Date().toISOString()
  let dcpMapId = ''

  const { data: existing } = await supabase
    .from('dcp_maps').select('id').eq('org_id', orgId).maybeSingle()

  if (existing) {
    const exRow = existing as Record<string, unknown>
    dcpMapId = String(exRow['id'] ?? '')
    await supabase.from('dcp_maps').update({
      stage_summaries,
      overall_confidence,
      status: 'draft',
      updated_at: now,
    }).eq('id', dcpMapId)
  } else {
    const { data: inserted } = await supabase.from('dcp_maps').insert({
      org_id: orgId,
      stage_summaries,
      overall_confidence,
      status: 'draft',
      created_at: now,
      updated_at: now,
    }).select('id').single()
    if (inserted) dcpMapId = String((inserted as Record<string, unknown>)['id'] ?? '')
  }

  const result: AnalyzeResponse = { stage_summaries, overall_confidence, dcp_map_id: dcpMapId }
  return NextResponse.json(result)
}
