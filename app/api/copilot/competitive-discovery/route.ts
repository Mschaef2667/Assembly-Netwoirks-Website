import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  workspaceId: string
  companyContext: string
  icpContext: string
  painPointContext: string
  cvpContext: string
  preferredModel?: string
}

interface AnthropicContent {
  type: string
  text?: string
}

function isTextContent(b: AnthropicContent): b is AnthropicContent & { type: 'text'; text: string } {
  return b.type === 'text' && typeof b.text === 'string'
}

interface AnthropicResponse {
  content: AnthropicContent[]
  stop_reason: string
}

// ── Route config ──────────────────────────────────────────────────────────────

export const maxDuration = 60

// ── POST /api/copilot/competitive-discovery ───────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleDiscovery(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[copilot/competitive-discovery] unhandled error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleDiscovery(req: NextRequest): Promise<Response> {
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

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { workspaceId, companyContext, icpContext, painPointContext, cvpContext, preferredModel } = body
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const model = preferredModel ?? 'claude-sonnet-4-5'
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const systemPrompt = `CRITICAL: Respond with ONLY a valid JSON object. Start your response with { and end with }. No markdown, no backticks, no prose.

You are a B2B competitive intelligence analyst. Use web search to research the competitive landscape for the company described below. Identify real companies that compete for the same buyers and budget.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation. Start with { and end with }.

JSON structure:
{
  "known_validators": [
    { "name": "<company name>", "description": "<1-2 sentence description of what they do and who they serve>", "why_relevant": "<why this buyer would compare us against them>", "alignment_score": <integer 1-10> }
  ],
  "adjacent_competitors": [
    { "name": "<company name>", "description": "<1-2 sentence description>", "why_relevant": "<why they could capture the same budget even from a different category>", "alignment_score": <integer 1-10> }
  ],
  "emerging_threats": [
    { "name": "<company name>", "description": "<1-2 sentence description>", "why_relevant": "<why they are an emerging threat — funded, growing, or displacing incumbents>", "alignment_score": <integer 1-10> }
  ]
}

Category definitions:
- known_validators: Established vendors buyers already know and benchmark against — the default shortlist
- adjacent_competitors: Vendors from adjacent categories that could solve the same problem differently and compete for the same budget
- emerging_threats: Startups or category challengers who entered this space in the last 1-3 years with momentum

For each competitor include an alignment_score from 1-10 representing how directly they compete for the same deals (10 = direct head-to-head competitor, 1 = rarely compete). Return alignment_score as an integer in the JSON.

RULES:
- Return a maximum of 6 competitors total across all categories combined
- Keep each competitor description under 20 words
- Use real company names found via web search
- Be specific to the ICP industries, company sizes, and pain points provided
- Prioritise relevance to the buyer profile over general market coverage
- Every competitor entry MUST include an integer alignment_score between 1 and 10

COMPANY CONTEXT:
${companyContext || 'Not provided.'}

ICP FIRMOGRAPHICS:
${icpContext || 'Not provided.'}

PAIN POINT CONTEXT:
${painPointContext || 'Not provided.'}

CVP CONTEXT:
${cvpContext || 'Not provided.'}`

  let fullText = ''
  let claudeError: string | null = null
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    fullText = ''
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Research and identify the competitive landscape for this company now.' }],
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        }),
      })

      if (!response.ok) {
        const status = response.status
        claudeError = `HTTP ${status}`
        if (status >= 500 && status < 600 && attempt < maxAttempts) {
          await new Promise<void>(resolve => setTimeout(resolve, 1000))
          continue
        }
        break
      }

      const data = (await response.json()) as AnthropicResponse
      fullText = data.content.filter(isTextContent).map(b => b.text).join('')
      claudeError = null
      break
    } catch (err) {
      claudeError = err instanceof Error ? err.message : String(err)
      console.error(`[copilot/competitive-discovery] error attempt ${attempt}/${maxAttempts}:`, claudeError)
      if (attempt < maxAttempts) {
        await new Promise<void>(resolve => setTimeout(resolve, 1000))
        continue
      }
    }
  }

  // Write to copilot_run — non-fatal
  try {
    await supabase.from('copilot_run').insert({
      workspace_id: workspaceId,
      step_id: 'competitive-discovery-17',
      model,
      status: claudeError ? 'error' : 'success',
      error_code: claudeError ?? null,
    })
  } catch (insertErr) {
    console.error('[copilot/competitive-discovery] copilot_run insert failed:', insertErr)
  }

  if (claudeError) {
    return NextResponse.json({ error: claudeError }, { status: 500 })
  }

  console.log('Full raw competitive discovery response:', fullText)

  // Parse JSON — strip markdown fences, then try direct parse, then regex extraction
  const stripped = fullText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

  let parsed: Record<string, unknown>

  try {
    parsed = JSON.parse(stripped) as Record<string, unknown>
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[copilot/competitive-discovery] parse failed — no JSON block found. Raw:', fullText)
      return NextResponse.json({ error: 'parse_failed', raw: fullText }, { status: 422 })
    }
    try {
      parsed = JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      console.error('[copilot/competitive-discovery] parse failed after regex extraction. Raw:', fullText)
      return NextResponse.json({ error: 'parse_failed', raw: fullText }, { status: 422 })
    }
  }

  return NextResponse.json(parsed)
}
