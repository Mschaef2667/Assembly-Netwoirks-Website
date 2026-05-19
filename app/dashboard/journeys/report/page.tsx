'use client'

import { useState, useEffect, useCallback } from 'react'
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

interface IcpRow {
  id: string
  name: string
  segment_name: string | null
  job_titles: string[] | null
  industry_verticals: string[] | null
  company_size_range: string | null
  decision_making_power: string | null
  primary_pain_points: string[] | null
  buying_triggers: string[] | null
  success_metrics: string[] | null
  objections: string[] | null
  buyer_type: string | null
}

interface OfferRow {
  id: string
  icp_id: string
  name: string
  description: string | null
  key_features: string[] | null
  pricing_model: string | null
  primary_cta: string | null
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

interface PainPointItem {
  index: number
  title: string
  description: string
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
      Not yet completed —{' '}
      <Link
        href={`/dashboard/journeys/step/${stepId}`}
        style={{ color: '#0EA5E9', textDecoration: 'underline' }}
      >
        Go to {title}
      </Link>
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
  const [icps, setIcps] = useState<IcpRow[]>([])
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [exporting, setExporting] = useState(false)

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
        { data: icpData },
        { data: offerData },
      ] = await Promise.all([
        supabase.from('organizations').select('name, logo_url').eq('id', orgId).single(),
        supabase.from('step_definition').select('id, title, section, phase').order('id'),
        supabase.from('step_output').select('step_id, version, status, content').eq('workspace_id', orgId),
        supabase.from('icp_definition').select('*').eq('org_id', orgId),
        supabase.from('offer_definition').select('*').eq('org_id', orgId),
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

      setIcps((icpData ?? []) as IcpRow[])
      setOffers((offerData ?? []) as OfferRow[])
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
    if (extractReadableContent(c).length > 0) return true
    if (Array.isArray(c['pain_points']) && (c['pain_points'] as unknown[]).length > 0) return true
    if (Array.isArray(c['per_pain_point']) && (c['per_pain_point'] as unknown[]).length > 0) return true
    if (Array.isArray(c['by_pain_point']) && (c['by_pain_point'] as unknown[]).length > 0) return true
    return false
  }

  // ─── PDF export ────────────────────────────────────────────────────────────

  function handlePrint() {
    window.print()
  }

  // ─── DOCX export ───────────────────────────────────────────────────────────

  async function handleDocx() {
    setExporting(true)
    try {
      const lib = await import('docx')
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = lib

      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
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
        children.push(subheading(lib, `1b. ${s?.title ?? 'Target Market Segments'}`))
        if (o && hasContent('3')) children.push(para(lib, extractReadableContent(o.content)))
        else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      }

      // 1c Step 4 — Pain Points
      {
        const o = getOutput('4'); const s = getStep('4')
        children.push(subheading(lib, `1c. ${s?.title ?? 'Pain Points'}`))
        if (o && hasContent('4')) {
          const pts = extractPainPoints(o.content)
          if (pts.length > 0) {
            pts.forEach((p, i) => {
              const label = p.title || `Pain Point ${i + 1}`
              const text = p.description ? `${label} — ${p.description}` : label
              children.push(para(lib, `${i + 1}. ${text}`, false, true))
            })
          } else {
            children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
          }
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      }

      // 1d ICPs
      children.push(subheading(lib, '1d. Ideal Customer Profiles'))
      if (icps.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'No ICPs defined yet', italics: true, color: '9CA3AF' })] }))
      } else {
        icps.forEach(icp => {
          children.push(new Paragraph({ children: [new TextRun({ text: icp.name, bold: true, size: 24 })], spacing: { before: 200, after: 80 } }))
          if (icp.company_size_range) children.push(para(lib, `Company size: ${icp.company_size_range}`, false, true))
          if (icp.industry_verticals?.length) children.push(para(lib, `Industries: ${icp.industry_verticals.join(', ')}`, false, true))
          if (icp.job_titles?.length) children.push(para(lib, `Job titles: ${icp.job_titles.join(', ')}`, false, true))
          if (icp.primary_pain_points?.length) {
            children.push(para(lib, 'Pain points:', false, true))
            icp.primary_pain_points.forEach(p => children.push(para(lib, `• ${p}`, false, true)))
          }
        })
      }
      blank()

      // 1e Offers
      children.push(subheading(lib, '1e. Offers'))
      if (offers.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'No offers defined yet', italics: true, color: '9CA3AF' })] }))
      } else {
        offers.forEach(offer => {
          children.push(new Paragraph({ children: [new TextRun({ text: offer.name, bold: true, size: 24 })], spacing: { before: 200, after: 80 } }))
          if (offer.description) children.push(para(lib, offer.description, false, true))
          if (offer.key_features?.length) children.push(para(lib, `Key features: ${offer.key_features.join(', ')}`, false, true))
          if (offer.pricing_model) children.push(para(lib, `Pricing: ${offer.pricing_model}`, false, true))
        })
      }
      blank()

      // 1f Step 11 CVPs
      {
        const o = getOutput('11'); const s = getStep('11')
        children.push(subheading(lib, `1f. ${s?.title ?? 'Core Value Propositions'}`))
        if (o && hasContent('11')) {
          const b = extractBlend(o.content)
          if (b.mode === 'blended' && b.blended) children.push(para(lib, b.blended))
          else b.entries.forEach(e => children.push(para(lib, `• ${e.content}`, false, true)))
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      }

      // 1g Step 15 KSPs
      {
        const o = getOutput('15'); const s = getStep('15')
        children.push(subheading(lib, `1g. ${s?.title ?? 'Key Selling Points'}`))
        if (o && hasContent('15')) {
          const b = extractBlend(o.content)
          if (b.mode === 'blended' && b.blended) children.push(para(lib, b.blended))
          else b.entries.forEach(e => children.push(para(lib, `• ${e.content}`, false, true)))
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      }

      // Section 2 — Competitive Environment
      children.push(new Paragraph({ text: '2. Competitive Environment', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      ;(['17', '19', '20'] as const).forEach((sid, i) => {
        const o = getOutput(sid); const s = getStep(sid)
        const label = ['2a', '2b', '2c'][i]
        children.push(subheading(lib, `${label}. ${s?.title ?? `Step ${sid}`}`))
        if (o && hasContent(sid)) {
          const b = extractBlend(o.content)
          if (b.mode === 'blended' && b.blended) children.push(para(lib, b.blended))
          else if (b.entries.length) b.entries.forEach(e => children.push(para(lib, `• ${e.content}`, false, true)))
          else {
            const fallback = extractReadableContent(o.content)
            children.push(para(lib, fallback || ''))
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
          if (b.mode === 'blended' && b.blended) children.push(para(lib, b.blended))
          else b.entries.forEach(e => children.push(para(lib, `• ${e.content}`, false, true)))
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      })

      // Section 4 — Strategic Plan
      children.push(new Paragraph({ text: '4. Strategic Plan', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      ;(['31', '32', '33', '34', '35', '36', '37'] as const).forEach((sid) => {
        const o = getOutput(sid); const s = getStep(sid)
        children.push(subheading(lib, s?.title ?? `Step ${sid}`))
        if (o && hasContent(sid)) {
          const ap = extractActionPlan(o.content)
          if (ap.summary || ap.entries.length > 0) {
            if (ap.summary) children.push(para(lib, ap.summary))
            ap.entries.forEach(e => children.push(para(lib, `• ${e.content}`, false, true)))
          } else {
            const fallback = extractReadableContent(o.content)
            children.push(para(lib, fallback || ''))
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
          const b = extractBlend(o.content)
          if (b.mode === 'blended' && b.blended) children.push(para(lib, b.blended))
          else if (b.entries.length) b.entries.forEach(e => children.push(para(lib, `• ${e.content}`, false, true)))
          else {
            const fallback = extractReadableContent(o.content)
            children.push(para(lib, fallback || ''))
          }
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

  function BlendContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const b = extractBlend(o.content)
    if (b.mode === 'blended' && b.blended) return <p style={bodyStyle}>{b.blended}</p>
    if (b.entries.length) return (
      <ul style={{ paddingLeft: '20px', margin: '4px 0 0' }}>
        {b.entries.map(e => <li key={e.index} style={bodyStyle}>{e.content}</li>)}
      </ul>
    )
    const fallback = extractReadableContent(o.content)
    if (fallback) return <p style={bodyStyle}>{fallback}</p>
    return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
  }

  function ActionPlanContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const ap = extractActionPlan(o.content)
    if (ap.summary || ap.entries.length > 0) {
      return (
        <>
          {ap.summary && <p style={bodyStyle}>{ap.summary}</p>}
          {ap.entries.length > 0 && (
            <ul style={{ paddingLeft: '20px', margin: '4px 0 0' }}>
              {ap.entries.map(e => <li key={e.index} style={bodyStyle}>{e.content}</li>)}
            </ul>
          )}
        </>
      )
    }
    const fallback = extractReadableContent(o.content)
    if (fallback) return <p style={bodyStyle}>{fallback}</p>
    return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
  }

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

        {/* Sticky header bar */}
        <div
          className="no-print"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backgroundColor: '#0A1628',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '12px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link
              href="/dashboard/journeys"
              style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}
            >
              ← Journeys
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>|</span>
            <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600 }}>C3 Method Strategic Plan</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                backgroundColor: '#E8520A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Download PDF
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

        {/* Document preview */}
        <div style={{ padding: '40px 32px', display: 'flex', justifyContent: 'center' }}>
          <div
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
            <div style={{ padding: '48px' }}>

              {/* ── Section 1: Company Foundation ── */}
              <h2 style={sectionHeadStyle}>1. Company Foundation</h2>

              <p style={subheadStyle}>1a. {getStep('1')?.title ?? 'Product / Service Profile'}</p>
              <StepContent id="1" />

              <div style={dividerStyle} />

              <p style={subheadStyle}>1b. {getStep('3')?.title ?? 'Target Market Segments'}</p>
              <StepContent id="3" />

              <div style={dividerStyle} />

              <p style={subheadStyle}>1c. {getStep('4')?.title ?? 'Pain Points'}</p>
              {(() => {
                const o = getOutput('4')
                const s = getStep('4')
                if (!o || !hasContent('4')) return <NotCompleted stepId="4" title={s?.title ?? 'Step 4'} />
                const pts = extractPainPoints(o.content)
                if (pts.length === 0) return <NotCompleted stepId="4" title={s?.title ?? 'Step 4'} />
                return (
                  <ol style={{ paddingLeft: '20px', margin: '4px 0 0' }}>
                    {pts.map((p, i) => (
                      <li key={p.index} style={bodyStyle}>
                        <strong>{p.title || `Pain Point ${i + 1}`}</strong>
                        {p.description ? ` — ${p.description}` : ''}
                      </li>
                    ))}
                  </ol>
                )
              })()}

              <div style={dividerStyle} />

              <p style={subheadStyle}>1d. Ideal Customer Profiles</p>
              {icps.length === 0
                ? <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#9CA3AF' }}>No ICPs defined yet — <Link href="/dashboard/target-markets" style={{ color: '#0EA5E9' }}>Define ICPs</Link></p>
                : icps.map(icp => (
                  <div key={icp.id} style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#0A1628', margin: '0 0 6px' }}>{icp.name}</p>
                    {icp.segment_name && <p style={bodyStyle}>Segment: {icp.segment_name}</p>}
                    {icp.company_size_range && <p style={bodyStyle}>Company size: {icp.company_size_range}</p>}
                    {icp.industry_verticals?.length ? <p style={bodyStyle}>Industries: {icp.industry_verticals.join(', ')}</p> : null}
                    {icp.job_titles?.length ? <p style={bodyStyle}>Job titles: {icp.job_titles.join(', ')}</p> : null}
                    {icp.primary_pain_points?.length ? (
                      <>
                        <p style={{ ...bodyStyle, fontWeight: 600, marginTop: '8px' }}>Pain points:</p>
                        <ul style={{ paddingLeft: '18px', margin: '2px 0 0' }}>
                          {icp.primary_pain_points.map((p, i) => <li key={i} style={bodyStyle}>{p}</li>)}
                        </ul>
                      </>
                    ) : null}
                  </div>
                ))
              }

              <div style={dividerStyle} />

              <p style={subheadStyle}>1e. Offers</p>
              {offers.length === 0
                ? <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#9CA3AF' }}>No offers defined yet — <Link href="/dashboard/target-markets" style={{ color: '#0EA5E9' }}>Define Offers</Link></p>
                : offers.map(offer => (
                  <div key={offer.id} style={{ marginBottom: '12px', padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#0A1628', margin: '0 0 4px' }}>{offer.name}</p>
                    {offer.description && <p style={bodyStyle}>{offer.description}</p>}
                    {offer.key_features?.length ? <p style={bodyStyle}>Features: {offer.key_features.join(', ')}</p> : null}
                    {offer.pricing_model && <p style={bodyStyle}>Pricing: {offer.pricing_model}</p>}
                  </div>
                ))
              }

              <div style={dividerStyle} />

              <p style={subheadStyle}>1f. {getStep('11')?.title ?? 'Core Value Propositions'}</p>
              <BlendContent id="11" />

              <div style={dividerStyle} />

              <p style={subheadStyle}>1g. {getStep('15')?.title ?? 'Key Selling Points'}</p>
              <BlendContent id="15" />

              {/* ── Section 2: Competitive Environment ── */}
              <div style={{ ...dividerStyle, margin: '40px 0' }} />
              <h2 style={sectionHeadStyle}>2. Competitive Environment</h2>

              {(['17', '19', '20'] as const).map((sid, i) => (
                <div key={sid}>
                  <p style={subheadStyle}>{['2a', '2b', '2c'][i]}. {getStep(sid)?.title ?? `Step ${sid}`}</p>
                  <BlendContent id={sid} />
                  {i < 2 && <div style={dividerStyle} />}
                </div>
              ))}

              {/* ── Section 3: Strategic Messages ── */}
              <div style={{ ...dividerStyle, margin: '40px 0' }} />
              <h2 style={sectionHeadStyle}>3. Strategic Messages</h2>

              {(['27', '28', '29', '30'] as const).map((sid, i) => (
                <div key={sid}>
                  <p style={subheadStyle}>{getStep(sid)?.title ?? `Step ${sid}`}</p>
                  <BlendContent id={sid} />
                  {i < 3 && <div style={dividerStyle} />}
                </div>
              ))}

              {/* ── Section 4: Strategic Plan ── */}
              <div style={{ ...dividerStyle, margin: '40px 0' }} />
              <h2 style={sectionHeadStyle}>4. Strategic Plan</h2>

              {(['31', '32', '33', '34', '35', '36', '37'] as const).map((sid, i) => (
                <div key={sid}>
                  <p style={subheadStyle}>{getStep(sid)?.title ?? `Step ${sid}`}</p>
                  <ActionPlanContent id={sid} />
                  {i < 6 && <div style={dividerStyle} />}
                </div>
              ))}

              {/* ── Section 5: Development & Partnership ── */}
              <div style={{ ...dividerStyle, margin: '40px 0' }} />
              <h2 style={sectionHeadStyle}>5. Development &amp; Partnership</h2>

              <p style={subheadStyle}>{getStep('26')?.title ?? 'Step 26'}</p>
              <BlendContent id="26" />

              {/* Footer */}
              <div style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
