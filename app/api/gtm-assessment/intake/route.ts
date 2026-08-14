import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GTM Gap Report — intake receiver.
 *
 * Called server-to-server by the marketing site's /api/submit when a "GTM
 * Assessment" form is submitted. It is NOT a user-facing route, so it is
 * guarded by a shared secret (header `x-gtm-intake-secret`) rather than a
 * super-admin cookie session. It stores the structured intake in the
 * gtm_assessments table using the service-role key and returns the new id so
 * the caller can build a review link.
 *
 * Required env: GTM_INTAKE_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

interface IntakeBody {
  name?: string
  email?: string
  company?: string
  job_title?: string
  industry?: string
  annual_revenue?: string
  how_heard?: string
  competitors?: string
  challenge?: string
  gtm_summary?: string
  source_site?: string
  page_url?: string
  notion_page_id?: string
}

const str = (v: unknown, max = 4000): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t.length ? t : null
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Shared token lives in code so no dashboard config is needed (repo is
    // private). An env var, if set, takes precedence so it can be rotated later.
    const secret = process.env.GTM_INTAKE_SECRET || '3Iz8LHXEK5DnpdpZVKesKue-Y9qXdJgR'
    if (req.headers.get('x-gtm-intake-secret') !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: IntakeBody
    try {
      body = (await req.json()) as IntakeBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const name = str(body.name, 200)
    const email = str(body.email, 200)
    if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid name and email required' }, { status: 400 })
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data, error } = await service
      .from('gtm_assessments')
      .insert({
        status: 'new',
        name,
        email: email.toLowerCase(),
        company: str(body.company, 200),
        job_title: str(body.job_title, 200),
        industry: str(body.industry, 120),
        annual_revenue: str(body.annual_revenue, 60),
        how_heard: str(body.how_heard, 120),
        competitors: str(body.competitors, 600),
        challenge: str(body.challenge, 300),
        gtm_summary: str(body.gtm_summary, 3000),
        source_site: str(body.source_site, 120),
        page_url: str(body.page_url, 500),
        notion_page_id: str(body.notion_page_id, 100),
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[gtm-assessment/intake] insert failed:', error?.message)
      return NextResponse.json({ error: 'Storage failed' }, { status: 500 })
    }

    return NextResponse.json({ id: (data as { id: string }).id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[gtm-assessment/intake] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
