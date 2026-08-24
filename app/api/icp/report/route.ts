import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { CUSTOMER_CATEGORIES } from '@/lib/icp/customer-categories'

// This route builds a downloadable ICP Calibration Report (PDF) summarising the
// three steps of the ICP Calibrator — day-one baseline beliefs, the buyer
// evidence, and the calibrated ICPs — as a document sales and marketing can use
// for direction and discussion. Authenticated via the SSR cookie session, so it
// only ever reads the signed-in user's own organisation (RLS enforces the rest).

export const runtime = 'nodejs'
export const maxDuration = 60

// ── House colours ─────────────────────────────────────────────────────────────

const NAVY   = '#0A1628'
const PANEL  = '#0F2140'
const ORANGE = '#E8520A'
const SKY    = '#0EA5E9'
const GREEN  = '#16A34A'
const INK    = '#0D0D0D'
const GREY   = '#6B7280'
const LIGHT  = '#F1F5F9'
const MIDGREY = '#94A3B8'

// ── Minimal jsPDF surface (mirrors the whitepaper route) ──────────────────────

type JsPdf = {
  internal: { pageSize: { getWidth(): number; getHeight(): number }; getNumberOfPages(): number }
  setFillColor(r: number, g: number, b: number): void
  setDrawColor(r: number, g: number, b: number): void
  setTextColor(r: number, g: number, b: number): void
  setFont(family: string, style?: string): void
  setFontSize(size: number): void
  setLineWidth(width: number): void
  text(text: string, x: number, y: number, opts?: { align?: 'left' | 'center' | 'right'; charSpace?: number }): void
  rect(x: number, y: number, w: number, h: number, style?: string): void
  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string): void
  line(x1: number, y1: number, x2: number, y2: number): void
  addPage(): void
  setPage(n: number): void
  getNumberOfPages(): number
  splitTextToSize(text: string, maxWidth: number): string[]
  getTextWidth(text: string): number
  output(type: 'arraybuffer'): ArrayBuffer
}

// ── Data types ────────────────────────────────────────────────────────────────

interface Objection { objection: string; overcomes: string }

interface IcpRecord {
  id: string
  segment_index: number
  segment_name: string
  buyer_type: 'economic_buyer' | 'champion'
  is_primary: boolean
  job_titles: string[]
  company_size_range: string
  industry_verticals: string[]
  decision_making_power: string
  budget_range: string
  buying_motion: string
  buying_urgency_trigger: string
  primary_challenges: string[]
  barriers_to_success: string[]
  the_big_win: string
  success_metrics: string[]
  buying_triggers: string[]
  information_sources: string[]
  preferred_communication: string
  purchase_criteria: string[]
  buyer_values: string
  common_objections: Objection[]
  risk_sensitivities: string
  tech_stack: string
}

interface BaselineRecord {
  category: string
  profile_type: 'current' | 'ideal'
  customer_name: string
  contact_name: string
  contact_title: string
  segment_name: string
  industry: string
  company_size: string
  why_fits: string
  additional_context: string
}

interface TaggedResponse {
  respondent_name: string
  respondent_title: string
  respondent_company: string
  customer_category: string
}

// ── Coercion helpers ──────────────────────────────────────────────────────────

function s(v: unknown): string { return typeof v === 'string' ? v : v == null ? '' : String(v) }
function arr(v: unknown): string[] { return Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x : String(x))).filter(Boolean) : [] }
function objs(v: unknown): Objection[] {
  return Array.isArray(v)
    ? (v as Array<Record<string, unknown>>).map(o => ({ objection: s(o['objection']), overcomes: s(o['overcomes']) })).filter(o => o.objection || o.overcomes)
    : []
}
function buyerLabel(bt: string): string { return bt === 'champion' ? 'Champion' : 'Economic Buyer' }

function mapIcp(raw: Record<string, unknown>): IcpRecord {
  return {
    id: s(raw['id']),
    segment_index: Number(raw['segment_index'] ?? 0) || 0,
    segment_name: s(raw['segment_name']) || `Segment ${Number(raw['segment_index'] ?? 0) || ''}`.trim(),
    buyer_type: raw['buyer_type'] === 'champion' ? 'champion' : 'economic_buyer',
    is_primary: raw['is_primary'] === true,
    job_titles: arr(raw['job_titles']),
    company_size_range: s(raw['company_size_range']),
    industry_verticals: arr(raw['industry_verticals']),
    decision_making_power: s(raw['decision_making_power']),
    budget_range: s(raw['budget_range']),
    buying_motion: s(raw['buying_motion']),
    buying_urgency_trigger: s(raw['buying_urgency_trigger']),
    primary_challenges: arr(raw['primary_challenges']),
    barriers_to_success: arr(raw['barriers_to_success']),
    the_big_win: s(raw['the_big_win']),
    success_metrics: arr(raw['success_metrics']),
    buying_triggers: arr(raw['buying_triggers']),
    information_sources: arr(raw['information_sources']),
    preferred_communication: s(raw['preferred_communication']),
    purchase_criteria: arr(raw['purchase_criteria']),
    buyer_values: s(raw['buyer_values']),
    common_objections: objs(raw['common_objections']),
    risk_sensitivities: s(raw['risk_sensitivities']),
    tech_stack: s(raw['tech_stack']),
  }
}

// ── Messaging & action-plan synthesis ─────────────────────────────────────────
//
// The C3 journey stores Key Selling Points (Step 15), Strategic Messages
// (Steps 27-30), and the Engagement Plan (Steps 31-38) at the company / pain-point
// level, not per target market. So rather than duplicate that material, we ask
// Claude to distill a short, per-ICP block (3 messaging angles + 3 actions)
// grounded in it. Best-effort: any failure just omits the block.

interface MessagingBlock { messages: string[]; actions: string[] }

const PLAYBOOK_STEP_IDS = ['15', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38']

function stepText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const c = content as Record<string, unknown>
  if (typeof c['text'] === 'string' && c['text'].trim()) return c['text'].trim()
  try {
    const j = JSON.stringify(c)
    return j && j !== '{}' && j !== 'null' ? j : ''
  } catch {
    return ''
  }
}

// Build a labelled playbook context from the latest version of each source step.
function buildPlaybookContext(rows: Array<Record<string, unknown>>): string {
  const latest = new Map<string, string>()
  for (const row of rows) {
    const sid = s(row['step_id'])
    if (!sid || latest.has(sid)) continue // rows are version-desc, first seen is newest
    const t = stepText(row['content'])
    if (t) latest.set(sid, t)
  }
  const section = (label: string, ids: string[]): string => {
    const parts = ids.map(id => latest.get(id)).filter((v): v is string => Boolean(v))
    return parts.length ? `## ${label}\n${parts.join('\n')}` : ''
  }
  return [
    section('Key Selling Points', ['15']),
    section('Strategic Messages', ['27', '28', '29', '30']),
    section('Engagement Plan', ['31', '32', '33', '34', '35', '36', '37', '38']),
  ].filter(Boolean).join('\n\n').slice(0, 12000)
}

function icpKey(i: { segment_index: number; buyer_type: string }): string {
  return `${i.segment_index}-${i.buyer_type}`
}

async function synthesizeMessaging(
  icps: IcpRecord[], playbookContext: string, orgName: string, model: string, apiKey: string,
): Promise<Record<string, MessagingBlock>> {
  const anthropic = new Anthropic({ apiKey })
  const brief = icps.map(i => ({
    id: icpKey(i),
    label: `${i.segment_name} (${buyerLabel(i.buyer_type)})`,
    the_big_win: i.the_big_win,
    primary_challenges: i.primary_challenges,
    job_titles: i.job_titles,
  }))

  const system = `You are a B2B sales and marketing strategist. Using the company's EXISTING Key Selling Points, Strategic Messages, and Engagement Plan, produce a SHORT, tailored block for each ICP:
- exactly 3 "messages": how to talk to THIS specific buyer (angles, hooks, proof points), each one sentence, directive and specific.
- exactly 3 "actions": concrete next steps sales/marketing should take to pursue this ICP, each one sentence, directive.
Ground every item in the provided material; do not invent programs, offers, or claims that are not implied by it. Do not restate the material verbatim — adapt it to the buyer.

Return ONLY valid JSON. Start with { and end with }. Shape exactly:
{"icps":[{"id":"<id>","messages":["...","...","..."],"actions":["...","...","..."]}]}
Use the exact id values given. If material is thin for an ICP, still return the best 3 and 3 grounded in what exists.

COMPANY: ${orgName}

EXISTING MATERIAL:
${playbookContext}

ICPS:
${JSON.stringify(brief)}`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1800,
    system,
    messages: [{ role: 'user', content: 'Generate the JSON now.' }],
  })
  let text = ''
  for (const block of response.content) {
    if (block.type === 'text') text += block.text
  }
  const stripped = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    const m = stripped.match(/\{[\s\S]*\}/)
    if (!m) return {}
    try { parsed = JSON.parse(m[0]) } catch { return {} }
  }
  const out: Record<string, MessagingBlock> = {}
  const list = (parsed as Record<string, unknown>)?.['icps']
  if (Array.isArray(list)) {
    for (const it of list as Array<Record<string, unknown>>) {
      const id = s(it['id'])
      if (!id) continue
      out[id] = { messages: arr(it['messages']).slice(0, 3), actions: arr(it['actions']).slice(0, 3) }
    }
  }
  return out
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  try {
    return await handle(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[icp/report] unhandled error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handle(req: NextRequest): Promise<Response> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => { for (const { name, value, options } of toSet) cookieStore.set(name, value, options) },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase.from('users').select('org_id').eq('id', user.id).single()
  const orgId = userRow ? s((userRow as Record<string, unknown>)['org_id']) : ''
  if (!orgId) return NextResponse.json({ error: 'No organisation found for user' }, { status: 400 })

  // Load everything the report needs. RLS scopes each read to the user's org.
  const [orgRes, icpRes, baseRes, respRes, dcpRes, playbookRes] = await Promise.all([
    supabase.from('organizations').select('name, industry, preferred_model').eq('id', orgId).maybeSingle(),
    supabase.from('icp_definition').select('*').eq('org_id', orgId).order('segment_index'),
    supabase.from('icp_baseline_profile').select('*').eq('org_id', orgId).order('created_at'),
    supabase.from('survey_link_responses').select('respondent_name, respondent_title, respondent_company, customer_category, audience').eq('org_id', orgId),
    supabase.from('dcp_analysis').select('status').eq('org_id', orgId).maybeSingle(),
    supabase.from('step_output').select('step_id, version, content').eq('workspace_id', orgId).in('step_id', PLAYBOOK_STEP_IDS).order('version', { ascending: false }),
  ])

  const orgName = orgRes.data ? s((orgRes.data as Record<string, unknown>)['name']) || 'Your Company' : 'Your Company'
  const orgIndustry = orgRes.data ? s((orgRes.data as Record<string, unknown>)['industry']) : ''
  const preferredModel = orgRes.data ? s((orgRes.data as Record<string, unknown>)['preferred_model']) || 'claude-sonnet-4-5' : 'claude-sonnet-4-5'
  const icps = ((icpRes.data ?? []) as Array<Record<string, unknown>>).map(mapIcp)
  const baselines = ((baseRes.data ?? []) as Array<Record<string, unknown>>).map(b => ({
    category: s(b['category']),
    profile_type: b['profile_type'] === 'ideal' ? 'ideal' : 'current',
    customer_name: s(b['customer_name']),
    contact_name: s(b['contact_name']),
    contact_title: s(b['contact_title']),
    segment_name: s(b['segment_name']),
    industry: s(b['industry']),
    company_size: s(b['company_size']),
    why_fits: s(b['why_fits']),
    additional_context: s(b['additional_context']),
  })) as BaselineRecord[]
  const allResponses = (respRes.data ?? []) as Array<Record<string, unknown>>
  const tagged: TaggedResponse[] = allResponses
    .filter(r => s(r['audience']) === 'current' && s(r['customer_category']))
    .map(r => ({
      respondent_name: s(r['respondent_name']),
      respondent_title: s(r['respondent_title']),
      respondent_company: s(r['respondent_company']),
      customer_category: s(r['customer_category']),
    }))
  const totalResponses = allResponses.length
  const gate1Approved = dcpRes.data ? s((dcpRes.data as Record<string, unknown>)['status']) === 'approved' : false

  const primary = icps.find(i => i.is_primary) ?? null

  // Per-ICP messaging + action-plan synthesis (best-effort; omitted on any failure
  // or when there is no source material / API key).
  let messaging: Record<string, MessagingBlock> = {}
  const playbookContext = buildPlaybookContext((playbookRes.data ?? []) as Array<Record<string, unknown>>)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey && icps.length > 0 && playbookContext.trim().length > 0) {
    try {
      messaging = await synthesizeMessaging(icps, playbookContext, orgName, preferredModel, apiKey)
    } catch (err) {
      console.error('[icp/report] messaging synthesis failed:', err instanceof Error ? err.message : String(err))
      messaging = {}
    }
  }

  const data: ReportData = {
    orgName, orgIndustry, icps, baselines, tagged, totalResponses, gate1Approved, primary, messaging,
  }

  const { searchParams } = new URL(req.url)
  const formatParam = searchParams.get('format')
  const format = formatParam === 'docx' ? 'docx' : formatParam === 'json' ? 'json' : 'pdf'
  const disposition = searchParams.get('inline') === '1' ? 'inline' : 'attachment'
  const safeName = orgName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'Company'
  const date = new Date().toISOString().slice(0, 10)

  // JSON powers the on-screen HTML report view.
  if (format === 'json') {
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (format === 'docx') {
    const docxBuf = await buildDocx(data)
    return new NextResponse(Buffer.from(docxBuf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `${disposition}; filename="ICP-Calibration-Report-${safeName}-${date}.docx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const pdf = await buildPdf(data)
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="ICP-Calibration-Report-${safeName}-${date}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}

// ── PDF builder ───────────────────────────────────────────────────────────────

interface ReportData {
  orgName: string
  orgIndustry: string
  icps: IcpRecord[]
  baselines: BaselineRecord[]
  tagged: TaggedResponse[]
  totalResponses: number
  gate1Approved: boolean
  primary: IcpRecord | null
  messaging: Record<string, MessagingBlock>
}

async function buildPdf(data: ReportData): Promise<Uint8Array> {
  const mod = await import('jspdf')
  const JsPDFCtor = (mod as unknown as { jsPDF: new (o: Record<string, unknown>) => unknown }).jsPDF
  const doc = new JsPDFCtor({ unit: 'pt', format: 'a4', orientation: 'portrait' }) as JsPdf

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 56
  const contentW = pageW - margin * 2
  const bottom = pageH - margin - 24

  const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  const fill = (hex: string) => { const [r, g, b] = rgb(hex); doc.setFillColor(r, g, b) }
  const stroke = (hex: string) => { const [r, g, b] = rgb(hex); doc.setDrawColor(r, g, b) }
  const ink = (hex: string) => { const [r, g, b] = rgb(hex); doc.setTextColor(r, g, b) }

  function ensure(y: number, needed = 48): number {
    if (y + needed > bottom) { doc.addPage(); return margin + 8 }
    return y
  }

  function wrap(text: string, x: number, y: number, maxW: number, lh: number, indent = 0): number {
    if (!text) return y
    const lines = doc.splitTextToSize(text, maxW - indent)
    for (const line of lines) {
      if (y > bottom) { doc.addPage(); y = margin + 8 }
      doc.text(line, x + indent, y)
      y += lh
    }
    return y
  }

  // Section header band at the top of a fresh page.
  function sectionPage(eyebrow: string, title: string): number {
    doc.addPage()
    fill(NAVY); doc.rect(0, 0, pageW, 62, 'F')
    fill(ORANGE); doc.rect(0, 0, pageW, 4, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(ORANGE)
    doc.text(eyebrow.toUpperCase(), margin, 26, { charSpace: 1.5 })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); ink('#FFFFFF')
    doc.text(title, margin, 47)
    return 92
  }

  function label(text: string, x: number, y: number): number {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); ink(GREY)
    doc.text(text.toUpperCase(), x, y, { charSpace: 0.8 })
    return y + 13
  }

  // A label + wrapped value; skips entirely when the value is empty.
  function field(lbl: string, value: string, y: number, x = margin, w = contentW): number {
    if (!value.trim()) return y
    y = ensure(y, 40)
    y = label(lbl, x, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(INK)
    y = wrap(value, x, y, w, 15)
    return y + 8
  }

  function listField(lbl: string, items: string[], y: number, x = margin, w = contentW): number {
    if (items.length === 0) return y
    y = ensure(y, 44)
    y = label(lbl, x, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(INK)
    for (const it of items) {
      y = ensure(y, 16)
      fill(ORANGE); doc.rect(x + 1, y - 3.5, 3, 3, 'F')
      y = wrap(it, x, y, w, 15, 12)
      y += 2
    }
    return y + 8
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  fill(NAVY); doc.rect(0, 0, pageW, pageH, 'F')
  fill(ORANGE); doc.rect(0, 0, pageW, 7, 'F')

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); ink(ORANGE)
  doc.text('ASSEMBLY AI · IDEAL CUSTOMER PROFILE', pageW / 2, 150, { align: 'center', charSpace: 2 })

  doc.setFont('helvetica', 'bold'); doc.setFontSize(34); ink('#FFFFFF')
  doc.text('ICP Calibration Report', pageW / 2, 250, { align: 'center' })

  stroke(ORANGE); doc.setLineWidth(2)
  doc.line(pageW / 2 - 60, 278, pageW / 2 + 60, 278)

  doc.setFont('helvetica', 'normal'); doc.setFontSize(15); ink(LIGHT)
  doc.text(data.orgName, pageW / 2, 320, { align: 'center' })
  if (data.orgIndustry) {
    doc.setFontSize(11); ink(MIDGREY)
    doc.text(data.orgIndustry, pageW / 2, 342, { align: 'center' })
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); ink(MIDGREY)
  doc.text('A shared reference for Sales and Marketing:', pageW / 2, pageH - 210, { align: 'center' })
  doc.text('who we sell to, why they buy, and where to start.', pageW / 2, pageH - 192, { align: 'center' })

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); ink('#FFFFFF')
  doc.text(dateStr, pageW / 2, pageH - 150, { align: 'center' })

  // ── Overview page ──────────────────────────────────────────────────────────
  let y = sectionPage('Overview', 'What this report is')

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); ink(INK)
  y = wrap(
    'This report calibrates who ' + data.orgName + ' believes its best customers are against what buyers actually said, then '
    + 'names the profiles Sales and Marketing should organise around. Use it to align on targeting, sharpen messaging, and '
    + 'decide where to focus outreach. It is a working document: mark it up, argue with it, and bring your input back in.',
    margin, y, contentW, 16,
  )
  y += 12

  // Snapshot cards (2x2 grid)
  const primaryLabel = data.primary ? `${data.primary.segment_name} · ${buyerLabel(data.primary.buyer_type)}` : 'Not selected yet'
  const cards: Array<{ big: string; small: string }> = [
    { big: String(data.icps.length), small: data.icps.length === 1 ? 'Calibrated ICP' : 'Calibrated ICPs' },
    { big: String(data.baselines.length), small: data.baselines.length === 1 ? 'Baseline profile' : 'Baseline profiles' },
    { big: `${data.tagged.length} / ${data.totalResponses}`, small: 'Tagged buyer responses' },
    { big: data.gate1Approved ? 'Approved' : 'Pending', small: 'Gate 1 (Decision Clarity)' },
  ]
  const gap = 14
  const cardW = (contentW - gap) / 2
  const cardH = 66
  cards.forEach((c, i) => {
    const cx = margin + (i % 2) * (cardW + gap)
    const cy = y + Math.floor(i / 2) * (cardH + gap)
    fill(LIGHT); stroke('#E2E8F0'); doc.setLineWidth(0.8)
    doc.roundedRect(cx, cy, cardW, cardH, 8, 8, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); ink(NAVY)
    doc.text(c.big, cx + 16, cy + 34)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(GREY)
    doc.text(c.small.toUpperCase(), cx + 16, cy + 52, { charSpace: 0.6 })
  })
  y += cardH * 2 + gap + 22

  // Primary ICP highlight
  y = ensure(y, 92)
  fill(PANEL); doc.roundedRect(margin, y, contentW, 78, 8, 8, 'F')
  fill(ORANGE); doc.roundedRect(margin, y, 5, 78, 2, 2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(ORANGE)
  doc.text('PRIMARY ICP  ·  START HERE', margin + 18, y + 22, { charSpace: 1 })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); ink('#FFFFFF')
  doc.text(primaryLabel, margin + 18, y + 43)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(LIGHT)
  const primaryLine = data.primary
    ? (data.primary.the_big_win ? `They want: ${data.primary.the_big_win}` : 'Lead generation and outreach should prioritise this profile.')
    : 'No primary ICP has been marked yet. Choose one in the ICP Calibrator so Sales knows where to start.'
  wrap(primaryLine, margin + 18, y + 62, contentW - 36, 13)
  y += 78 + 22

  // How to use
  y = ensure(y, 60)
  y = label('How Sales & Marketing should use this', margin, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(INK)
  const uses = [
    'Sales: lead with the Primary ICP. Use its challenges and the "big win" to frame discovery, and the objections to prepare responses.',
    'Marketing: build messaging and campaigns around the primary profile first, then expand to the other calibrated ICPs.',
    'Both: treat the baseline beliefs and the buyer evidence as the "why" behind each profile, and flag anything that no longer rings true.',
  ]
  for (const u of uses) {
    y = ensure(y, 20)
    fill(SKY); doc.rect(margin + 1, y - 3.5, 3, 3, 'F')
    y = wrap(u, margin, y, contentW, 15, 12)
    y += 4
  }

  // ── Detailed ICP renderer ──────────────────────────────────────────────────
  function renderIcp(icp: IcpRecord, startY: number, full: boolean): number {
    let yy = ensure(startY, 70)
    // Title row with optional PRIMARY chip
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); ink(NAVY)
    doc.text(`${icp.segment_name} · ${buyerLabel(icp.buyer_type)}`, margin, yy)
    if (icp.is_primary) {
      const t = 'PRIMARY'
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
      const tw = doc.getTextWidth(t) + 16
      fill(ORANGE); doc.roundedRect(pageW - margin - tw, yy - 11, tw, 15, 7, 7, 'F')
      ink('#FFFFFF'); doc.text(t, pageW - margin - tw + 8, yy - 1, { charSpace: 0.5 })
    }
    yy += 8
    stroke('#E2E8F0'); doc.setLineWidth(0.8); doc.line(margin, yy, pageW - margin, yy)
    yy += 16

    yy = listField('Job titles', icp.job_titles, yy)
    // Two-up firmographics
    if (icp.company_size_range || icp.budget_range) {
      const half = (contentW - 16) / 2
      const yStart = yy
      let yl = yStart, yr = yStart
      if (icp.company_size_range) yl = field('Company size', icp.company_size_range, yStart, margin, half)
      if (icp.budget_range) yr = field('Budget range', icp.budget_range, yStart, margin + half + 16, half)
      yy = Math.max(yl, yr)
    }
    yy = listField('Industry verticals', icp.industry_verticals, yy)
    yy = field('The big win', icp.the_big_win, yy)
    yy = listField('Primary challenges', icp.primary_challenges, yy)
    yy = listField('Buying triggers', icp.buying_triggers, yy)

    if (full) {
      yy = field('Decision-making power', icp.decision_making_power, yy)
      yy = field('Buying motion', icp.buying_motion, yy)
      yy = field('Urgency trigger', icp.buying_urgency_trigger, yy)
      yy = listField('Barriers to success', icp.barriers_to_success, yy)
      yy = listField('Success metrics', icp.success_metrics, yy)
      yy = listField('Purchase criteria', icp.purchase_criteria, yy)
      yy = listField('Information sources', icp.information_sources, yy)
      yy = field('Preferred communication', icp.preferred_communication, yy)
      yy = field('Values', icp.buyer_values, yy)
      yy = field('Risk sensitivities', icp.risk_sensitivities, yy)
      yy = field('Tech stack & integrations', icp.tech_stack, yy)
    }

    if (icp.common_objections.length > 0) {
      yy = ensure(yy, 40)
      yy = label('Common objections & how to overcome them', margin, yy)
      for (const o of icp.common_objections) {
        yy = ensure(yy, 34)
        // Objection: grey square bullet + the concern in quotes.
        fill(GREY); doc.rect(margin + 1, yy - 3.5, 3, 3, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); ink(INK)
        yy = wrap(o.objection ? `"${o.objection}"` : '(objection)', margin, yy, contentW, 15, 12)
        if (o.overcomes) {
          yy = ensure(yy, 20)
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); ink(GREY)
          doc.text('HOW TO OVERCOME', margin + 12, yy, { charSpace: 0.6 })
          yy += 12
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(INK)
          yy = wrap(o.overcomes, margin + 12, yy, contentW - 12, 14)
        }
        yy += 12
      }
    }

    // Messaging & engagement plan — synthesised from the company's Key Selling Points,
    // Strategic Messages, and Engagement Plan, tailored to this ICP.
    const mblock = data.messaging[icpKey(icp)]
    if (mblock && (mblock.messages.length > 0 || mblock.actions.length > 0)) {
      yy = ensure(yy, 56)
      // Tinted panel header bar so this reads as the actionable "so what".
      fill('#FFF3EC'); doc.roundedRect(margin, yy - 12, contentW, 22, 5, 5, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(ORANGE)
      doc.text('MESSAGING & ENGAGEMENT PLAN', margin + 10, yy + 3, { charSpace: 0.8 })
      yy += 24

      if (mblock.messages.length > 0) {
        yy = ensure(yy, 24)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(SKY)
        doc.text('How to message them', margin, yy)
        yy += 15
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(INK)
        for (const m of mblock.messages) {
          yy = ensure(yy, 16)
          fill(SKY); doc.rect(margin + 1, yy - 3.5, 3, 3, 'F')
          yy = wrap(m, margin, yy, contentW, 14, 12)
          yy += 3
        }
        yy += 8
      }
      if (mblock.actions.length > 0) {
        yy = ensure(yy, 24)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(ORANGE)
        doc.text('Recommended actions', margin, yy)
        yy += 15
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(INK)
        for (const a of mblock.actions) {
          yy = ensure(yy, 16)
          fill(ORANGE); doc.rect(margin + 1, yy - 3.5, 3, 3, 'F')
          yy = wrap(a, margin, yy, contentW, 14, 12)
          yy += 3
        }
        yy += 6
      }
    }

    return yy + 14
  }

  // ── Primary ICP section (full detail) ──────────────────────────────────────
  if (data.primary) {
    y = sectionPage('Primary ICP', 'Who we sell to first')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(GREY)
    y = wrap('This is the profile lead generation prioritises and Sales should open with. Full detail below.', margin, y, contentW, 15)
    y += 10
    renderIcp(data.primary, y, true)
  }

  // ── All calibrated ICPs (excluding the primary, which has its own section) ──
  const otherIcps = data.icps.filter(i => !(data.primary && i.is_primary))
  y = sectionPage('Calibrated ICPs', data.primary ? 'The other calibrated profiles' : 'Your calibrated profiles')
  if (data.icps.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); ink(GREY)
    wrap('No ICPs have been built yet. Complete Step 3 of the ICP Calibrator to populate this section.', margin, y, contentW, 16)
  } else if (otherIcps.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(GREY)
    wrap('Your primary ICP, detailed in the previous section, is currently your only calibrated profile. Build additional profiles in the ICP Calibrator to expand your reach.', margin, y, contentW, 15)
  } else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(GREY)
    y = wrap('Each profile below is a distinct buyer worth a tailored motion.', margin, y, contentW, 15)
    y += 12
    for (const icp of otherIcps) {
      y = renderIcp(icp, y, false)
    }
  }

  // ── Baseline beliefs ───────────────────────────────────────────────────────
  y = sectionPage('Baseline Profiles', 'Day-one beliefs (the "before")')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(GREY)
  y = wrap('What the team believed about its best customers before buyer research: the baseline the calibration is measured against.', margin, y, contentW, 15)
  y += 12

  if (data.baselines.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); ink(GREY)
    wrap('No baseline profiles captured yet.', margin, y, contentW, 16)
  } else {
    for (const cat of CUSTOMER_CATEGORIES) {
      const rows = data.baselines.filter(b => b.category === cat.value)
      if (rows.length === 0) continue
      y = ensure(y, 40)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); ink(NAVY)
      doc.text(cat.label, margin, y)
      const catLabelW = doc.getTextWidth(cat.label) // measure while bold 12pt is active
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(GREY)
      doc.text(cat.hint, margin + catLabelW + 12, y)
      y += 8
      stroke('#E2E8F0'); doc.setLineWidth(0.8); doc.line(margin, y, pageW - margin, y)
      y += 14
      for (const b of rows) {
        y = ensure(y, 44)
        const tag = b.profile_type === 'ideal' ? 'CUSTOMER WE WANT' : 'CUSTOMER WE HAVE'
        const nameStr = b.customer_name || '(unnamed)'
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); ink(INK)
        doc.text(nameStr, margin, y)
        const nameW = doc.getTextWidth(nameStr) // measure while bold 10.5pt is active
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); ink(b.profile_type === 'ideal' ? SKY : GREEN)
        doc.text(tag, margin + nameW + 10, y, { charSpace: 0.5 })
        y += 14
        const meta = [b.contact_name && `${b.contact_name}${b.contact_title ? `, ${b.contact_title}` : ''}`, b.segment_name, b.industry, b.company_size].filter(Boolean).join('  ·  ')
        if (meta) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(GREY); y = wrap(meta, margin, y, contentW, 13) }
        if (b.why_fits) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(INK); y = wrap(b.why_fits, margin, y, contentW, 14) }
        if (b.additional_context) { doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); ink(GREY); y = wrap(b.additional_context, margin, y, contentW, 13) }
        y += 12
      }
      y += 6
    }
  }

  // ── Buyer evidence ─────────────────────────────────────────────────────────
  y = sectionPage('Buyer Evidence', 'What buyers actually said')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(GREY)
  y = wrap('Current-customer responses tagged by best-customer category. This is the evidence that calibrates the profiles above.', margin, y, contentW, 15)
  y += 12

  if (data.tagged.length === 0) {
    y = ensure(y, 60)
    fill(LIGHT); stroke('#E2E8F0'); doc.setLineWidth(0.8)
    doc.roundedRect(margin, y, contentW, 54, 8, 8, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); ink(NAVY)
    doc.text('No responses tagged yet', margin + 16, y + 24)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(GREY)
    doc.text(`${data.totalResponses} response${data.totalResponses === 1 ? '' : 's'} collected. Tag current customers by category in the Response Manager to fill this in.`, margin + 16, y + 42)
    y += 54 + 16
  } else {
    for (const cat of CUSTOMER_CATEGORIES) {
      const rows = data.tagged.filter(t => t.customer_category === cat.value)
      if (rows.length === 0) continue
      y = ensure(y, 40)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); ink(NAVY)
      doc.text(`${cat.label}  (${rows.length})`, margin, y)
      y += 8
      stroke('#E2E8F0'); doc.setLineWidth(0.8); doc.line(margin, y, pageW - margin, y)
      y += 14
      for (const r of rows) {
        y = ensure(y, 18)
        const who = [r.respondent_name, r.respondent_title, r.respondent_company].filter(Boolean).join(' · ') || 'Unnamed respondent'
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(INK)
        fill(ORANGE); doc.rect(margin + 1, y - 3.5, 3, 3, 'F')
        y = wrap(who, margin, y, contentW, 15, 12)
        y += 3
      }
      y += 10
    }
  }

  // ── Footer + page numbers on every content page (skip cover) ────────────────
  const pages = doc.getNumberOfPages()
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p)
    stroke('#E2E8F0'); doc.setLineWidth(0.8)
    doc.line(margin, pageH - margin + 6, pageW - margin, pageH - margin + 6)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); ink(GREY)
    doc.text(`Assembly AI · ICP Calibration Report · ${data.orgName}`, margin, pageH - margin + 20)
    doc.text(`${p - 1}`, pageW - margin, pageH - margin + 20, { align: 'right' })
  }

  return new Uint8Array(doc.output('arraybuffer'))
}

// ── Word (docx) builder ───────────────────────────────────────────────────────
//
// Same content as the PDF, laid out as an editable Word document so Sales and
// Marketing can mark it up. Mirrors the section order of buildPdf.

async function buildDocx(data: ReportData): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  type Para = InstanceType<typeof Paragraph>

  const NAVY_H = '0A1628'
  const ORANGE_H = 'E8520A'
  const GREY_H = '6B7280'

  const children: Para[] = []

  const h1 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 } })
  const h2 = (text: string) => new Paragraph({ children: [new TextRun({ text, bold: true, size: 26, color: NAVY_H })], spacing: { before: 220, after: 100 } })
  const body = (text: string) => new Paragraph({ children: [new TextRun({ text, size: 21 })], spacing: { after: 120 } })
  const bullets = (items: string[]): Para[] => items.filter(Boolean).map(t => new Paragraph({ text: t, bullet: { level: 0 }, spacing: { after: 40 } }))
  const kv = (label: string, value: string): Para[] =>
    value.trim()
      ? [new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true, size: 21 }), new TextRun({ text: value, size: 21 })], spacing: { after: 60 } })]
      : []
  const labelList = (label: string, items: string[]): Para[] => {
    const clean = items.filter(Boolean)
    if (clean.length === 0) return []
    return [new Paragraph({ children: [new TextRun({ text: label.toUpperCase(), bold: true, color: GREY_H, size: 17 })], spacing: { before: 100, after: 40 } }), ...bullets(clean)]
  }

  function renderIcp(icp: IcpRecord, full: boolean): Para[] {
    const out: Para[] = []
    out.push(new Paragraph({
      children: [
        new TextRun({ text: `${icp.segment_name} · ${buyerLabel(icp.buyer_type)}`, bold: true, size: 26, color: NAVY_H }),
        ...(icp.is_primary ? [new TextRun({ text: '   PRIMARY', bold: true, size: 16, color: ORANGE_H })] : []),
      ],
      spacing: { before: 240, after: 100 },
    }))
    out.push(...labelList('Job titles', icp.job_titles))
    out.push(...kv('Company size', icp.company_size_range))
    out.push(...kv('Budget range', icp.budget_range))
    out.push(...labelList('Industry verticals', icp.industry_verticals))
    out.push(...kv('The big win', icp.the_big_win))
    out.push(...labelList('Primary challenges', icp.primary_challenges))
    out.push(...labelList('Buying triggers', icp.buying_triggers))
    if (full) {
      out.push(...kv('Decision-making power', icp.decision_making_power))
      out.push(...kv('Buying motion', icp.buying_motion))
      out.push(...kv('Urgency trigger', icp.buying_urgency_trigger))
      out.push(...labelList('Barriers to success', icp.barriers_to_success))
      out.push(...labelList('Success metrics', icp.success_metrics))
      out.push(...labelList('Purchase criteria', icp.purchase_criteria))
      out.push(...labelList('Information sources', icp.information_sources))
      out.push(...kv('Preferred communication', icp.preferred_communication))
      out.push(...kv('Values', icp.buyer_values))
      out.push(...kv('Risk sensitivities', icp.risk_sensitivities))
      out.push(...kv('Tech stack & integrations', icp.tech_stack))
    }
    if (icp.common_objections.length > 0) {
      out.push(new Paragraph({ children: [new TextRun({ text: 'COMMON OBJECTIONS & HOW TO OVERCOME THEM', bold: true, color: GREY_H, size: 17 })], spacing: { before: 120, after: 40 } }))
      for (const o of icp.common_objections) {
        if (o.objection) out.push(new Paragraph({ children: [new TextRun({ text: `"${o.objection}"`, bold: true, size: 21 })], spacing: { after: 20 } }))
        if (o.overcomes) out.push(new Paragraph({ children: [new TextRun({ text: `How to overcome: `, bold: true, size: 20, color: GREY_H }), new TextRun({ text: o.overcomes, size: 20 })], spacing: { after: 100 } }))
      }
    }
    const mblock = data.messaging[icpKey(icp)]
    if (mblock && (mblock.messages.length > 0 || mblock.actions.length > 0)) {
      out.push(new Paragraph({ children: [new TextRun({ text: 'MESSAGING & ENGAGEMENT PLAN', bold: true, color: ORANGE_H, size: 18 })], spacing: { before: 140, after: 60 } }))
      out.push(...labelList('How to message them', mblock.messages))
      out.push(...labelList('Recommended actions', mblock.actions))
    }
    return out
  }

  // Title block
  children.push(new Paragraph({ children: [new TextRun({ text: 'ICP Calibration Report', bold: true, size: 48, color: NAVY_H })], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [new TextRun({ text: data.orgName + (data.orgIndustry ? `  ·  ${data.orgIndustry}` : ''), size: 24, color: GREY_H })], spacing: { after: 40 } }))
  children.push(new Paragraph({ children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 20, color: GREY_H })], spacing: { after: 240 } }))

  // Overview
  children.push(h1('Overview'))
  children.push(body(`This report calibrates who ${data.orgName} believes its best customers are against what buyers actually said, then names the profiles Sales and Marketing should organise around. Treat it as a working document: mark it up, argue with it, and bring your input back in.`))
  children.push(...bullets([
    `Calibrated ICPs: ${data.icps.length}`,
    `Baseline profiles: ${data.baselines.length}`,
    `Tagged buyer responses: ${data.tagged.length} of ${data.totalResponses}`,
    `Gate 1 (Decision Clarity): ${data.gate1Approved ? 'Approved' : 'Pending'}`,
  ]))
  children.push(new Paragraph({
    children: [
      new TextRun({ text: 'Primary ICP — start here: ', bold: true, size: 21, color: ORANGE_H }),
      new TextRun({ text: data.primary ? `${data.primary.segment_name} · ${buyerLabel(data.primary.buyer_type)}` : 'Not selected yet.', size: 21 }),
    ],
    spacing: { before: 120, after: 160 },
  }))

  // Primary ICP
  if (data.primary) {
    children.push(h1('Primary ICP — who we sell to first'))
    children.push(...renderIcp(data.primary, true))
  }

  // Other calibrated ICPs
  const otherIcps = data.icps.filter(i => !(data.primary && i.is_primary))
  children.push(h1('Calibrated ICPs'))
  if (data.icps.length === 0) {
    children.push(body('No ICPs have been built yet. Complete Step 3 of the ICP Calibrator to populate this section.'))
  } else if (otherIcps.length === 0) {
    children.push(body('Your primary ICP, detailed above, is currently your only calibrated profile.'))
  } else {
    for (const icp of otherIcps) children.push(...renderIcp(icp, false))
  }

  // Baseline profiles
  children.push(h1('Baseline Profiles — day-one beliefs'))
  if (data.baselines.length === 0) {
    children.push(body('No baseline profiles captured yet.'))
  } else {
    for (const cat of CUSTOMER_CATEGORIES) {
      const rows = data.baselines.filter(b => b.category === cat.value)
      if (rows.length === 0) continue
      children.push(h2(`${cat.label} — ${cat.hint}`))
      for (const b of rows) {
        const tag = b.profile_type === 'ideal' ? 'CUSTOMER WE WANT' : 'CUSTOMER WE HAVE'
        children.push(new Paragraph({
          children: [
            new TextRun({ text: b.customer_name || '(unnamed)', bold: true, size: 21 }),
            new TextRun({ text: `   ${tag}`, bold: true, size: 15, color: b.profile_type === 'ideal' ? '0EA5E9' : '16A34A' }),
          ],
          spacing: { before: 100, after: 20 },
        }))
        const meta = [b.contact_name && `${b.contact_name}${b.contact_title ? `, ${b.contact_title}` : ''}`, b.segment_name, b.industry, b.company_size].filter(Boolean).join('  ·  ')
        if (meta) children.push(new Paragraph({ children: [new TextRun({ text: meta, size: 18, color: GREY_H })], spacing: { after: 40 } }))
        if (b.why_fits) children.push(body(b.why_fits))
        if (b.additional_context) children.push(new Paragraph({ children: [new TextRun({ text: b.additional_context, italics: true, size: 19, color: GREY_H })], spacing: { after: 80 } }))
      }
    }
  }

  // Buyer evidence
  children.push(h1('Buyer Evidence — what buyers said'))
  if (data.tagged.length === 0) {
    children.push(body(`No responses tagged yet. ${data.totalResponses} response${data.totalResponses === 1 ? '' : 's'} collected — tag current customers by category in the Response Manager to fill this in.`))
  } else {
    for (const cat of CUSTOMER_CATEGORIES) {
      const rows = data.tagged.filter(t => t.customer_category === cat.value)
      if (rows.length === 0) continue
      children.push(h2(`${cat.label} (${rows.length})`))
      children.push(...bullets(rows.map(r => [r.respondent_name, r.respondent_title, r.respondent_company].filter(Boolean).join(' · ') || 'Unnamed respondent')))
    }
  }

  const doc = new Document({
    creator: 'Assembly AI',
    title: `${data.orgName} — ICP Calibration Report`,
    description: 'Generated by Assembly AI',
    sections: [{ children }],
  })
  const buf = await Packer.toBuffer(doc)
  return new Uint8Array(buf)
}
