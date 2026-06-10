import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { resolveContextPacket, type ContextFetcher } from '@/lib/context/resolveContextPacket'

import { buildPrompt as buildEndemicPrompt } from '@/lib/prompts/endemic'
import { buildPrompt as buildCompanyPrompt } from '@/lib/prompts/company'
import { buildPrompt as buildCompetitivePrompt } from '@/lib/prompts/competitive'
import { buildPrompt as buildMessagesPrompt } from '@/lib/prompts/messages'
import { buildPrompt as buildActionPrompt } from '@/lib/prompts/action'
import { buildPrompt as buildIntelligencePrompt } from '@/lib/prompts/intelligence'
import { buildPrompt as buildFoundationPrompt } from '@/lib/prompts/foundation'
import { buildGenericPrompt, buildImprovePrompt } from '@/lib/prompts/generic'
import type { PromptContext } from '@/lib/prompts/types'

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

export const maxDuration = 60

// Strip markdown bold markers and bullet markers from a draft.
// Preserves numbered lists (1. 2. 3.) — only rewrites asterisk bullets.
function stripMarkdownFormatting(text: string): string {
  let result = text
  result = result.replace(/\*\*/g, '')
  result = result.replace(/__/g, '')
  result = result.replace(/^(\s*)[*+]\s+/gm, '$1- ')
  return result
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

function dispatchPrompt(stepId: string, ctx: PromptContext): string {
  if (ctx.isImprove) return buildImprovePrompt(ctx)
  if (stepId === '1' || stepId === '2' || stepId === '3') return buildFoundationPrompt(stepId, ctx)
  if (['4', '5', '6', '7', '8', '9', '10'].includes(stepId)) return buildEndemicPrompt(stepId, ctx)
  if (['11', '12', '13', '14', '15', '16'].includes(stepId)) return buildCompanyPrompt(stepId, ctx)
  if (stepId === '17' || stepId === '17-autofill' || stepId === '18' || stepId === '19' || stepId === '20' || stepId === '21' || stepId === '22' || stepId === '23' || stepId === '24' || stepId === '25' || stepId === '26') return buildCompetitivePrompt(stepId, ctx)
  if (['27', '28', '29', '30'].includes(stepId)) return buildMessagesPrompt(stepId, ctx)
  if (['31', '32', '33', '34', '35', '36', '37', '38'].includes(stepId)) return buildActionPrompt(stepId, ctx)
  if (stepId === 'survey-builder' || stepId === 'survey-builder-autowording' || stepId === 'survey-builder-interview-probes') {
    return buildIntelligencePrompt(stepId, ctx)
  }
  return buildGenericPrompt(ctx)
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

  // ── Steps 4-9, 22: fetch DCP stage summaries (lives in dcp_analysis) ──
  let dcpStage1Summary = ''
  let dcpStage2Summary = ''
  let dcpStage3Summary = ''
  let dcpStage4Summary = ''
  let dcpStage5Summary = ''
  let dcpStage6Summary = ''
  const ENDEMIC_STEPS = new Set(['4', '5', '6', '7', '8', '9'])
  if (ENDEMIC_STEPS.has(stepId) || stepId === '22' || stepId === '23') {
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
        dcpStage5Summary = findStage(5)
        dcpStage6Summary = findStage(6)
      }
    } catch { /* non-fatal — proceed with lower confidence */ }
  }

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

  // ── Pre-fetch non-dependency step content needed by Steps 13, 14, 15, 16, 22, 28-30 ──
  let step3Text = 'Not yet available.'
  let step12Text = 'Not yet available.'
  let step13Text = 'Not yet available.'
  let step14Text = 'Not yet available.'
  let step17Text = 'Not yet available.'
  let step18Text = 'Not yet available.'
  let step19Text = 'Not yet available.'

  const needsStep12 = ['13', '14'].includes(stepId)
  const needsStep13 = ['14', '15'].includes(stepId)
  const needsStep14 = ['15', '16', '28', '29', '30'].includes(stepId)
  const needsStep16Extras = stepId === '16' // pulls 13 and 14
  const needsStep22Extras = stepId === '22' // pulls 3 and 17
  const needsStep23Extras = stepId === '23' // pulls 3
  const needsCompetitiveExtras = ['28', '29', '30'].includes(stepId) // pulls 14, 18, 19

  if (needsStep12 || needsStep13 || needsStep14 || needsStep16Extras || needsStep22Extras || needsStep23Extras || needsCompetitiveExtras) {
    const idsToFetch = new Set<string>()
    if (needsStep12 || stepId === '13' || stepId === '14') idsToFetch.add('12')
    if (needsStep13 || stepId === '14' || stepId === '15' || stepId === '16') idsToFetch.add('13')
    if (needsStep14) idsToFetch.add('14')
    if (needsStep22Extras) { idsToFetch.add('3'); idsToFetch.add('17') }
    if (needsStep23Extras) { idsToFetch.add('3') }
    if (needsCompetitiveExtras && stepId === '29') idsToFetch.add('18')
    if (needsCompetitiveExtras && stepId === '30') idsToFetch.add('19')
    if (needsCompetitiveExtras) { idsToFetch.add('14'); idsToFetch.add('18'); idsToFetch.add('19') }

    try {
      const { data: extraRows } = await supabase
        .from('step_output')
        .select('step_id, content, version')
        .eq('workspace_id', workspaceId)
        .in('step_id', Array.from(idsToFetch))
        .order('version', { ascending: false })
      if (extraRows) {
        const seen = new Set<string>()
        for (const row of extraRows as Array<{ step_id: string; content: Record<string, unknown> }>) {
          if (!seen.has(row.step_id)) {
            seen.add(row.step_id)
            const text = JSON.stringify(row.content, null, 2)
            if (row.step_id === '3') step3Text = text
            if (row.step_id === '12') step12Text = text
            if (row.step_id === '13') step13Text = text
            if (row.step_id === '14') step14Text = text
            if (row.step_id === '17') step17Text = text
            if (row.step_id === '18') step18Text = text
            if (row.step_id === '19') step19Text = text
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  // ── Step 1: two-step web search (search first, then generate clean JSON) ────
  const anthropic = new Anthropic({ apiKey })
  const maxTokens = stepId === 'survey-builder' ? 4000
    : stepId === 'survey-builder-autowording' ? 2000
    : stepId === 'survey-builder-interview-probes' ? 3000
    : stepId === '16' ? 4000
    : 1500

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

  // ── Build prompt context and dispatch to the right builder ───────────────────

  const promptContext: PromptContext = {
    stepId,
    stepTitle,
    stepDescription,
    currentContent,
    extraContext,
    isImprove,
    contextPacket,
    dcpStage1Summary,
    dcpStage2Summary,
    dcpStage3Summary,
    dcpStage4Summary,
    dcpStage5Summary,
    dcpStage6Summary,
    surveyBuilderStep1,
    surveyBuilderStep2,
    surveyBuilderStep3,
    surveyBuilderIcpBlock,
    webSearchResults,
    step3Text,
    step12Text,
    step13Text,
    step14Text,
    step17Text,
    step18Text,
    step19Text,
  }

  let systemPrompt = dispatchPrompt(stepId, promptContext)
  if (!systemPrompt) systemPrompt = buildGenericPrompt(promptContext)

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
            }
          }
          if (fullText.length > 0) {
            controller.enqueue(encoder.encode(stripMarkdownFormatting(fullText)))
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

      // Step 16: attempt server-side JSON parse and log raw response if parsing fails
      if (stepId === '16' && !streamError && fullText.length > 0) {
        let stripped = fullText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim()
        const firstBrace = stripped.indexOf('{')
        const lastBrace = stripped.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          stripped = stripped.slice(firstBrace, lastBrace + 1)
        }
        try {
          JSON.parse(stripped)
        } catch {
          console.error('[copilot/draft] Step 16 JSON parse failed. Raw response (first 800 chars):', fullText.slice(0, 800))
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
