import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { WHITEPAPER, type WhitepaperSection } from '@/lib/whitepaper/content'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DownloadBody {
  firstName?: string
  lastName?: string
  email?: string
  company?: string
  jobTitle?: string
  situation?: string
}

const ALLOWED_SITUATIONS = new Set([
  'Building new',
  'Validating existing',
  'Refreshing stale',
  'Just exploring',
])

const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Helpers ───────────────────────────────────────────────────────────────────

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0 || at === email.length - 1) return null
  return email.slice(at + 1).toLowerCase()
}

function isWorkEmail(email: string): boolean {
  const domain = extractDomain(email)
  if (!domain) return false
  return !PERSONAL_DOMAINS.has(domain)
}

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() || null
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return null
}

// ── PDF generation ────────────────────────────────────────────────────────────

const NAVY   = '#0A1628'
const ORANGE = '#E8520A'
const GREY   = '#6B7280'
const BLACK  = '#0D0D0D'

type JsPdf = {
  internal: { pageSize: { getWidth(): number; getHeight(): number }; pages: unknown[] }
  setFillColor(r: number, g: number, b: number): void
  setDrawColor(r: number, g: number, b: number): void
  setTextColor(r: number, g: number, b: number): void
  setFont(family: string, style?: string): void
  setFontSize(size: number): void
  setLineWidth(width: number): void
  text(text: string, x: number, y: number, opts?: { align?: 'left' | 'center' | 'right'; charSpace?: number }): void
  rect(x: number, y: number, w: number, h: number, style?: string): void
  line(x1: number, y1: number, x2: number, y2: number): void
  addPage(): void
  setPage(n: number): void
  splitTextToSize(text: string, maxWidth: number): string[]
  output(type: 'arraybuffer'): ArrayBuffer
}

async function generatePdf(): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' }) as unknown as JsPdf

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 56
  const contentW = pageW - margin * 2

  function hexToRgb(hex: string): [number, number, number] {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  }
  function setFill(hex: string)   { const [r, g, b] = hexToRgb(hex); doc.setFillColor(r, g, b) }
  function setStroke(hex: string) { const [r, g, b] = hexToRgb(hex); doc.setDrawColor(r, g, b) }
  function setTextColor(hex: string) { const [r, g, b] = hexToRgb(hex); doc.setTextColor(r, g, b) }

  function checkPage(y: number, needed = 60): number {
    if (y + needed > pageH - margin - 30) {
      doc.addPage()
      return margin + 20
    }
    return y
  }

  function wrappedText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    const lines = doc.splitTextToSize(text, maxWidth)
    for (const line of lines) {
      if (y > pageH - margin - 30) {
        doc.addPage()
        y = margin + 20
      }
      doc.text(line, x, y)
      y += lineHeight
    }
    return y
  }

  // ── Cover page ──
  setFill(NAVY)
  doc.rect(0, 0, pageW, pageH, 'F')

  setFill(ORANGE)
  doc.rect(0, 0, pageW, 6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setTextColor(ORANGE)
  doc.text('ASSEMBLY AI · WHITE PAPER', pageW / 2, 110, { align: 'center', charSpace: 2 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  setTextColor('#FFFFFF')
  const titleLines = doc.splitTextToSize(WHITEPAPER.title, contentW)
  let coverY = 200
  for (const line of titleLines) {
    doc.text(line, pageW / 2, coverY, { align: 'center' })
    coverY += 38
  }

  setStroke(ORANGE)
  doc.setLineWidth(2)
  doc.line(pageW / 2 - 60, coverY + 8, pageW / 2 + 60, coverY + 8)
  coverY += 40

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  setTextColor('#CBD5E1')
  const subtitleLines = doc.splitTextToSize(WHITEPAPER.subtitle, contentW - 60)
  for (const line of subtitleLines) {
    doc.text(line, pageW / 2, coverY, { align: 'center' })
    coverY += 22
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  setTextColor('#FFFFFF')
  doc.text(WHITEPAPER.author, pageW / 2, pageH - 160, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setTextColor('#94A3B8')
  doc.text(WHITEPAPER.organization, pageW / 2, pageH - 140, { align: 'center' })
  doc.text(WHITEPAPER.publicationDate, pageW / 2, pageH - 122, { align: 'center' })

  // ── Executive summary ──
  doc.addPage()
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setTextColor(ORANGE)
  doc.text('EXECUTIVE SUMMARY', margin, y, { charSpace: 1.5 })
  y += 24

  setFill(ORANGE)
  doc.rect(margin, y - 10, 36, 3, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  setTextColor(NAVY)
  y = wrappedText(WHITEPAPER.title, margin, y, contentW, 26)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setTextColor(BLACK)
  for (const para of WHITEPAPER.executiveSummary) {
    y = wrappedText(para, margin, y, contentW, 16)
    y += 10
  }

  // ── Sections ──
  for (const section of WHITEPAPER.sections) {
    doc.addPage()
    y = margin

    setFill(NAVY)
    doc.rect(0, 0, pageW, 50, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setTextColor(ORANGE)
    doc.text(`SECTION ${section.number}`, margin, 22, { charSpace: 1.5 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    setTextColor('#FFFFFF')
    doc.text(section.title, margin, 40)

    y = 80
    renderSectionBody(section, y)

    function renderSectionBody(s: WhitepaperSection, startY: number): number {
      let yy = startY
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      setTextColor(BLACK)
      for (const para of s.paragraphs) {
        yy = checkPage(yy, 40)
        yy = wrappedText(para, margin, yy, contentW, 16)
        yy += 10
      }
      if (s.bullets && s.bullets.length > 0) {
        yy = checkPage(yy, 30)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        setTextColor(NAVY)
        doc.text('Key Points', margin, yy)
        yy += 16
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        setTextColor(BLACK)
        for (const bullet of s.bullets) {
          yy = checkPage(yy, 24)
          yy = wrappedText(`•  ${bullet}`, margin + 6, yy, contentW - 6, 15)
          yy += 4
        }
      }
      return yy
    }
  }

  // ── Conclusion ──
  doc.addPage()
  y = margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setTextColor(ORANGE)
  doc.text('CONCLUSION', margin, y, { charSpace: 1.5 })
  y += 24

  setFill(ORANGE)
  doc.rect(margin, y - 10, 36, 3, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  setTextColor(NAVY)
  y = wrappedText('Earn Your Strategy', margin, y, contentW, 26)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setTextColor(BLACK)
  for (const para of WHITEPAPER.conclusion) {
    y = wrappedText(para, margin, y, contentW, 16)
    y += 10
  }

  y = checkPage(y, 80)
  y += 16
  setFill('#FEF3E8')
  doc.rect(margin, y, contentW, 64, 'F')
  setStroke(ORANGE)
  doc.setLineWidth(1)
  doc.line(margin, y, margin + 4, y + 64)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setTextColor(NAVY)
  doc.text('Next Steps', margin + 16, y + 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setTextColor(BLACK)
  wrappedText(WHITEPAPER.callToAction, margin + 16, y + 40, contentW - 32, 14)

  // ── Footer on every page ──
  const totalPages = doc.internal.pages.length - 1
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    if (p === 1) continue // skip cover
    setFill(NAVY)
    doc.rect(0, pageH - 26, pageW, 26, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setTextColor('#94A3B8')
    doc.text('Assembly Networks · assemblyai.net', margin, pageH - 10)
    doc.text(`${p} / ${totalPages}`, pageW - margin, pageH - 10, { align: 'right' })
    doc.text(WHITEPAPER.title, pageW / 2, pageH - 10, { align: 'center' })
  }

  const buffer = doc.output('arraybuffer')
  return new Uint8Array(buffer)
}

// ── Notification email ────────────────────────────────────────────────────────

interface LeadRecord {
  firstName: string | null
  lastName: string | null
  email: string
  company: string | null
  jobTitle: string | null
  situation: string | null
}

async function sendNotificationEmail(lead: LeadRecord): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[whitepaper/download] RESEND_API_KEY not set; skipping notification email.')
    return
  }
  const from = process.env.WHITEPAPER_NOTIFY_FROM ?? 'Assembly AI <noreply@assemblyai.net>'
  const to = process.env.WHITEPAPER_NOTIFY_TO ?? 'info@assemblynetworks.net'

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'
  const body = `
    <h2 style="font-family: Helvetica, Arial, sans-serif; color:#0A1628;">New white paper download</h2>
    <table style="font-family: Helvetica, Arial, sans-serif; font-size:14px; color:#0D0D0D; border-collapse: collapse;">
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Name</td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Email</td><td>${escapeHtml(lead.email)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Company</td><td>${escapeHtml(lead.company ?? '—')}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Job Title</td><td>${escapeHtml(lead.jobTitle ?? '—')}</td></tr>
      <tr><td style="padding:6px 14px 6px 0; color:#6B7280;">Situation</td><td>${escapeHtml(lead.situation ?? '—')}</td></tr>
    </table>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `New white paper lead: ${fullName} (${lead.company ?? 'unknown'})`,
        html: body,
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[whitepaper/download] resend failed:', res.status, txt)
    }
  } catch (err) {
    console.error('[whitepaper/download] resend error:', err)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  let body: DownloadBody
  try {
    body = (await req.json()) as DownloadBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const firstName = clean(body.firstName, 80)
  const lastName  = clean(body.lastName, 80)
  const emailRaw  = clean(body.email, 254)
  const company   = clean(body.company, 200)
  const jobTitle  = clean(body.jobTitle, 200)
  const situation = clean(body.situation, 80)

  if (!emailRaw) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }
  const email = emailRaw.toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (!isWorkEmail(email)) {
    return NextResponse.json(
      { error: 'Please use your work email address (not a personal email).' },
      { status: 400 },
    )
  }
  if (situation && !ALLOWED_SITUATIONS.has(situation)) {
    return NextResponse.json({ error: 'Invalid situation value.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const ip = clientIp(req)
  const { error: insertError } = await supabase
    .from('whitepaper_leads')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      company,
      job_title: jobTitle,
      situation,
      ip_address: ip,
    })

  if (insertError) {
    console.error('[whitepaper/download] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save your details. Please try again.' }, { status: 500 })
  }

  const lead: LeadRecord = { firstName, lastName, email, company, jobTitle, situation }
  void sendNotificationEmail(lead)

  let pdf: Uint8Array
  try {
    pdf = await generatePdf()
  } catch (err) {
    console.error('[whitepaper/download] pdf error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 })
  }

  return new Response(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="assembly-ai-whitepaper.pdf"',
      'Content-Length': String(pdf.byteLength),
      'Cache-Control': 'no-store',
    },
  })
}
