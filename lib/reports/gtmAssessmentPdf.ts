// GTM Gap Report — branded PDF builder (jsPDF), mirroring the ICP report route.
import { NAVY, ORANGE, BLUE, GREY } from '@/lib/reports/config'
import type { GtmAssessmentReport, GtmRating } from '@/lib/prompts/gtmAssessment'

const INK = '#111827'
const LIGHT = '#D1D9E6'
const MIDGREY = '#9AA4B2'
const GREEN = '#15803D'
const AMBER = '#B45309'
const RED = '#B91C1C'

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

export interface GtmPdfMeta {
  company: string
  industry?: string | null
  date: string
}

const ratingColor = (rating: GtmRating | string): string =>
  rating === 'Strong' ? GREEN : rating === 'Needs work' ? RED : AMBER

export async function buildGtmAssessmentPdf(report: GtmAssessmentReport, meta: GtmPdfMeta): Promise<Uint8Array> {
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

  function ensure(y: number, needed = 48): number {
    if (y + needed > bottom) { doc.addPage(); return margin + 8 }
    return y
  }

  function sectionHeading(text: string, y: number): number {
    y = ensure(y, 40)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(ORANGE)
    doc.text(text.toUpperCase(), margin, y, { charSpace: 1.2 })
    stroke('#E5E7EB'); doc.setLineWidth(0.8); doc.line(margin, y + 6, pageW - margin, y + 6)
    return y + 22
  }

  function para(text: string, y: number): number {
    if (!text) return y
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(INK)
    return wrap(text, margin, y, contentW, 15) + 6
  }

  // ── Cover ────────────────────────────────────────────────────────────────
  fill(NAVY); doc.rect(0, 0, pageW, pageH, 'F')
  fill(ORANGE); doc.rect(0, 0, pageW, 7, 'F')

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); ink(BLUE)
  doc.text('ASSEMBLY NETWORKS · THE C3 METHOD', pageW / 2, 150, { align: 'center', charSpace: 2 })

  doc.setFont('helvetica', 'bold'); doc.setFontSize(38); ink('#FFFFFF')
  doc.text('GTM Gap Report', pageW / 2, 240, { align: 'center' })

  stroke(BLUE); doc.setLineWidth(2); doc.line(pageW / 2 - 40, 268, pageW / 2 + 40, 268)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); ink('#FFFFFF')
  doc.text(meta.company, pageW / 2, 316, { align: 'center' })
  if (meta.industry) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); ink(LIGHT)
    doc.text(meta.industry, pageW / 2, 338, { align: 'center' })
  }

  if (report.headline_verdict) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); ink(LIGHT)
    const hv = doc.splitTextToSize(report.headline_verdict, contentW - 60)
    let cy = pageH / 2 + 30
    for (const line of hv.slice(0, 5)) { doc.text(line, pageW / 2, cy, { align: 'center' }); cy += 18 }
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(MIDGREY)
  doc.text('An assessment of your stated go-to-market strategy', pageW / 2, pageH - 150, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); ink('#FFFFFF')
  doc.text(meta.date, pageW / 2, pageH - 120, { align: 'center' })

  // ── Body ─────────────────────────────────────────────────────────────────
  doc.addPage()
  let y = margin + 6

  // Snapshot
  if (report.snapshot) {
    y = sectionHeading('What we heard', y)
    y = para(report.snapshot, y) + 6
  }

  // Scorecard
  if (report.scorecard?.length) {
    y = sectionHeading('Scorecard', y)
    for (const s of report.scorecard) {
      y = ensure(y, 46)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); ink(NAVY)
      doc.text(s.dimension || '', margin, y)
      // rating pill on the right
      const rlabel = (s.rating || '').toUpperCase()
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
      const pw = doc.getTextWidth(rlabel) + 18
      fill(ratingColor(s.rating)); doc.roundedRect(pageW - margin - pw, y - 10, pw, 15, 4, 4, 'F')
      ink('#FFFFFF'); doc.text(rlabel, pageW - margin - pw + 9, y, { charSpace: 0.5 })
      y += 15
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(INK)
      y = wrap(s.reason || '', margin, y, contentW, 14) + 10
    }
    y += 2
  }

  // Gaps
  if (report.gaps?.length) {
    y = sectionHeading('Where the gaps likely are', y)
    report.gaps.forEach((g, i) => {
      y = ensure(y, 70)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); ink(NAVY)
      y = wrap(`${i + 1}. ${g.gap || ''}`, margin, y, contentW, 15) + 4
      if (g.why_it_costs) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); ink(GREY)
        doc.text('WHY IT COSTS YOU', margin, y, { charSpace: 0.6 }); y += 13
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); ink(INK)
        y = wrap(g.why_it_costs, margin, y, contentW, 14) + 6
      }
      if (g.probing_question) {
        y = ensure(y, 34)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); ink(BLUE)
        doc.text('QUESTION TO ASK YOURSELF', margin, y, { charSpace: 0.6 }); y += 13
        doc.setFont('helvetica', 'italic'); doc.setFontSize(10); ink('#334155')
        y = wrap(g.probing_question, margin, y, contentW, 14) + 12
      }
    })
  }

  // Quick wins
  if (report.quick_wins?.length) {
    y = sectionHeading('Quick wins this week', y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink(INK)
    for (const w of report.quick_wins) {
      y = ensure(y, 18)
      fill(ORANGE); doc.rect(margin + 1, y - 3.5, 3, 3, 'F')
      y = wrap(w, margin, y, contentW, 15, 12) + 4
    }
    y += 4
  }

  // Bigger opportunity
  if (report.bigger_opportunity) {
    y = sectionHeading('The bigger opportunity', y)
    y = para(report.bigger_opportunity, y) + 6
  }

  // Why Assembly AI
  if (report.why_assembly_ai) {
    y = ensure(y, 60)
    y = sectionHeading('Why Assembly AI changes the outcome', y)
    y = para(report.why_assembly_ai, y) + 6
  }

  // Next step
  if (report.next_step) {
    y = ensure(y, 70)
    fill(NAVY); doc.roundedRect(margin, y, contentW, 74, 8, 8, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(BLUE)
    doc.text('YOUR NEXT STEP', margin + 18, y + 24, { charSpace: 1 })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); ink('#FFFFFF')
    wrap(report.next_step, margin + 18, y + 42, contentW - 36, 14)
    y += 90
  }

  // ── Disclaimer (fixed boilerplate, never model-generated) ─────────────────
  y = ensure(y, 70)
  stroke('#E5E7EB'); doc.setLineWidth(0.6); doc.line(margin, y, pageW - margin, y); y += 16
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); ink(GREY)
  doc.text('ABOUT THIS REPORT', margin, y, { charSpace: 0.6 }); y += 12
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); ink(GREY)
  const disclaimer = 'This assessment is based solely on the information you provided about your go-to-market strategy. It reflects our informed interpretation of that input, not independent research into your buyers or market, and is intended as directional guidance rather than a guarantee of results. The real gains come from replacing assumptions with validated buyer research, which is what a C3 Method strategy sprint delivers. © 2026 Assembly Networks, LLC. Prepared for your internal use.'
  y = wrap(disclaimer, margin, y, contentW, 12)

  // ── Footer (page numbers + brand line) on body pages ──────────────────────
  const total = doc.getNumberOfPages()
  for (let p = 2; p <= total; p++) {
    doc.setPage(p)
    stroke('#E5E7EB'); doc.setLineWidth(0.6); doc.line(margin, pageH - 40, pageW - margin, pageH - 40)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); ink(GREY)
    doc.text('Assembly Networks · assemblynetworks.net', margin, pageH - 26)
    doc.text(`${p - 1}`, pageW - margin, pageH - 26, { align: 'right' })
  }

  return new Uint8Array(doc.output('arraybuffer'))
}
