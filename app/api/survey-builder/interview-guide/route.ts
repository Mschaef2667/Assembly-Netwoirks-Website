import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

interface Question {
  id: string
  text: string
  stageId: number
}

interface Stage {
  id: number
  name: string
  description: string
}

interface RequestBody {
  questions: Question[]
  probes: Record<string, string[]>
  segmentName: string
  audienceName: string
  companyName: string
  stages: Stage[]
}

// Assembly AI brand colours (hex)
const NAVY   = '#0A1628'
const ORANGE = '#E8520A'
const BLUE   = '#0EA5E9'
const GREY   = '#6B7280'
const BLACK  = '#0D0D0D'

function buildPdf(body: RequestBody): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { questions, probes, segmentName, audienceName, companyName, stages } = body

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const doc    = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW  = doc.page.width
    const margin = 50
    const contentW = pageW - margin * 2

    // ── Cover ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, pageW, 6).fill(ORANGE)

    doc.moveDown(2)

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(ORANGE)
      .text('ASSEMBLY AI', { align: 'center', characterSpacing: 2 })

    doc.moveDown(1.2)

    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor(NAVY)
      .text('Decision Clarity Process', { align: 'center' })
      .text('Interview Guide', { align: 'center' })

    doc.moveDown(1.5)

    // Orange divider
    doc
      .moveTo(margin + 60, doc.y)
      .lineTo(pageW - margin - 60, doc.y)
      .strokeColor(ORANGE)
      .lineWidth(1.5)
      .stroke()

    doc.moveDown(1.5)

    // Meta fields — manual two-column layout
    const labelX = pageW / 2 - 110
    const valueX = pageW / 2 + 10
    const metaRows: [string, string][] = [
      ['Company:', companyName],
      ['Segment:', segmentName],
      ['Audience:', audienceName],
      ['Date:', today],
    ]

    for (const [label, value] of metaRows) {
      const rowY = doc.y
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(GREY)
        .text(label, labelX, rowY, { width: 110, align: 'right', lineBreak: false })
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(BLACK)
        .text(value, valueX, rowY, { width: 200 })
      doc.moveDown(0.5)
    }

    doc.moveDown(2)

    // ── How to Use This Guide box ─────────────────────────────────────────────
    const boxTopY = doc.y
    const boxPad  = 14

    // Background fill (light blue tint via opacity)
    doc
      .save()
      .fillOpacity(0.07)
      .rect(margin, boxTopY, contentW, 156)
      .fill(BLUE)
      .restore()

    // Border
    doc
      .rect(margin, boxTopY, contentW, 156)
      .strokeColor(BLUE)
      .lineWidth(0.75)
      .stroke()

    // Left accent bar
    doc
      .rect(margin, boxTopY, 4, 156)
      .fill(BLUE)

    const textX = margin + boxPad + 4

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(NAVY)
      .text('How to Use This Guide', textX, boxTopY + boxPad, { width: contentW - boxPad * 2 })

    doc.moveDown(0.4)

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#333333')
      .text(
        'This structured guide supports a 45–60 minute qualitative interview across all 7 stages of the Decision Clarity Process. Each main question is followed by 3 probing sub-questions to help you go deeper.',
        textX, doc.y, { width: contentW - boxPad * 2 - 4 },
      )

    doc.moveDown(0.45)

    const bullets = [
      'Ask the main question first, then use probes only if the respondent does not go deep enough.',
      'Listen actively — do not lead the witness. Probes should follow the respondent\'s lead.',
      'Take notes or record with permission. Capture exact phrases where possible.',
      'Stay curious. Unexpected answers often contain the most valuable insight.',
    ]

    for (const bullet of bullets) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#333333')
        .text(`• ${bullet}`, textX, doc.y, { width: contentW - boxPad * 2 - 4 })
      doc.moveDown(0.3)
    }

    doc.moveDown(1.5)

    // ── Stages + questions ────────────────────────────────────────────────────
    const subLabels  = ['a', 'b', 'c']
    const fallbackProbes = [
      'Can you tell me more about that?',
      'What was the impact of that?',
      'What would have changed that outcome?',
    ]

    for (const stage of stages) {
      const stageQs = questions.filter(q => q.stageId === stage.id)
      if (stageQs.length === 0) continue

      if (doc.y > doc.page.height - 150) doc.addPage()

      // Stage header text
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(NAVY)
        .text(`Stage ${stage.id} — ${stage.name}`, margin, doc.y, { width: contentW })

      doc.moveDown(0.3)

      // Orange underline
      doc
        .moveTo(margin, doc.y)
        .lineTo(pageW - margin, doc.y)
        .strokeColor(ORANGE)
        .lineWidth(1.5)
        .stroke()

      doc.moveDown(0.55)

      // Stage description
      doc
        .font('Helvetica-Oblique')
        .fontSize(10)
        .fillColor(GREY)
        .text(stage.description, margin, doc.y, { width: contentW })

      doc.moveDown(0.9)

      stageQs.forEach((q, qi) => {
        if (doc.y > doc.page.height - 110) doc.addPage()

        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(BLACK)
          .text(`${qi + 1}. ${q.text}`, margin, doc.y, { width: contentW })

        doc.moveDown(0.35)

        const subs  = (probes[q.id] ?? []).slice(0, 3)
        const items = subs.length > 0 ? subs : fallbackProbes

        items.forEach((sub, si) => {
          doc
            .font('Helvetica')
            .fontSize(10.5)
            .fillColor(GREY)
            .text(`   ${subLabels[si]}. ${sub}`, margin + 16, doc.y, { width: contentW - 16 })
          doc.moveDown(0.3)
        })

        doc.moveDown(0.6)
      })

      doc.moveDown(0.8)
    }

    // ── Page footers ──────────────────────────────────────────────────────────
    const totalPages = doc.bufferedPageRange().count
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i)
      const footerY = doc.page.height - 36
      doc
        .moveTo(margin, footerY - 8)
        .lineTo(pageW - margin, footerY - 8)
        .strokeColor('#CCCCCC')
        .lineWidth(0.5)
        .stroke()
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#999999')
        .text(`Assembly AI Confidential — ${companyName}`, margin, footerY, {
          width: contentW - 60,
          align: 'left',
          lineBreak: false,
        })
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#999999')
        .text(`Page ${i + 1} of ${totalPages}`, margin, footerY, {
          width: contentW,
          align: 'right',
          lineBreak: false,
        })
    }

    doc.end()
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as RequestBody
    const pdfBuffer = await buildPdf(body)
    const slug = `${body.companyName.replace(/\s+/g, '-')}-interview-guide-${body.segmentName.replace(/\s+/g, '-')}`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${slug}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[interview-guide] PDF generation failed:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
