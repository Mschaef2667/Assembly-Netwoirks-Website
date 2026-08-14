import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { buildGtmAssessmentSystemPrompt, type GtmAssessmentIntake } from '@/lib/prompts/gtmAssessment'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/admin/gtm-assessment/[id]/generate
 *
 * Super-admin only. Loads a stored GTM assessment intake, generates the report
 * draft with Claude, saves it to report_draft, and sets status to 'drafted'.
 * Returns the parsed report so the review page can render it immediately.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params

    // ── Auth: super admin only ─────────────────────────────────────────────
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

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: meRow } = await service
      .from('users')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!meRow || !(meRow as { is_super_admin?: boolean }).is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Load the intake ────────────────────────────────────────────────────
    const { data: row, error: loadErr } = await service
      .from('gtm_assessments')
      .select('id, name, company, company_website, industry, competitors, competitor_urls, challenge, gtm_summary')
      .eq('id', id)
      .maybeSingle()

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    const intake = row as GtmAssessmentIntake & { id: string }

    // ── Generate with Claude ───────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const model = 'claude-sonnet-4-5'
    const anthropic = new Anthropic({ apiKey })

    // Research step: read the company site and competitor sites via web search so
    // the report can be specific. Best-effort; a failure just falls back to the
    // self-reported intake.
    let researchDigest = ''
    if (intake.company_website || intake.competitor_urls || intake.competitors) {
      const researchPrompt = `Research this company and its competitors on the web so a strategist can assess their go-to-market positioning and messaging. Be concise and factual, and report only what you actually find on the pages.

Company: ${intake.company ?? 'unknown'}
Company website: ${intake.company_website ?? 'not provided'}
Competitors (names): ${intake.competitors ?? 'not provided'}
Competitor links: ${intake.competitor_urls ?? 'not provided'}

For the company and each competitor you can find, summarize in a few lines: what they say they do, who they target, their headline value proposition, and the main messaging themes on their site. Then note the 2 to 4 clearest differences in how the company and its competitors position themselves. If you cannot find a site, say so briefly. Keep the whole summary under ~400 words.`
      try {
        const researchResp = await anthropic.messages.create({
          model,
          max_tokens: 1500,
          tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 6 }],
          messages: [{ role: 'user', content: researchPrompt }],
        })
        for (const b of researchResp.content) {
          if (b.type === 'text') researchDigest += b.text
        }
      } catch (e) {
        console.error('[gtm-assessment/generate] research step failed (continuing):', e instanceof Error ? e.message : String(e))
      }
    }

    let fullText = ''
    let stopReason: string | null = null
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 8000,
        system: buildGtmAssessmentSystemPrompt(intake, researchDigest),
        // Prefill the assistant turn with "{" so the model must return JSON with
        // no preamble or code fences. We prepend the "{" back before parsing.
        messages: [
          { role: 'user', content: 'Generate the GTM Gap Report now.' },
          { role: 'assistant', content: '{' },
        ],
      })
      stopReason = response.stop_reason
      for (const block of response.content) {
        if (block.type === 'text') fullText += block.text
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[gtm-assessment/generate] claude error:', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    // ── Parse JSON. The assistant turn was prefilled with "{", so restore it. ─
    const candidate = ('{' + fullText).replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(candidate) as Record<string, unknown>
    } catch {
      const match = candidate.match(/\{[\s\S]*\}/)
      if (match) {
        try { parsed = JSON.parse(match[0]) as Record<string, unknown> } catch { parsed = null }
      }
    }

    if (!parsed) {
      console.error(`[gtm-assessment/generate] parse failed (stop_reason=${stopReason}). Raw:`, fullText)
      return NextResponse.json(
        { error: `parse_failed (stop_reason: ${stopReason ?? 'unknown'})`, raw: fullText },
        { status: 422 },
      )
    }

    // ── Save draft ─────────────────────────────────────────────────────────
    const { error: saveErr } = await service
      .from('gtm_assessments')
      .update({
        report_draft: parsed,
        status: 'drafted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (saveErr) {
      console.error('[gtm-assessment/generate] save failed:', saveErr.message)
      return NextResponse.json({ error: saveErr.message }, { status: 500 })
    }

    return NextResponse.json({ id, report: parsed })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[gtm-assessment/generate] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
