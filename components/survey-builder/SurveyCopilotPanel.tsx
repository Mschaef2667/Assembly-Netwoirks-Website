'use client'

import { useState } from 'react'
import { Loader2, Wand2, CheckCircle2, Copy, Download, AlertTriangle, FileText, Link2, Users } from 'lucide-react'
import TipsPanel from '@/components/ui/TipsPanel'
import { STEP_TIPS } from '@/lib/tips'
import type { CopilotStatus, Audience, SurveyState, Segment } from './types'
import { STAGES, AUDIENCES, LOCKED_QUESTIONS } from './constants'

interface MissingQuestion {
  stage: number
  text: string
}

interface Props {
  copilotStatus: CopilotStatus
  stageCounts: Record<number, number> | null
  copilotError: string | null
  orgId: string | null
  selectedAudience: Audience
  survey: SurveyState
  total: number
  copyDone: boolean
  isApproved: boolean
  markingComplete: boolean
  mode: 'survey' | 'interview'
  probes: Map<string, string[]>
  selectedSegment: Segment | null
  orgName: string
  onGenerate: () => Promise<void>
  onLoadRecommended: () => void
  onCopy: () => Promise<void>
  onDownloadCSV: () => void
  onMarkComplete: () => void
  onAddMissingLockedQuestions: () => void
}

function computeMissingLocked(survey: SurveyState): MissingQuestion[] {
  const missing: MissingQuestion[] = []
  for (const [stageKey, lockedQs] of Object.entries(LOCKED_QUESTIONS)) {
    const stageId    = parseInt(stageKey, 10)
    const surveyQs   = survey[stageId] ?? []
    const lockedCount = surveyQs.filter(q => q.locked).length
    for (let i = lockedCount; i < lockedQs.length; i++) {
      missing.push({ stage: stageId, text: lockedQs[i].text })
    }
  }
  return missing
}

export default function SurveyCopilotPanel({
  copilotStatus,
  stageCounts,
  copilotError,
  orgId,
  selectedAudience,
  survey,
  total,
  copyDone,
  isApproved,
  markingComplete,
  mode,
  probes,
  selectedSegment,
  orgName,
  onGenerate,
  onLoadRecommended,
  onCopy,
  onDownloadCSV,
  onMarkComplete,
  onAddMissingLockedQuestions,
}: Props) {
  const [showWarning, setShowWarning]           = useState(false)
  const [missingQs, setMissingQs]               = useState<MissingQuestion[]>([])
  const [downloadingGuide, setDownloadingGuide] = useState(false)
  const [linkStatus, setLinkStatus]             = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [surveyUrl, setSurveyUrl]               = useState<string | null>(null)
  const [responseCount, setResponseCount]       = useState<number>(0)
  const [urlCopied, setUrlCopied]               = useState(false)

  async function handleGenerateLink() {
    if (linkStatus === 'generating' || !orgId || !selectedSegment) return
    setLinkStatus('generating')
    try {
      const flatQuestions = STAGES.flatMap(stage =>
        (survey[stage.id] ?? []).map(q => ({
          id: q.id,
          stageId: stage.id,
          stageName: stage.name,
          text: q.text,
          type: q.type,
        }))
      )
      const res = await fetch('/api/survey-builder/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          audience: selectedAudience,
          segmentSlug: selectedSegment.slug,
          segmentName: selectedSegment.name,
          questions: flatQuestions,
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to generate link')
      }
      const data = await res.json() as { url: string; responseCount: number }
      setSurveyUrl(data.url)
      setResponseCount(data.responseCount)
      setLinkStatus('done')
    } catch (err) {
      console.error('generate-link error:', err)
      setLinkStatus('error')
    }
  }

  async function handleCopyUrl() {
    if (!surveyUrl) return
    await navigator.clipboard.writeText(surveyUrl)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 2000)
  }

  async function handleDownloadInterviewGuide() {
    if (downloadingGuide || total === 0 || probes.size === 0) return
    setDownloadingGuide(true)
    try {
      const { jsPDF } = await import('jspdf')

      const audienceLabel = AUDIENCES.find(a => a.id === selectedAudience)!.label
      const segmentName   = selectedSegment?.name ?? 'All Segments'
      const company       = orgName || 'Your Company'
      const today         = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

      const NAVY   = '#0A1628'
      const ORANGE = '#E8520A'
      const BLUE   = '#0EA5E9'
      const GREY   = '#6B7280'
      const BLACK  = '#0D0D0D'

      const doc     = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
      const pageW   = doc.internal.pageSize.getWidth()
      const pageH   = doc.internal.pageSize.getHeight()
      const margin  = 50
      const contentW = pageW - margin * 2

      // ── helpers ──────────────────────────────────────────────────────────────

      function hexToRgb(hex: string): [number, number, number] {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return [r, g, b]
      }

      function setFill(hex: string) { doc.setFillColor(...hexToRgb(hex)) }
      function setStroke(hex: string) { doc.setDrawColor(...hexToRgb(hex)) }
      function setTextColor(hex: string) { doc.setTextColor(...hexToRgb(hex)) }

      // wrappedText returns the y position after the last line
      function wrappedText(
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
      ): number {
        const lines = doc.splitTextToSize(text, maxWidth) as string[]
        for (const line of lines) {
          doc.text(line, x, y)
          y += lineHeight
        }
        return y
      }

      let y = margin

      // ── Cover ────────────────────────────────────────────────────────────────

      // Orange top bar
      setFill(ORANGE)
      doc.rect(0, 0, pageW, 5, 'F')

      y = 80

      // "ASSEMBLY AI" small caps
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      setTextColor(ORANGE)
      doc.text('ASSEMBLY AI', pageW / 2, y, { align: 'center', charSpace: 2 })
      y += 28

      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(24)
      setTextColor(NAVY)
      doc.text('Decision Clarity Process', pageW / 2, y, { align: 'center' })
      y += 30
      doc.text('Interview Guide', pageW / 2, y, { align: 'center' })
      y += 28

      // Orange divider
      setStroke(ORANGE)
      doc.setLineWidth(1.5)
      doc.line(margin + 60, y, pageW - margin - 60, y)
      y += 28

      // Meta rows
      const labelX = pageW / 2 - 110
      const valueX = pageW / 2 + 14
      const metaRows: [string, string][] = [
        ['Company:', company],
        ['Segment:', segmentName],
        ['Audience:', audienceLabel],
        ['Date:', today],
      ]
      doc.setFontSize(11)
      for (const [label, value] of metaRows) {
        doc.setFont('helvetica', 'bold')
        setTextColor(GREY)
        doc.text(label, labelX + 108, y, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        setTextColor(BLACK)
        doc.text(value, valueX, y)
        y += 18
      }
      y += 28

      // ── How to Use This Guide box ─────────────────────────────────────────────

      const boxHeight = 148
      const boxPad    = 14

      // Light blue tinted background
      const [br, bg, bb] = hexToRgb(BLUE)
      doc.setFillColor(br, bg, bb)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doc.setGState(new (doc as any).GState({ opacity: 0.07 }))
      doc.rect(margin, y, contentW, boxHeight, 'F')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doc.setGState(new (doc as any).GState({ opacity: 1 }))

      // Border
      setStroke(BLUE)
      doc.setLineWidth(0.75)
      doc.rect(margin, y, contentW, boxHeight, 'S')

      // Left accent bar
      setFill(BLUE)
      doc.rect(margin, y, 4, boxHeight, 'F')

      const textX = margin + boxPad + 4
      const innerW = contentW - boxPad * 2 - 4

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      setTextColor(NAVY)
      doc.text('How to Use This Guide', textX, y + boxPad + 10)

      let by = y + boxPad + 26

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      setTextColor('#333333')
      by = wrappedText(
        'This structured guide supports a 45–60 minute qualitative interview across all 7 stages of the Decision Clarity Process. Each main question is followed by 3 probing sub-questions to help you go deeper.',
        textX, by, innerW, 13,
      )
      by += 6

      const bullets = [
        'Ask the main question first, then use probes only if the respondent does not go deep enough.',
        'Listen actively — do not lead the witness. Probes should follow the respondent\'s lead.',
        'Take notes or record with permission. Capture exact phrases where possible.',
        'Stay curious. Unexpected answers often contain the most valuable insight.',
      ]
      for (const bullet of bullets) {
        by = wrappedText(`• ${bullet}`, textX, by, innerW, 13)
        by += 3
      }

      y = y + boxHeight + 24

      // ── Stages + questions ────────────────────────────────────────────────────

      const subLabels     = ['a', 'b', 'c']
      const fallbackProbes = [
        'Can you tell me more about that?',
        'What was the impact of that?',
        'What would have changed that outcome?',
      ]

      const pages: number[] = [1]

      function addPageIfNeeded(spaceNeeded: number) {
        if (y + spaceNeeded > pageH - 60) {
          doc.addPage()
          pages.push(pages.length + 1)
          y = margin
        }
      }

      for (const stage of STAGES) {
        const stageQs = STAGES.flatMap(s =>
          s.id === stage.id ? (survey[s.id] ?? []).map(q => ({ id: q.id, text: q.text, stageId: s.id })) : []
        )
        if (stageQs.length === 0) continue

        addPageIfNeeded(120)

        // Stage header
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        setTextColor(NAVY)
        doc.text(`Stage ${stage.id} — ${stage.name}`, margin, y)
        y += 8

        // Orange underline
        setStroke(ORANGE)
        doc.setLineWidth(1.5)
        doc.line(margin, y, pageW - margin, y)
        y += 12

        // Stage description
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        setTextColor(GREY)
        y = wrappedText(stage.description, margin, y, contentW, 13)
        y += 14

        stageQs.forEach((q, qi) => {
          addPageIfNeeded(80)

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
          setTextColor(BLACK)
          y = wrappedText(`${qi + 1}. ${q.text}`, margin, y, contentW, 15)
          y += 6

          const subs  = (probes.get(q.id) ?? []).slice(0, 3)
          const items = subs.length > 0 ? subs : fallbackProbes

          items.forEach((sub, si) => {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            setTextColor(GREY)
            y = wrappedText(`   ${subLabels[si]}. ${sub}`, margin + 16, y, contentW - 16, 13)
            y += 4
          })

          y += 10
        })

        y += 12
      }

      // ── Page footers ──────────────────────────────────────────────────────────

      const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        const footerY = pageH - 28

        doc.setDrawColor(204, 204, 204)
        doc.setLineWidth(0.5)
        doc.line(margin, footerY - 8, pageW - margin, footerY - 8)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        setTextColor('#999999')
        doc.text(`Assembly AI Confidential — ${company}`, margin, footerY)
        doc.text(`Page ${i} of ${totalPages}`, pageW - margin, footerY, { align: 'right' })
      }

      const slug = `${company.replace(/\s+/g, '-')}-interview-guide-${segmentName.replace(/\s+/g, '-')}`
      doc.save(`${slug}.pdf`)
    } catch (e) {
      console.error('Interview guide PDF export failed:', e)
    } finally {
      setDownloadingGuide(false)
    }
  }

  function handleMarkCompleteClick() {
    const missing = computeMissingLocked(survey)
    if (missing.length > 0) {
      setMissingQs(missing)
      setShowWarning(true)
    } else {
      onMarkComplete()
    }
  }

  function handleAddMissing() {
    onAddMissingLockedQuestions()
    setShowWarning(false)
  }

  function handleProceedAnyway() {
    setShowWarning(false)
    onMarkComplete()
  }

  return (
    <div style={{ flex: '0 0 40%', minWidth: 0, position: 'sticky', top: '24px' }}>

      {/* Generate card */}
      <div style={{
        backgroundColor: '#0F2140', borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)', padding: '24px', marginBottom: '16px',
      }}>
        <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '0 0 8px' }}>
          Generate Survey with Copilot
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 6px' }}>
          Copilot will analyze your company profile, target segments, and decision makers to generate tailored DCP questions for each buying stage.
        </p>
        <p style={{ color: '#0EA5E9', fontSize: '13px', fontWeight: 600, margin: '0 0 20px' }}>
          Generating survey for: {AUDIENCES.find(a => a.id === selectedAudience)!.label}
        </p>

        {selectedAudience === 'current' && total === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={onLoadRecommended}
              style={{
                width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                backgroundColor: '#E8520A', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
              }}
            >
              <CheckCircle2 size={18} /> Load Recommended Questions
            </button>
            <button
              onClick={() => void onGenerate()}
              disabled={copilotStatus === 'generating' || !orgId}
              style={{
                width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                backgroundColor: copilotStatus === 'generating' ? 'rgba(255,255,255,0.08)' : '#1E3A5F',
                color: copilotStatus === 'generating' ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                cursor: copilotStatus === 'generating' ? 'not-allowed' : 'pointer',
                fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
              }}
            >
              {copilotStatus === 'generating'
                ? <><Loader2 size={18} className="animate-spin" /> Generating…</>
                : <><Wand2 size={18} /> Generate with Copilot</>
              }
            </button>
          </div>
        ) : (
          <button
            onClick={() => void onGenerate()}
            disabled={copilotStatus === 'generating' || !orgId}
            style={{
              width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              backgroundColor: copilotStatus === 'generating' ? 'rgba(232,82,10,0.55)' : '#E8520A',
              color: '#FFFFFF', border: 'none', borderRadius: '8px',
              cursor: copilotStatus === 'generating' ? 'not-allowed' : 'pointer',
              fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
            }}
          >
            {copilotStatus === 'generating'
              ? <><Loader2 size={18} className="animate-spin" /> Generating…</>
              : <><Wand2 size={18} /> Generate with Copilot</>
            }
          </button>
        )}

        {copilotStatus === 'done' && stageCounts && (
          <div style={{
            marginTop: '16px', backgroundColor: 'rgba(22,163,74,0.08)',
            borderRadius: '8px', padding: '14px 16px', border: '1px solid rgba(22,163,74,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>Survey Generated</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {STAGES.map(stage => (
                <div key={stage.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                    Stage {stage.id}: {stage.name}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#16A34A' }}>
                    {stageCounts[stage.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {copilotStatus === 'error' && copilotError && (
          <div style={{
            marginTop: '12px', backgroundColor: 'rgba(239,68,68,0.08)',
            borderRadius: '8px', padding: '10px 14px', border: '1px solid rgba(239,68,68,0.2)',
          }}>
            <p style={{ fontSize: '13px', color: '#EF4444', margin: 0 }}>{copilotError}</p>
          </div>
        )}
      </div>

      {/* Export card */}
      <div style={{
        backgroundColor: '#0F2140', borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)', padding: '24px', marginBottom: '16px',
      }}>
        <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
          {mode === 'interview' ? 'Export Interview Guide' : 'Export Survey'}
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: '0 0 16px' }}>
          {mode === 'interview'
            ? 'Download a scripted PDF guide with probing sub-questions for each interview.'
            : 'Copy for Google Forms or download as CSV.'
          }
        </p>
        {mode === 'interview' ? (
          <>
            {probes.size === 0 && (
              <div style={{
                marginBottom: '12px', padding: '10px 14px',
                backgroundColor: 'rgba(217,119,6,0.1)',
                border: '1px solid rgba(217,119,6,0.4)',
                borderRadius: '8px',
              }}>
                <p style={{ fontSize: '12px', color: '#D97706', margin: 0, lineHeight: '1.5' }}>
                  Please wait for interview probes to finish generating before downloading.
                </p>
              </div>
            )}
            <button
              onClick={() => void handleDownloadInterviewGuide()}
              disabled={downloadingGuide || total === 0 || probes.size === 0}
              style={{
                width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                backgroundColor: downloadingGuide || total === 0 || probes.size === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(14,165,233,0.12)',
                color: downloadingGuide || total === 0 || probes.size === 0 ? 'rgba(255,255,255,0.25)' : '#0EA5E9',
                border: `1px solid ${downloadingGuide || total === 0 || probes.size === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(14,165,233,0.3)'}`,
                borderRadius: '8px', cursor: downloadingGuide || total === 0 || probes.size === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 700,
              }}
            >
              {downloadingGuide
                ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
                : <><FileText size={15} /> Download Interview Guide</>
              }
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => void onCopy()}
              disabled={total === 0}
              style={{
                flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                backgroundColor: total === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
                color: total === 0 ? 'rgba(255,255,255,0.2)' : '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                cursor: total === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600,
              }}
            >
              {copyDone
                ? <><CheckCircle2 size={14} style={{ color: '#16A34A' }} /> Copied!</>
                : <><Copy size={14} /> Copy Questions</>
              }
            </button>
            <button
              onClick={onDownloadCSV}
              disabled={total === 0}
              style={{
                flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                backgroundColor: total === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
                color: total === 0 ? 'rgba(255,255,255,0.2)' : '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                cursor: total === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600,
              }}
            >
              <Download size={14} /> Download CSV
            </button>
          </div>
        )}
      </div>

      {/* Share Survey Link card — survey mode only */}
      {mode === 'survey' && (
        <div style={{
          backgroundColor: '#0F2140', borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)', padding: '24px', marginBottom: '16px',
        }}>
          <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
            Share Survey Link
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: '0 0 16px' }}>
            Generate a unique link to send to respondents. Responses collected automatically.
          </p>

          {linkStatus !== 'done' ? (
            <button
              onClick={() => void handleGenerateLink()}
              disabled={linkStatus === 'generating' || !orgId || !selectedSegment || total === 0}
              style={{
                width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                backgroundColor: linkStatus === 'generating' || !orgId || !selectedSegment || total === 0
                  ? 'rgba(14,165,233,0.2)'
                  : 'rgba(14,165,233,0.15)',
                color: linkStatus === 'generating' || !orgId || !selectedSegment || total === 0
                  ? 'rgba(14,165,233,0.4)'
                  : '#0EA5E9',
                border: `1px solid ${linkStatus === 'generating' || !orgId || !selectedSegment || total === 0 ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.3)'}`,
                borderRadius: '8px',
                cursor: linkStatus === 'generating' || !orgId || !selectedSegment || total === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 700,
              }}
            >
              {linkStatus === 'generating'
                ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
                : <><Link2 size={15} /> Generate Link</>
              }
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px',
                fontSize: '12px', color: '#0EA5E9', wordBreak: 'break-all', lineHeight: '1.5',
              }}>
                {surveyUrl}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => void handleCopyUrl()}
                  style={{
                    flex: 1, minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    backgroundColor: urlCopied ? 'rgba(22,163,74,0.12)' : 'rgba(14,165,233,0.12)',
                    color: urlCopied ? '#16A34A' : '#0EA5E9',
                    border: `1px solid ${urlCopied ? 'rgba(22,163,74,0.25)' : 'rgba(14,165,233,0.25)'}`,
                    borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  }}
                >
                  {urlCopied
                    ? <><CheckCircle2 size={13} /> Copied!</>
                    : <><Copy size={13} /> Copy Link</>
                  }
                </button>
                <button
                  onClick={() => void handleGenerateLink()}
                  style={{
                    flex: 1, minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  }}
                >
                  <Link2 size={13} /> New Link
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                  {responseCount} response{responseCount !== 1 ? 's' : ''} collected
                </span>
              </div>
            </div>
          )}

          {linkStatus === 'error' && (
            <p style={{ fontSize: '12px', color: '#EF4444', margin: '8px 0 0' }}>
              Failed to generate link. Please try again.
            </p>
          )}
        </div>
      )}

      {/* Mark Complete card */}
      <div style={{
        backgroundColor: '#0F2140', borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)', padding: '24px', marginBottom: '16px',
      }}>
        {isApproved ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} style={{ color: '#16A34A' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#16A34A' }}>
              Survey marked as complete
            </span>
          </div>
        ) : (
          <>
            <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
              Complete Survey
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: '0 0 16px' }}>
              Mark this survey as complete once all questions are ready to send.
            </p>
            <button
              onClick={handleMarkCompleteClick}
              disabled={markingComplete || total === 0}
              style={{
                width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                backgroundColor: markingComplete || total === 0 ? 'rgba(22,163,74,0.3)' : '#16A34A',
                color: '#FFFFFF', border: 'none', borderRadius: '8px',
                cursor: markingComplete || total === 0 ? 'not-allowed' : 'pointer',
                fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
              }}
            >
              {markingComplete
                ? <><Loader2 size={18} className="animate-spin" /> Saving…</>
                : <><CheckCircle2 size={18} /> Mark Survey as Complete</>
              }
            </button>
          </>
        )}
      </div>

      <TipsPanel tips={STEP_TIPS['survey-builder']} />

      {/* Missing questions warning modal */}
      {showWarning && (
        <div
          onClick={() => setShowWarning(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#0F2140', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.15)', padding: '28px',
              maxWidth: '480px', width: '100%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={20} style={{ color: '#EAB308', flexShrink: 0 }} />
              <h3 style={{ color: '#FFFFFF', fontSize: '17px', fontWeight: 700, margin: 0 }}>
                Missing Recommended Questions
              </h3>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Your survey is missing <strong style={{ color: '#EAB308' }}>{missingQs.length}</strong> question{missingQs.length !== 1 ? 's' : ''} that are critical for building an accurate DCP map:
            </p>

            <ul style={{ margin: '0 0 20px', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {missingQs.map((q, i) => (
                <li key={i} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.5' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: '4px' }}>Stage {q.stage}:</span>
                  {q.text}
                </li>
              ))}
            </ul>

            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 20px' }}>
              You can proceed, but your DCP map may have gaps.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleAddMissing}
                style={{
                  flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#E8520A', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 700,
                }}
              >
                Add Missing Questions
              </button>
              <button
                onClick={handleProceedAnyway}
                style={{
                  flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                }}
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
