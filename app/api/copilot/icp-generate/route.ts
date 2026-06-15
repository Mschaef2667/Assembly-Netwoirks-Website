import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

// ── Types ─────────────────────────────────────────────────────────────────────

interface IcpGenerateBody {
  segmentName: string
  segmentIndex: number
  workspaceId: string
  preferredModel?: string
  companyContext: string
  dcpContext: string
  journeyContext: string
}

// ── Route config ──────────────────────────────────────────────────────────────

export const maxDuration = 60

// ── POST /api/copilot/icp-generate ───────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleIcpGenerate(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[copilot/icp-generate] unhandled error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleIcpGenerate(req: NextRequest): Promise<Response> {
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

  let body: IcpGenerateBody
  try {
    body = (await req.json()) as IcpGenerateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { segmentName, segmentIndex, workspaceId, preferredModel, companyContext, dcpContext, journeyContext } = body
  if (!segmentName || !workspaceId) {
    return NextResponse.json({ error: 'segmentName and workspaceId are required' }, { status: 400 })
  }

  const model = preferredModel ?? 'claude-sonnet-4-5'
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const systemPrompt = `You are an expert B2B ICP researcher. Based on the following company and market intelligence, generate a detailed ICP for the "${segmentName}" target market segment (Segment ${segmentIndex}).

Return ONLY a valid JSON object. No markdown, no backticks, no explanation text before or after. Start your response with { and end with }.

The JSON object must contain these fields:
- buyer_type (string, exactly "economic_buyer" or "champion")
- job_titles (array of strings)
- company_size_range (string, e.g. "50-500 employees")
- industry_verticals (array of strings)
- decision_making_power (string describing authority and budget control)
- budget_range (string, e.g. "$50k-$250k annual")
- buying_motion (string describing how they buy)
- buying_urgency_trigger (string describing the event that causes them to start looking now)
- primary_challenges (array of strings)
- barriers_to_success (array of strings)
- the_big_win (string describing the single transformational outcome they want)
- success_metrics (array of strings)
- buying_triggers (array of strings)
- information_sources (array of strings)
- preferred_communication (string describing channels and cadence)
- purchase_criteria (array of strings)
- buyer_values (string describing what they value culturally and professionally)
- common_objections (array of objects, each with "objection" and "overcomes" string fields)
- risk_sensitivities (string describing what risks concern them most)
- tech_stack (string describing typical tools and integration expectations)

RULES:
- Arrays should have 3-5 items where applicable
- Be specific to the industry, company size, and buyer roles evident in the context
- Draw directly from the DCP intelligence and journey pain point data where available
- Generate the best possible draft from available context — do not ask for more information

COMPANY CONTEXT:
${companyContext || 'Not yet available.'}

DCP INTELLIGENCE:
${dcpContext || 'Not yet available.'}

JOURNEY CONTEXT (pain points, causes, effects):
${journeyContext || 'Not yet available.'}`

  const anthropic = new Anthropic({ apiKey })
  let fullText = ''
  let claudeError: string | null = null

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: 'Generate the ICP now.' }],
      system: systemPrompt,
    })

    for (const block of response.content) {
      if (block.type === 'text') {
        fullText += block.text
      }
    }
  } catch (err) {
    claudeError = err instanceof Error ? err.message : String(err)
    console.error('[icp-generate] 422 detail:', JSON.stringify(err))
  }

  console.log(`[copilot/icp-generate] raw response (${fullText.length} chars):`, fullText)

  // Write to copilot_run — non-fatal
  try {
    await supabase.from('copilot_run').insert({
      workspace_id: workspaceId,
      step_id: `icp-segment-${segmentIndex}`,
      model,
      status: claudeError ? 'error' : 'success',
      error_code: claudeError ?? null,
    })
  } catch (insertErr) {
    console.error('[copilot/icp-generate] copilot_run insert failed:', insertErr)
  }

  if (claudeError) {
    return NextResponse.json({ error: claudeError }, { status: 500 })
  }

  console.log('Full raw ICP response:', fullText)

  // Parse JSON — strip markdown fences, then try direct parse, then regex extraction
  const stripped = fullText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  let parsed: Record<string, unknown>

  try {
    parsed = JSON.parse(stripped) as Record<string, unknown>
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[copilot/icp-generate] parse failed — no JSON block found. Raw:', fullText)
      return NextResponse.json({ error: 'parse_failed', raw: fullText }, { status: 422 })
    }
    try {
      parsed = JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      console.error('[copilot/icp-generate] parse failed after regex extraction. Raw:', fullText)
      return NextResponse.json({ error: 'parse_failed', raw: fullText }, { status: 422 })
    }
  }

  return NextResponse.json(parsed)
}
