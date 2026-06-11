import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

// ── Types ─────────────────────────────────────────────────────────────────────

type SectionKey =
  | 'introduction'
  | 'evaluation'
  | 'presentation'
  | 'proposal'
  | 'execution'
  | 'length'
  | 'decision_criteria'
  | 'keys_to_winning'

type SectionContent = Record<SectionKey, string>

const SECTION_KEYS: ReadonlyArray<SectionKey> = [
  'introduction',
  'evaluation',
  'presentation',
  'proposal',
  'execution',
  'length',
  'decision_criteria',
  'keys_to_winning',
]

// ── Route config ─────────────────────────────────────────────────────────────

export const maxDuration = 60

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return null
}

function parseSections(raw: string): SectionContent | null {
  const stripped = stripFences(raw)
  const candidates: string[] = []
  candidates.push(stripped)
  const extracted = extractFirstJsonObject(stripped)
  if (extracted) candidates.push(extracted)

  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate) as Record<string, unknown>
      const out: SectionContent = {
        introduction: '',
        evaluation: '',
        presentation: '',
        proposal: '',
        execution: '',
        length: '',
        decision_criteria: '',
        keys_to_winning: '',
      }
      let matched = false
      for (const key of SECTION_KEYS) {
        const v = obj[key]
        if (typeof v === 'string') {
          out[key] = v
          matched = true
        }
      }
      if (matched) return out
    } catch {
      // try next candidate
    }
  }
  return null
}

// ── POST /api/intelligence/competitive-evaluation ─────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleCompetitiveEvaluation(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[competitive-evaluation] unhandled error:', message)
    if (stack) console.error('[competitive-evaluation] stack:', stack)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleCompetitiveEvaluation(_req: NextRequest): Promise<Response> {
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
  if (!orgId) return NextResponse.json({ error: 'org_id missing' }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { data: orgRow } = await supabase
    .from('organizations').select('preferred_model').eq('id', orgId).single()
  const model = orgRow
    ? String((orgRow as Record<string, unknown>)['preferred_model'] ?? 'claude-sonnet-4-5')
    : 'claude-sonnet-4-5'

  // Fetch Steps 3 and 17 and DCP stage summaries in parallel
  const [stepsRes, dcpRes] = await Promise.all([
    supabase
      .from('step_output')
      .select('step_id, content, version')
      .eq('workspace_id', orgId)
      .in('step_id', ['3', '17'])
      .order('version', { ascending: false }),
    supabase
      .from('dcp_analysis')
      .select('stage_summaries')
      .eq('org_id', orgId)
      .maybeSingle(),
  ])

  let step3Text = 'Not yet available.'
  let step17Text = 'Not yet available.'
  if (stepsRes.data) {
    const seen = new Set<string>()
    for (const row of stepsRes.data as Array<{ step_id: string; content: Record<string, unknown> }>) {
      if (seen.has(row.step_id)) continue
      seen.add(row.step_id)
      const text = JSON.stringify(row.content, null, 2)
      if (row.step_id === '3') step3Text = text
      if (row.step_id === '17') step17Text = text
    }
  }

  let dcpStage4 = 'Not yet available.'
  let dcpStage5 = 'Not yet available.'
  let dcpStage6 = 'Not yet available.'
  if (dcpRes.data) {
    const summaries = (dcpRes.data as Record<string, unknown>)['stage_summaries'] as
      Array<{ stage_number: number; summary: string }> | null
    const findStage = (n: number) => summaries?.find(s => s.stage_number === n)?.summary ?? ''
    dcpStage4 = findStage(4) || dcpStage4
    dcpStage5 = findStage(5) || dcpStage5
    dcpStage6 = findStage(6) || dcpStage6
  }

  const systemPrompt = `CRITICAL: Respond with ONLY a valid JSON object. Start your response with { and end with }. No markdown, no backticks, no prose before or after the JSON.

You are Assembly AI Copilot, an expert B2B go-to-market strategist using the C3 Method.

Write the Competitive Evaluation playbook for this company. Using the DCP Map intelligence and decision maker data, describe how buyers evaluate GTM strategy partners in each phase of the process. Be specific and actionable — this is a deal playbook, not generic advice.

Return ONLY valid JSON in this exact shape: { "introduction": string, "evaluation": string, "presentation": string, "proposal": string, "execution": string, "length": string, "decision_criteria": string, "keys_to_winning": string }

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
${step3Text}

STEP 17 — Target Competition:
${step17Text}

DCP MAP — Stage 4 (Evaluation):
${dcpStage4}

DCP MAP — Stage 5 (Selection):
${dcpStage5}

DCP MAP — Stage 6 (Implementation / Post-Selection):
${dcpStage6}`

  const anthropic = new Anthropic({ apiKey })

  let rawText = ''
  let errorCode: string | null = null

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Generate the JSON now.' }],
    })
    for (const block of response.content) {
      if (block.type === 'text') rawText += block.text
    }
  } catch (err) {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status: unknown }).status) || 0
        : 0
    errorCode = status > 0 ? String(status) : 'unknown'
    const message = err instanceof Error ? err.message : String(err)
    console.error('[competitive-evaluation] Anthropic error:', message)

    try {
      await supabase.from('copilot_run').insert({
        workspace_id: orgId,
        step_id: '22',
        model,
        status: 'error',
        error_code: errorCode,
      })
    } catch (insertErr) {
      const msg = insertErr instanceof Error ? insertErr.message : String(insertErr)
      console.error('[competitive-evaluation] copilot_run insert failed:', msg)
    }

    return NextResponse.json(
      { error: 'Copilot request failed', code: errorCode },
      { status: status >= 400 && status < 600 ? status : 500 },
    )
  }

  const sections = parseSections(rawText)

  try {
    await supabase.from('copilot_run').insert({
      workspace_id: orgId,
      step_id: '22',
      model,
      status: sections ? 'success' : 'error',
      error_code: sections ? null : 'parse_failed',
    })
  } catch (insertErr) {
    const msg = insertErr instanceof Error ? insertErr.message : String(insertErr)
    console.error('[competitive-evaluation] copilot_run insert failed:', msg)
  }

  if (!sections) {
    console.error('[competitive-evaluation] JSON parse failed. Raw (first 800 chars):', rawText.slice(0, 800))
    return NextResponse.json(
      { error: 'Copilot returned an unparseable response' },
      { status: 502 },
    )
  }

  return NextResponse.json(sections)
}
