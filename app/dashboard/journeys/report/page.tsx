'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StepDef {
  id: string
  title: string
  section: string
  phase: number
}

interface StepOutput {
  step_id: string
  version: number
  status: string
  content: Record<string, unknown>
}

interface OrgRow {
  name: string
  logo_url: string | null
}

// ─── Content extractors ──────────────────────────────────────────────────────

function extractText(content: Record<string, unknown>): string {
  return typeof content['text'] === 'string' ? content['text'] : ''
}

interface PainPointEntry {
  index: number
  content: string
}

function extractBlend(content: Record<string, unknown>): { mode: string; entries: PainPointEntry[]; blended: string } {
  const mode = typeof content['mode'] === 'string' ? content['mode'] : 'blended'
  const raw = content['per_pain_point']
  const entries: PainPointEntry[] = Array.isArray(raw)
    ? (raw as unknown[]).map((e) => {
        const obj = e as Record<string, unknown>
        return { index: Number(obj['index'] ?? 0), content: extractDraftText(obj['content']) }
      })
    : []
  const blended = extractDraftText(content['blended'])
  return { mode, entries, blended }
}

function extractActionPlan(content: Record<string, unknown>): { entries: PainPointEntry[]; summary: string } {
  const raw = content['by_pain_point']
  const entries: PainPointEntry[] = Array.isArray(raw)
    ? (raw as unknown[]).map((e) => {
        const obj = e as Record<string, unknown>
        return { index: Number(obj['index'] ?? 0), content: extractDraftText(obj['content']) }
      })
    : []
  const summary = extractDraftText(content['summary'])
  return { entries, summary }
}

function extractByPainPoint(
  output: StepOutput | undefined,
  painPoints: PainPointItem[]
): { label: string; text: string }[] {
  if (!output?.content) return []
  const c = output.content
  if (!Array.isArray(c['by_pain_point'])) return []
  return (c['by_pain_point'] as Array<Record<string, unknown>>)
    .filter((p) => typeof p['content'] === 'string' && (p['content'] as string).trim().length > 0)
    .map((p) => ({
      label: painPoints.find((pp) => pp.index === Number(p['index']))?.title ?? `Pain Point ${Number(p['index'])}`,
      text: extractDraftText(p['content']),
    }))
}

interface PainPointItem {
  index: number
  title: string
  description: string
}

interface KeyDecisionMakerRole {
  title: string
  influence: string
  concern: string
}

interface KeyDecisionMakerSegment {
  segment: string
  roles: KeyDecisionMakerRole[]
}

const SEGMENT_KEYS = ['segment_1', 'segment_2', 'segment_3'] as const

function extractStep2SegmentNames(output: StepOutput | undefined): string[] {
  if (!output?.content) return []
  const segs = output.content['segments']
  if (!Array.isArray(segs)) return []
  return (segs as Array<Record<string, unknown>>).map((s) => String(s['name'] ?? '').trim())
}

function extractKeyDecisionMakers(
  output: StepOutput | undefined,
  segmentNames: string[],
): KeyDecisionMakerSegment[] {
  if (!output?.content) return []
  const dms = output.content['decision_makers']
  if (!dms || typeof dms !== 'object' || Array.isArray(dms)) return []
  const dmMap = dms as Record<string, unknown>
  const results: KeyDecisionMakerSegment[] = []
  SEGMENT_KEYS.forEach((key, idx) => {
    const arr = dmMap[key]
    if (!Array.isArray(arr)) return
    const roles = (arr as Array<Record<string, unknown>>)
      .map((r) => {
        const concerns = Array.isArray(r['primary_concerns'])
          ? (r['primary_concerns'] as unknown[]).map((v) => String(v))
          : []
        return {
          title: String(r['specific_title'] ?? r['title'] ?? '').trim(),
          influence: String(r['influence'] ?? '').trim(),
          concern: concerns[0] ?? '',
        }
      })
      .filter((r) => r.title.length > 0)
    if (roles.length === 0) return
    const segmentName = (segmentNames[idx] ?? '').trim() || `Segment ${idx + 1}`
    results.push({ segment: segmentName, roles })
  })
  return results
}

// Competitive section extractor — normalizes each Step 17-26 content shape
// into a flat list of { label, text } entries the report can render.
const COMPETITIVE_SECTION_LABELS: Record<string, string> = {
  introduction: 'Introduction',
  evaluation: 'Evaluation Process',
  presentation: 'Presentation',
  proposal: 'Proposal',
  execution: 'Execution',
  length: 'Length of Evaluation',
  decision_criteria: 'Key Decision Criteria',
  keys_to_winning: 'Keys to Winning',
}

function extractCompetitiveContent(
  output: StepOutput | undefined,
  painPoints: PainPointItem[],
  segmentNames: string[],
): { label: string; text: string }[] {
  if (!output?.content) return []
  const c = output.content

  // CompetitorStepEditor (Step 17): { competitors: [{ name, keyPromise, vulnerability, ... }] }
  if (Array.isArray(c['competitors'])) {
    return (c['competitors'] as Array<Record<string, unknown>>)
      .filter((x) => typeof x['name'] === 'string' && (x['name'] as string).trim().length > 0)
      .map((x) => {
        const name = String(x['name']).trim()
        const promise = typeof x['keyPromise'] === 'string' ? (x['keyPromise'] as string).trim() : ''
        const vuln = typeof x['vulnerability'] === 'string' ? (x['vulnerability'] as string).trim() : ''
        const parts: string[] = []
        if (promise) parts.push(`Key promise: ${promise}`)
        if (vuln) parts.push(`Vulnerability: ${vuln}`)
        return { label: name, text: parts.join(' · ') }
      })
  }

  // DecisionProcessEditor (Step 23): { segments: { segment_1: { ranking, pattern } } }
  if (c['segments'] && typeof c['segments'] === 'object' && !Array.isArray(c['segments'])) {
    const segs = c['segments'] as Record<string, unknown>
    const results: { label: string; text: string }[] = []
    SEGMENT_KEYS.forEach((key, idx) => {
      const v = segs[key]
      if (!v || typeof v !== 'object') return
      const obj = v as Record<string, unknown>
      const pattern = typeof obj['pattern'] === 'string' ? obj['pattern'].trim() : ''
      const ranking = Array.isArray(obj['ranking'])
        ? (obj['ranking'] as unknown[]).map((r) => String(r)).filter((r) => r.length > 0)
        : []
      if (!pattern && ranking.length === 0) return
      const label = (segmentNames[idx] ?? '').trim() || `Segment ${idx + 1}`
      const parts: string[] = []
      if (ranking.length > 0) parts.push(`Ranking: ${ranking.join(' → ')}`)
      if (pattern) parts.push(pattern)
      results.push({ label, text: parts.join(' · ') })
    })
    return results
  }

  // CompetitiveEvaluationEditor (Step 22): { sections: { introduction, evaluation, ... } }
  if (c['sections'] && typeof c['sections'] === 'object' && !Array.isArray(c['sections'])) {
    const secs = c['sections'] as Record<string, unknown>
    return Object.entries(secs)
      .filter(([, v]) => typeof v === 'string' && (v as string).trim().length > 0)
      .map(([k, v]) => ({
        label: COMPETITIVE_SECTION_LABELS[k] ?? k,
        text: (v as string).trim(),
      }))
  }

  // AcidTestEditor matrix array
  if (Array.isArray(c['matrix'])) {
    return (c['matrix'] as Array<Record<string, unknown>>)
      .filter((row) => row && typeof row === 'object')
      .map((row, i) => {
        const label = String(row['competitor'] ?? row['name'] ?? row['label'] ?? `Row ${i + 1}`).trim()
        const text = typeof row['content'] === 'string'
          ? row['content'].trim()
          : typeof row['notes'] === 'string'
            ? (row['notes'] as string).trim()
            : extractReadableContent(row)
        return { label: label || `Row ${i + 1}`, text }
      })
      .filter((e) => e.label.length > 0 || e.text.length > 0)
  }

  // PainPointStepEditor (Steps 18, 19, 20, 21, 24, 25, 26): { by_pain_point: [...] }
  if (Array.isArray(c['by_pain_point'])) {
    return extractByPainPoint(output, painPoints)
  }

  // Fallback — flatten any string values
  const fallback = extractReadableContent(c)
  return fallback.length > 0 ? [{ label: '', text: fallback }] : []
}

function extractPainPoints(content: Record<string, unknown>): PainPointItem[] {
  const raw = content['pain_points']
  const activeCount = typeof content['active_count'] === 'number' ? content['active_count'] : undefined
  if (!Array.isArray(raw)) return []
  const items = (raw as unknown[]).map((e, i) => {
    const obj = typeof e === 'object' && e !== null ? (e as Record<string, unknown>) : {}
    const rawTitle = extractDraftText(obj['title'])
    return {
      index: typeof obj['index'] === 'number' ? obj['index'] : i + 1,
      title: rawTitle.startsWith('{') ? '' : rawTitle,
      description: extractDraftText(obj['description']),
    }
  })
  return activeCount !== undefined ? items.slice(0, activeCount) : items
}

function extractDraftText(raw: unknown): string {
  if (typeof raw === 'string') {
    const stripped = raw
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()
    try {
      const parsed = JSON.parse(stripped) as unknown
      if (parsed && typeof parsed === 'object' && 'draft' in parsed && typeof (parsed as Record<string, unknown>)['draft'] === 'string') {
        return ((parsed as Record<string, unknown>)['draft'] as string).trim()
      }
    } catch {
      // not JSON — use as plain text
    }
    if (stripped.startsWith('{')) {
      const match = stripped.match(/"draft"\s*:\s*"([^"]+)"/)
      if (match) return match[1].trim()
    }
    return stripped
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    if (typeof obj['draft'] === 'string') return obj['draft'].trim()
    return Object.values(obj)
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .join('\n')
  }
  return ''
}

function extractReadableContent(content: Record<string, unknown>): string {
  return Object.values(content)
    .map(v => extractDraftText(v))
    .filter(s => s.trim() !== '')
    .join('\n')
}

// ─── Render helpers ──────────────────────────────────────────────────────────

function NotCompleted({ stepId, title }: { stepId: string; title: string }) {
  return (
    <p style={{ color: '#9CA3AF', fontSize: '13px', fontStyle: 'italic', margin: '4px 0 0' }}>
      Not yet completed
      <span className="screen-only">
        {' — '}
        <Link
          href={`/dashboard/journeys/step/${stepId}`}
          style={{ color: '#0EA5E9', textDecoration: 'underline' }}
        >
          Go to {title}
        </Link>
      </span>
    </p>
  )
}

// ─── DOCX builder ────────────────────────────────────────────────────────────

type DocxLib = typeof import('docx')

function para(lib: DocxLib, text: string, heading?: boolean, indent?: boolean) {
  const { Paragraph, TextRun, HeadingLevel } = lib
  if (heading) {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { after: 200 } })
  }
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    indent: indent ? { left: 360 } : undefined,
    spacing: { after: 160 },
  })
}

function subheading(lib: DocxLib, text: string) {
  const { Paragraph, TextRun } = lib
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    spacing: { before: 240, after: 120 },
  })
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ReportPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<OrgRow | null>(null)
  const [stepDefs, setStepDefs] = useState<StepDef[]>([])
  const [outputs, setOutputs] = useState<Map<string, StepOutput>>(new Map())
  const [exporting, setExporting] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      const [
        { data: { user } },
      ] = await Promise.all([supabase.auth.getUser()])

      if (!user) { setError('Not authenticated'); setLoading(false); return }

      const [
        { data: userRow, error: uErr },
      ] = await Promise.all([
        supabase.from('users').select('org_id').eq('id', user.id).single(),
      ])

      if (uErr || !userRow) { setError('Failed to load user'); setLoading(false); return }
      const orgId: string = userRow.org_id

      const [
        { data: orgData },
        { data: defsData },
        { data: outputsData },
      ] = await Promise.all([
        supabase.from('organizations').select('name, logo_url').eq('id', orgId).single(),
        supabase.from('step_definition').select('id, title, section, phase').order('id'),
        supabase.from('step_output').select('step_id, version, status, content').eq('workspace_id', orgId),
      ])

      setOrg(orgData ?? { name: 'Your Company', logo_url: null })
      setStepDefs((defsData ?? []) as StepDef[])

      // Keep latest version per step
      const outMap = new Map<string, StepOutput>()
      for (const row of (outputsData ?? []) as StepOutput[]) {
        const existing = outMap.get(row.step_id)
        if (!existing || row.version > existing.version) outMap.set(row.step_id, row)
      }
      setOutputs(outMap)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const getStep = useCallback((id: string) => stepDefs.find(s => s.id === id), [stepDefs])
  const getOutput = useCallback((id: string) => outputs.get(id) ?? null, [outputs])

  function hasContent(id: string): boolean {
    const o = getOutput(id)
    if (!o) return false
    const c = o.content
    if (!c) return false
    // Step 3: { decision_makers: { segment_1: [...] } }
    if (c['decision_makers'] && typeof c['decision_makers'] === 'object' && !Array.isArray(c['decision_makers'])) {
      const dms = c['decision_makers'] as Record<string, unknown>
      const anyRole = Object.values(dms).some((arr) =>
        Array.isArray(arr) &&
        (arr as Array<Record<string, unknown>>).some(
          (r) => typeof r['specific_title'] === 'string' && (r['specific_title'] as string).trim().length > 0
        )
      )
      if (anyRole) return true
    }
    // Step 2: { segments: [{ name, ... }] } (array)
    if (Array.isArray(c['segments'])) {
      if ((c['segments'] as Array<Record<string, unknown>>).some(
        (s) => typeof s['name'] === 'string' && (s['name'] as string).trim().length > 0
      )) return true
    }
    // Step 23 DecisionProcessEditor: { segments: { segment_1: { pattern, ranking } } } (object)
    if (c['segments'] && typeof c['segments'] === 'object' && !Array.isArray(c['segments'])) {
      const segs = c['segments'] as Record<string, unknown>
      const anyPattern = Object.values(segs).some((v) => {
        if (!v || typeof v !== 'object') return false
        const obj = v as Record<string, unknown>
        const pattern = typeof obj['pattern'] === 'string' ? obj['pattern'] : ''
        return pattern.trim().length > 0
      })
      if (anyPattern) return true
    }
    // Step 17 CompetitorStepEditor: { competitors: [{ name, ... }] }
    if (Array.isArray(c['competitors'])) {
      if ((c['competitors'] as Array<Record<string, unknown>>).some(
        (x) => typeof x['name'] === 'string' && (x['name'] as string).trim().length > 0
      )) return true
    }
    // Step 22 CompetitiveEvaluationEditor: { sections: { introduction, ... } }
    if (c['sections'] && typeof c['sections'] === 'object' && !Array.isArray(c['sections'])) {
      const secs = c['sections'] as Record<string, unknown>
      if (Object.values(secs).some((v) => typeof v === 'string' && (v as string).trim().length > 0)) return true
    }
    // AcidTestEditor matrix array
    if (Array.isArray(c['matrix'])) {
      if ((c['matrix'] as Array<Record<string, unknown>>).length > 0) return true
    }
    if (Array.isArray(c['by_pain_point'])) {
      if ((c['by_pain_point'] as Array<Record<string, unknown>>).some(
        (p) => typeof p['content'] === 'string' && (p['content'] as string).trim().length > 0
      )) return true
    }
    if (typeof c['blended'] === 'string' && c['blended'].trim().length > 0) return true
    if (typeof c['summary'] === 'string' && c['summary'].trim().length > 0) return true
    if (Array.isArray(c['per_pain_point'])) {
      if ((c['per_pain_point'] as Array<Record<string, unknown>>).some(
        (p) => typeof p['content'] === 'string' && (p['content'] as string).trim().length > 0
      )) return true
    }
    if (Array.isArray(c['pain_points'])) {
      if ((c['pain_points'] as Array<Record<string, unknown>>).some(
        (p) => typeof p['title'] === 'string' && (p['title'] as string).trim().length > 0
      )) return true
    }
    if (typeof c['text'] === 'string' && c['text'].trim().length > 0) return true
    return Object.values(c).some((v) => typeof v === 'string' && v.trim().length > 0)
  }

  // ─── PDF export ────────────────────────────────────────────────────────────

  async function handlePdf() {
    if (!reportRef.current) return
    setGeneratingPdf(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      const companySlug = (org?.name ?? 'strategic-plan').replace(/\s+/g, '-')
      await html2pdf()
        .set({
          margin: [15, 15, 15, 15] as [number, number, number, number],
          filename: `C3-Strategic-Plan-${companySlug}.pdf`,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            onclone: (doc: Document) => {
              doc.querySelectorAll('.screen-only').forEach(el => {
                (el as HTMLElement).style.display = 'none'
              })
              doc.querySelectorAll('[data-empty="true"]').forEach(el => {
                (el as HTMLElement).style.display = 'none'
              })
            },
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        })
        .from(reportRef.current)
        .save()
    } catch (e) {
      console.error('PDF export failed:', e)
    } finally {
      setGeneratingPdf(false)
    }
  }

  // ─── DOCX export ───────────────────────────────────────────────────────────

  async function handleDocx() {
    setExporting(true)
    try {
      const lib = await import('docx')
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = lib

      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const step4PainPoints = (() => { const o = getOutput('4'); return o ? extractPainPoints(o.content) : [] })()
      const step2SegmentNames = extractStep2SegmentNames(getOutput('2') ?? undefined)
      type SectionOptions = NonNullable<ConstructorParameters<typeof Document>[0]['sections']>[number]
      const sections: SectionOptions[] = []

      const children: InstanceType<typeof Paragraph>[] = []

      // Cover
      children.push(new Paragraph({ text: org?.name ?? 'Your Company', heading: HeadingLevel.TITLE, spacing: { after: 200 } }))
      children.push(new Paragraph({ children: [new TextRun({ text: 'C3 Method Strategic Plan', bold: true, size: 36 })], spacing: { after: 200 } }))
      children.push(new Paragraph({ children: [new TextRun({ text: today, size: 24, color: '6B7280' })], spacing: { after: 600 } }))

      // Helper to push blank line
      const blank = () => children.push(new Paragraph({ text: '' }))

      // Section 1 — Company Foundation
      children.push(new Paragraph({ text: '1. Company Foundation', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))

      // 1a Step 1
      {
        const o = getOutput('1'); const s = getStep('1')
        children.push(subheading(lib, `1a. ${s?.title ?? 'Product / Service Profile'}`))
        if (o && hasContent('1')) children.push(para(lib, extractReadableContent(o.content)))
        else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      }

      // 1b Step 3
      {
        const o = getOutput('3'); const s = getStep('3')
        children.push(subheading(lib, `1b. ${s?.title ?? 'Key Decision Makers'}`))
        if (o && hasContent('3')) {
          const segs = extractKeyDecisionMakers(o, step2SegmentNames)
          if (segs.length === 0) {
            children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
          } else {
            segs.forEach(seg => {
              children.push(new Paragraph({
                children: [new TextRun({ text: seg.segment, bold: true, size: 22, color: '0EA5E9' })],
                spacing: { before: 160, after: 80 },
              }))
              seg.roles.forEach(r => {
                const parts = [r.title]
                if (r.influence) parts.push(`${r.influence.charAt(0).toUpperCase() + r.influence.slice(1)} influence`)
                if (r.concern) parts.push(r.concern)
                children.push(para(lib, parts.join(' — '), false, true))
              })
            })
          }
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      }

      // 1c Step 11 — Compelling Value Propositions
      {
        const o = getOutput('11')
        children.push(subheading(lib, '1c. Compelling Value Propositions'))
        if (o && hasContent('11')) {
          const entries = extractByPainPoint(o, step4PainPoints)
          if (entries.length === 0) {
            children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
          } else {
            entries.forEach(e =>
              children.push(para(lib, `• ${e.label} — ${e.text}`, false, true))
            )
          }
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      }

      // 1d Step 15 KSPs
      {
        const o = getOutput('15'); const s = getStep('15')
        children.push(subheading(lib, `1d. ${s?.title ?? 'Key Selling Points'}`))
        if (o && hasContent('15')) {
          extractByPainPoint(o, step4PainPoints).forEach(e =>
            children.push(para(lib, `• ${e.label} — ${e.text}`, false, true))
          )
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      }

      // Section 2 — Competitive Environment
      children.push(new Paragraph({ text: '2. Competitive Environment', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      ;(['17', '18', '19', '20', '21', '22', '23', '24', '25', '26'] as const).forEach((sid, i) => {
        const o = getOutput(sid); const s = getStep(sid)
        const label = `2${String.fromCharCode(97 + i)}`
        children.push(subheading(lib, `${label}. ${s?.title ?? `Step ${sid}`}`))
        if (o && hasContent(sid)) {
          const entries = extractCompetitiveContent(o, step4PainPoints, step2SegmentNames)
          if (entries.length === 0) {
            children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
          } else {
            entries.forEach(e => {
              const line = e.label && e.text
                ? `• ${e.label} — ${e.text}`
                : e.label
                  ? `• ${e.label}`
                  : `• ${e.text}`
              children.push(para(lib, line, false, true))
            })
          }
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      })

      // Section 3 — Strategic Messages
      children.push(new Paragraph({ text: '3. Strategic Messages', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      ;(['27', '28', '29', '30'] as const).forEach((sid) => {
        const o = getOutput(sid); const s = getStep(sid)
        children.push(subheading(lib, s?.title ?? `Step ${sid}`))
        if (o && hasContent(sid)) {
          const b = extractBlend(o.content)
          if (b.mode === 'blended' && b.blended) {
            children.push(para(lib, b.blended))
          } else {
            b.entries
              .filter(e => e.content.trim().length > 0)
              .forEach(e => {
                const pp = step4PainPoints.find(p => p.index === e.index)
                const label = pp?.title || `Pain Point ${e.index}`
                children.push(para(lib, `• ${label} — ${e.content}`, false, true))
              })
          }
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      })

      // Section 4 — Strategic Plan (summary-only)
      children.push(new Paragraph({ text: '4. Strategic Plan', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      ;(['31', '32', '33', '34', '35', '36', '37'] as const).forEach((sid) => {
        const o = getOutput(sid); const s = getStep(sid)
        children.push(subheading(lib, s?.title ?? `Step ${sid}`))
        if (o && hasContent(sid)) {
          const ap = extractActionPlan(o.content)
          if (ap.summary.trim().length > 0) {
            children.push(para(lib, ap.summary))
          } else {
            children.push(new Paragraph({ children: [new TextRun({ text: 'Summary not yet written', italics: true, color: '9CA3AF' })] }))
          }
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      })

      // Section 5 — Development & Partnership
      children.push(new Paragraph({ text: '5. Development & Partnership', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      {
        const o = getOutput('26'); const s = getStep('26')
        children.push(subheading(lib, s?.title ?? 'Step 26'))
        if (o && hasContent('26')) {
          extractByPainPoint(o, step4PainPoints).forEach(e =>
            children.push(para(lib, `• ${e.label} — ${e.text}`, false, true))
          )
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
      }

      sections.push({ children })

      const doc = new Document({
        creator: 'Assembly AI',
        title: `${org?.name ?? 'Your Company'} — C3 Method Strategic Plan`,
        description: 'Generated by Assembly AI',
        sections,
        styles: {
          paragraphStyles: [
            {
              id: 'Normal',
              name: 'Normal',
              run: { font: 'Calibri', size: 22 },
            },
          ],
        },
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(org?.name ?? 'strategic-plan').replace(/\s+/g, '-')}-c3-report.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('DOCX export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #0EA5E9', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#FCA5A5' }}>{error}</p>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Step helpers for the HTML report
  function StepContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const text = extractReadableContent(o.content)
    if (text) return <p style={bodyStyle}>{text}</p>
    return null
  }

  const step4PainPoints = (() => {
    const o = getOutput('4')
    return o ? extractPainPoints(o.content) : []
  })()

  const step2SegmentNames = extractStep2SegmentNames(getOutput('2') ?? undefined)

  function KeyDecisionMakersContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const segments = extractKeyDecisionMakers(o, step2SegmentNames)
    if (segments.length === 0) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    return (
      <div style={{ marginTop: '4px' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0EA5E9', margin: '0 0 4px' }}>
              {seg.segment}
            </p>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              {seg.roles.map((r, j) => {
                const parts: string[] = []
                if (r.influence) parts.push(`${r.influence.charAt(0).toUpperCase() + r.influence.slice(1)} influence`)
                if (r.concern) parts.push(r.concern)
                return (
                  <li key={j} style={bodyStyle}>
                    {r.title}{parts.length ? ` — ${parts.join(' — ')}` : ''}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  function ByPainPointContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const entries = extractByPainPoint(o, step4PainPoints)
    if (entries.length === 0) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    return (
      <ul style={{ paddingLeft: '20px', margin: '4px 0 0' }}>
        {entries.map((e, i) => (
          <li key={i} style={bodyStyle}>
            <strong>{e.label}</strong>{e.text ? ` — ${e.text}` : ''}
          </li>
        ))}
      </ul>
    )
  }

  function CompetitiveContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const entries = extractCompetitiveContent(o, step4PainPoints, step2SegmentNames)
    if (entries.length === 0) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    return (
      <ul style={{ paddingLeft: '20px', margin: '4px 0 0' }}>
        {entries.map((e, i) => (
          <li key={i} style={bodyStyle}>
            {e.label && <strong>{e.label}</strong>}
            {e.label && e.text ? ' — ' : ''}
            {e.text}
          </li>
        ))}
      </ul>
    )
  }

  function StrategicMessageContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const b = extractBlend(o.content)
    if (b.mode === 'blended' && b.blended) return <p style={bodyStyle}>{b.blended}</p>
    const nonEmpty = b.entries.filter(e => e.content.trim().length > 0)
    if (nonEmpty.length > 0) return (
      <ul style={{ paddingLeft: '20px', margin: '4px 0 0' }}>
        {nonEmpty.map(e => {
          const pp = step4PainPoints.find(p => p.index === e.index)
          const label = pp?.title || `Pain Point ${e.index}`
          return (
            <li key={e.index} style={bodyStyle}>
              <strong>{label}</strong> — {e.content}
            </li>
          )
        })}
      </ul>
    )
    const fallback = extractReadableContent(o.content)
    if (fallback) return <p style={bodyStyle}>{fallback}</p>
    return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
  }

  function ActionPlanSummary({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const ap = extractActionPlan(o.content)
    if (ap.summary.trim().length > 0) return <p style={bodyStyle}>{ap.summary}</p>
    return (
      <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#9CA3AF' }}>Summary not yet written</p>
    )
  }

  // Section emptiness — used to set data-empty for PDF onclone hiding
  const COMP_STEP_IDS = ['17','18','19','20','21','22','23','24','25','26'] as const
  const sec2Empty = COMP_STEP_IDS.every(id => !hasContent(id))
  const sec3Empty = !hasContent('27') && !hasContent('28') && !hasContent('29') && !hasContent('30')
  const sec4Empty = ['31','32','33','34','35','36','37'].every(id => !hasContent(id))
  const sec5Empty = !hasContent('26')

  const sectionHeadStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: '#0A1628',
    margin: '0 0 20px',
    paddingBottom: '10px',
    borderBottom: '2px solid #0A1628',
  }

  const subheadStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0A1628',
    margin: '20px 0 4px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }

  const bodyStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#1F2937',
    lineHeight: '1.6',
    margin: '4px 0 0',
    whiteSpace: 'pre-wrap',
  }

  const dividerStyle: React.CSSProperties = {
    borderTop: '1px solid #E5E7EB',
    margin: '24px 0',
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .report-doc {
            box-shadow: none !important;
            margin: 0 !important;
            max-width: 100% !important;
            padding: 40px !important;
          }
          .report-cover {
            page-break-after: always;
          }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', paddingBottom: '80px' }}>

        {/* Fixed header bar */}
        <div
          className="no-print"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: '#0A1628',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '12px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/dashboard/journeys"
            style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none', minHeight: '44px', display: 'flex', alignItems: 'center' }}
          >
            ← Back to Journeys
          </Link>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => { void handlePdf() }}
              disabled={generatingPdf}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                backgroundColor: generatingPdf ? 'rgba(232,82,10,0.5)' : '#E8520A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: generatingPdf ? 'not-allowed' : 'pointer',
              }}
            >
              {generatingPdf ? 'Generating PDF…' : 'Download PDF'}
            </button>
            <button
              onClick={() => { void handleDocx() }}
              disabled={exporting}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                backgroundColor: exporting ? 'rgba(255,255,255,0.1)' : '#0EA5E9',
                color: exporting ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: exporting ? 'not-allowed' : 'pointer',
              }}
            >
              {exporting ? 'Generating…' : 'Download Word'}
            </button>
          </div>
        </div>

        {/* Document preview — top padding accounts for fixed header */}
        <div style={{ padding: '80px 32px 40px', display: 'flex', justifyContent: 'center' }}>
          <div
            ref={reportRef}
            className="report-doc"
            style={{
              backgroundColor: '#FFFFFF',
              maxWidth: '900px',
              width: '100%',
              borderRadius: '8px',
              boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
              overflow: 'hidden',
            }}
          >

            {/* Cover */}
            <div
              className="report-cover"
              style={{
                backgroundColor: '#0A1628',
                padding: '60px 48px',
                minHeight: '280px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                {org?.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logo_url} alt="Company logo" style={{ maxHeight: '48px', marginBottom: '24px', objectFit: 'contain' }} />
                )}
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  C3 Method Strategic Plan
                </div>
                <h1 style={{ color: '#FFFFFF', fontSize: '36px', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                  {org?.name ?? 'Your Company'}
                </h1>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '40px' }}>
                Generated {today} · Assembly AI
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '48px 48px 20px' }}>

              {/* ── Section 1: Company Foundation ── */}
              <h2 style={sectionHeadStyle}>1. Company Foundation</h2>

              <p style={subheadStyle}>1a. {getStep('1')?.title ?? 'Product / Service Profile'}</p>
              <StepContent id="1" />

              <div style={dividerStyle} />

              <p style={subheadStyle}>1b. {getStep('3')?.title ?? 'Key Decision Makers'}</p>
              <KeyDecisionMakersContent id="3" />

              <div style={dividerStyle} />

              <p style={subheadStyle}>1c. Compelling Value Propositions</p>
              <ByPainPointContent id="11" />

              <div style={dividerStyle} />

              <p style={subheadStyle}>1d. {getStep('15')?.title ?? 'Key Selling Points'}</p>
              <ByPainPointContent id="15" />

              {/* ── Section 2: Competitive Environment ── */}
              <div data-empty={sec2Empty ? 'true' : undefined}>
                <div style={{ ...dividerStyle, margin: '40px 0' }} />
                <h2 style={sectionHeadStyle}>2. Competitive Environment</h2>
                {COMP_STEP_IDS.map((sid, i) => (
                  <div key={sid}>
                    <p style={subheadStyle}>{`2${String.fromCharCode(97 + i)}`}. {getStep(sid)?.title ?? `Step ${sid}`}</p>
                    <CompetitiveContent id={sid} />
                    {i < COMP_STEP_IDS.length - 1 && <div style={dividerStyle} />}
                  </div>
                ))}
              </div>

              {/* ── Section 3: Strategic Messages ── */}
              <div data-empty={sec3Empty ? 'true' : undefined}>
                <div style={{ ...dividerStyle, margin: '40px 0' }} />
                <h2 style={sectionHeadStyle}>3. Strategic Messages</h2>
                {(['27', '28', '29', '30'] as const).map((sid, i) => (
                  <div key={sid}>
                    <p style={subheadStyle}>{getStep(sid)?.title ?? `Step ${sid}`}</p>
                    <StrategicMessageContent id={sid} />
                    {i < 3 && <div style={dividerStyle} />}
                  </div>
                ))}
              </div>

              {/* ── Section 4: Strategic Plan ── */}
              <div data-empty={sec4Empty ? 'true' : undefined}>
                <div style={{ ...dividerStyle, margin: '40px 0' }} />
                <h2 style={sectionHeadStyle}>4. Strategic Plan</h2>
                {(['31', '32', '33', '34', '35', '36', '37'] as const).map((sid, i) => (
                  <div key={sid}>
                    <p style={subheadStyle}>{getStep(sid)?.title ?? `Step ${sid}`}</p>
                    <ActionPlanSummary id={sid} />
                    {i < 6 && <div style={dividerStyle} />}
                  </div>
                ))}
              </div>

              {/* ── Section 5: Development & Partnership ── */}
              <div data-empty={sec5Empty ? 'true' : undefined} style={{ pageBreakInside: 'avoid' }}>
                <div style={{ ...dividerStyle, margin: '40px 0' }} />
                <h2 style={sectionHeadStyle}>5. Development &amp; Partnership</h2>
                <p style={subheadStyle}>{getStep('26')?.title ?? 'Step 26'}</p>
                <ByPainPointContent id="26" />
              </div>

              {/* Footer */}
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Generated {today}</span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Assembly AI · C3 Method</span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
