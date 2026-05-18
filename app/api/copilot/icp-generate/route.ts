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

export const maxDuration = 30

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

The JSON must match this exact structure:
{
  "buyer_type": "economic_buyer",
  "job_titles": ["<title1>", "<title2>", "<title3>"],
  "company_size_range": "<e.g. 50-500 employees>",
  "industry_verticals": ["<vertical1>", "<vertical2>"],
  "decision_making_power": "<description of authority and budget control>",
  "budget_range": "<e.g. $50k-$250k annual>",
  "buying_motion": "<description of how they buy>",
  "buying_urgency_trigger": "<event that causes them to start looking now>",
  "primary_challenges": ["<challenge1>", "<challenge2>", "<challenge3>"],
  "barriers_to_success": ["<barrier1>", "<barrier2>"],
  "the_big_win": "<the single transformational outcome they want>",
  "success_metrics": ["<metric1>", "<metric2>", "<metric3>"],
  "buying_triggers": ["<trigger1>", "<trigger2>", "<trigger3>"],
  "information_sources": ["<source1>", "<source2>", "<source3>"],
  "preferred_communication": "<preferred channels and cadence>",
  "purchase_criteria": ["<criterion1>", "<criterion2>", "<criterion3>"],
  "buyer_values": "<what they value culturally and professionally>",
  "common_objections": [
    {"objection": "<objection>", "overcomes": "<what overcomes it>"}
  ],
  "risk_sensitivities": "<what risks concern them most>",
  "tech_stack": "<typical tools and integration expectations>"
}

RULES:
- buyer_type must be exactly "economic_buyer" or "champion"
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
  const maxAttempts = 3

  outer: for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    fullText = ''
    try {
      const claudeStream = anthropic.messages.stream({
        model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: 'Generate the ICP now.' }],
        system: systemPrompt,
      })

      for await (const chunk of claudeStream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text
        }
      }
      break outer
    } catch (err) {
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status: unknown }).status) || 0 : 0
      claudeError = err instanceof Error ? err.message : String(err)
      console.error(`[copilot/icp-generate] Claude error attempt ${attempt}/${maxAttempts}:`, claudeError)
      if (status >= 500 && status < 600 && attempt < maxAttempts) {
        await new Promise<void>(resolve => setTimeout(resolve, 1000))
        continue outer
      }
      break outer
    }
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

  // Parse JSON — try direct, then regex extraction
  const trimmed = fullText.trim()
  let parsed: Record<string, unknown>

  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[copilot/icp-generate] parse failed — no JSON block found. Raw:', fullText)
      return NextResponse.json({ error: 'parse_failed', raw: fullText.substring(0, 500) }, { status: 422 })
    }
    try {
      parsed = JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      console.error('[copilot/icp-generate] parse failed after regex extraction. Raw:', fullText)
      return NextResponse.json({ error: 'parse_failed', raw: fullText.substring(0, 500) }, { status: 422 })
    }
  }

  return NextResponse.json(parsed)
}
