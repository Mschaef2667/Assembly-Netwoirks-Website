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
}

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

  const { stepId, workspaceId, stepTitle, stepDescription, currentContent, preferredModel } = body
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

  // Build system prompt
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

  const systemPrompt = `You are Assembly AI Copilot, an expert B2B go-to-market strategist.

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

Be specific, actionable, and grounded in the prerequisite data. Do not hallucinate facts not present in the context.`

  // Stream the response to the client
  const anthropic = new Anthropic({ apiKey })

  let fullText = ''
  let streamError: string | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        const claudeStream = anthropic.messages.stream({
          model,
          max_tokens: 1500,
          messages: [{ role: 'user', content: 'Generate the draft now.' }],
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
      } catch (err) {
        streamError = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode('\n__STREAM_ERROR__'))
      } finally {
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
      }
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
