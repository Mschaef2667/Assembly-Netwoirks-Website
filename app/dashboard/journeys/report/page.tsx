'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

// Step 38 ("Generate Plans") completion behavior.
// When false: step 38 auto-approves the moment both PDFs generate successfully (lenient).
// When true:  step 38 writes status='pending_approval' so a reviewer must sign off
//             before Gate 4 unlocks. Flip to true once a Gate 4 review UI exists.
const STEP_38_REQUIRE_APPROVAL = false

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

interface AssessmentItem {
  label: string
  description: string
  gapLevel: 'none' | 'low' | 'medium' | 'high' | 'critical'
  notes: string
  currentState: string
}

interface DcpStageSummary {
  stage_number: number
  stage_name: string
  summary: string
  key_signals?: string[]
  gaps?: string[]
  confidence?: number
  confidence_score?: number
  recommended_actions?: string[]
}

interface InsightCategory {
  insights: string[]
  confidence: number
}

interface InsightsContent {
  generated_at: string
  overall_confidence: number
  categories: {
    internal_external_gap: InsightCategory
    product_gaps: InsightCategory
    key_competitors: InsightCategory
    decision_signals: InsightCategory
    brand_perception: InsightCategory
    segment_differences: InsightCategory
  }
}

interface FutureStateGapItem extends AssessmentItem {
  source: string
}

interface FutureStateData {
  company: string
  generatedAt: string
  dcpConf: number
  insightsConf: number
  gapItems: FutureStateGapItem[]
  opportunities: { label: string; text: string }[]
  threats: { label: string; text: string }[]
  retaliations: { label: string; text: string }[]
  threatPairCount: number
  internalExternalInsights: string[]
  brandPerceptionInsights: string[]
  months1to3: string[]
  months4to6: string[]
  months7to12: string[]
  months13to18: string[]
  metrics: string[]
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

// Extracts Steps 27-30 strategic message entries saved by PainPointStepEditor
// in { by_pain_point: [{ index, content }, ...] } format.
function extractStrategicMessageByPainPoint(content: Record<string, unknown>): PainPointEntry[] {
  const raw = content['by_pain_point']
  if (!Array.isArray(raw)) return []
  return (raw as unknown[])
    .map((e) => {
      const obj = e as Record<string, unknown>
      return { index: Number(obj['index'] ?? 0), content: extractDraftText(obj['content']) }
    })
    .filter((e) => e.content.trim().length > 0)
}

interface CompetitorEntry {
  name: string
  whyBuyersChooseThem: string
  keyPromise: string
  vulnerability: string
}

function extractCompetitors(content: Record<string, unknown>): CompetitorEntry[] {
  const raw = content['competitors']
  if (!Array.isArray(raw)) return []
  return (raw as Array<Record<string, unknown>>)
    .map((c) => ({
      name: String(c['name'] ?? '').trim(),
      whyBuyersChooseThem: String(c['whyBuyersChooseThem'] ?? c['why_buyers_choose'] ?? '').trim(),
      keyPromise: String(c['keyPromise'] ?? c['key_promise'] ?? '').trim(),
      vulnerability: String(c['vulnerability'] ?? '').trim(),
    }))
    .filter((c) => c.name.length > 0)
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

function extractAssessmentItems(content: Record<string, unknown> | undefined | null): AssessmentItem[] {
  if (!content) return []
  const raw = content['items']
  if (!Array.isArray(raw)) return []
  return (raw as unknown[])
    .map((r): AssessmentItem => {
      const obj = (typeof r === 'object' && r !== null) ? (r as Record<string, unknown>) : {}
      const gapRaw = typeof obj['gapLevel'] === 'string' ? (obj['gapLevel'] as string) : 'none'
      const gapLevel: AssessmentItem['gapLevel'] =
        gapRaw === 'critical' || gapRaw === 'high' || gapRaw === 'medium' || gapRaw === 'low' || gapRaw === 'none'
          ? gapRaw
          : 'none'
      return {
        label: typeof obj['label'] === 'string' ? (obj['label'] as string).trim() : '',
        description: typeof obj['description'] === 'string' ? (obj['description'] as string).trim() : '',
        gapLevel,
        notes: typeof obj['notes'] === 'string' ? (obj['notes'] as string).trim() : '',
        currentState: typeof obj['currentState'] === 'string' ? (obj['currentState'] as string).trim() : '',
      }
    })
    .filter((i) => i.label.length > 0 || i.description.length > 0)
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
  return (
    <Suspense fallback={<div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }} />}>
      <ReportPageInner />
    </Suspense>
  )
}

function ReportPageInner() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<OrgRow | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [stepDefs, setStepDefs] = useState<StepDef[]>([])
  const [outputs, setOutputs] = useState<Map<string, StepOutput>>(new Map())
  const [exporting, setExporting] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [generatingFutureState, setGeneratingFutureState] = useState(false)
  const [exportingFutureStateDocx, setExportingFutureStateDocx] = useState(false)
  const [futureStateLastGenerated, setFutureStateLastGenerated] = useState<string | null>(null)
  const [futureStateData, setFutureStateData] = useState<FutureStateData | null>(null)
  const [refreshingPreview, setRefreshingPreview] = useState(false)
  const [dcpStatus, setDcpStatus] = useState<string | null>(null)
  const [dcpOverallConfidence, setDcpOverallConfidence] = useState<number | null>(null)
  const [dcpStageSummaries, setDcpStageSummaries] = useState<DcpStageSummary[]>([])
  const [insightsContent, setInsightsContent] = useState<InsightsContent | null>(null)
  const [actionPlanApproved, setActionPlanApproved] = useState<string | null>(null)
  const [futureStateApproved, setFutureStateApproved] = useState<string | null>(null)
  const [autoBannerState, setAutoBannerState] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  // Step 38 auto-generate guard. A ref (not state) so it survives re-renders without
  // re-triggering the effect, and so React strict-mode's double-invoke can never
  // double-fire the PDF generators.
  const autoGenerateFiredRef = useRef(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const autoGenerateParam = searchParams.get('autoGenerate')

  useEffect(() => {
    void loadData()
    if (typeof window !== 'undefined') {
      setActionPlanApproved(localStorage.getItem('report_action_plan_approved'))
      setFutureStateApproved(localStorage.getItem('report_future_state_approved'))
    }
  }, [])

  useEffect(() => {
    if (!orgId || typeof window === 'undefined') return
    setFutureStateLastGenerated(localStorage.getItem(`c3.report.futureStatePlan.lastGenerated:${orgId}`))
  }, [orgId])

  useEffect(() => {
    if (futureStateData) return
    if (!futureStateLastGenerated) return
    if (dcpStatus !== 'approved' || !insightsContent) return
    const data = buildFutureStateData()
    if (data) setFutureStateData(data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [futureStateLastGenerated, dcpStatus, insightsContent, outputs, dcpStageSummaries, dcpOverallConfidence, org])

  // Step 38 auto-trigger: when the user clicks "Generate Plans" on Step 38, they
  // land here with ?autoGenerate=both. Run both PDF generators sequentially, then
  // mark Step 38 complete on success. The ref guard ensures exactly-once firing
  // across re-renders and React strict-mode double-invokes.
  useEffect(() => {
    if (autoGenerateParam !== 'both') return
    if (autoGenerateFiredRef.current) return
    if (loading) return
    if (!orgId) return

    // Both plans must be generatable; Future State needs Gate 1 + Insights.
    if (dcpStatus !== 'approved' || !insightsContent) {
      autoGenerateFiredRef.current = true
      setAutoBannerState({
        kind: 'error',
        message:
          'Cannot auto-generate both plans yet. Complete Intelligence (Gate 1) and generate Insights first, then return to Step 38.',
      })
      router.replace('/dashboard/journeys/report')
      return
    }

    autoGenerateFiredRef.current = true
    ;(async () => {
      try {
        await handlePdf()
        await handleFutureStatePdf()

        const targetStatus = STEP_38_REQUIRE_APPROVAL ? 'pending_approval' : 'approved'
        const now = new Date().toISOString()

        const { data: existing } = await supabase
          .from('step_output')
          .select('id, version')
          .eq('workspace_id', orgId)
          .eq('step_id', '38')
          .order('version', { ascending: false })
          .limit(1)

        if (existing && existing.length > 0) {
          const rowId = String((existing[0] as Record<string, unknown>)['id'])
          const { error: upErr } = await supabase
            .from('step_output')
            .update({ status: targetStatus, last_updated_at: now, last_reviewed_at: now })
            .eq('id', rowId)
          if (upErr) throw upErr
        } else {
          const { error: insErr } = await supabase.from('step_output').insert({
            workspace_id: orgId,
            step_id: '38',
            version: 1,
            status: targetStatus,
            content: {},
            copilot_assisted: false,
            last_updated_at: now,
            last_reviewed_at: now,
          })
          if (insErr) throw insErr
        }

        setAutoBannerState({
          kind: 'success',
          message: STEP_38_REQUIRE_APPROVAL
            ? 'Both plans generated. Step 38 submitted for review.'
            : 'Both plans generated. Step 38 marked complete — Gate 4 unlocked.',
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Plan generation failed'
        setAutoBannerState({
          kind: 'error',
          message: `Plan generation failed — Step 38 not marked complete. ${msg}`,
        })
      } finally {
        router.replace('/dashboard/journeys/report')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateParam, loading, orgId, dcpStatus, insightsContent])

  function formatApprovalDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return iso
    }
  }

  function handleApproveActionPlan() {
    if (!window.confirm('Mark this report as final? This version will be locked for sharing.')) return
    const ts = new Date().toISOString()
    localStorage.setItem('report_action_plan_approved', ts)
    setActionPlanApproved(ts)
  }

  function handleRevokeActionPlan() {
    localStorage.removeItem('report_action_plan_approved')
    setActionPlanApproved(null)
  }

  function handleApproveFutureState() {
    if (!window.confirm('Mark this report as final? This version will be locked for sharing.')) return
    const ts = new Date().toISOString()
    localStorage.setItem('report_future_state_approved', ts)
    setFutureStateApproved(ts)
  }

  function handleRevokeFutureState() {
    localStorage.removeItem('report_future_state_approved')
    setFutureStateApproved(null)
  }

  async function handleRefreshActionPlan() {
    setRefreshingPreview(true)
    try {
      await loadData()
    } finally {
      setRefreshingPreview(false)
    }
  }

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
      setOrgId(orgId)

      const [
        { data: orgData },
        { data: defsData },
        { data: outputsData },
        { data: dcpData },
      ] = await Promise.all([
        supabase.from('organizations').select('name, logo_url').eq('id', orgId).single(),
        supabase.from('step_definition').select('id, title, section, phase').order('id'),
        supabase.from('step_output').select('step_id, version, status, content').eq('workspace_id', orgId),
        supabase.from('dcp_analysis').select('status, overall_confidence, stage_summaries').eq('org_id', orgId).maybeSingle(),
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

      if (dcpData) {
        const dcpRow = dcpData as Record<string, unknown>
        setDcpStatus(typeof dcpRow['status'] === 'string' ? (dcpRow['status'] as string) : null)
        setDcpOverallConfidence(typeof dcpRow['overall_confidence'] === 'number' ? (dcpRow['overall_confidence'] as number) : null)
        const stages = dcpRow['stage_summaries']
        setDcpStageSummaries(Array.isArray(stages) ? (stages as DcpStageSummary[]) : [])
      }

      const insightsRow = outMap.get('insights')
      if (insightsRow && insightsRow.content && (insightsRow.content as Record<string, unknown>)['categories']) {
        setInsightsContent(insightsRow.content as unknown as InsightsContent)
      }
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
      type PdfHandle = {
        internal: {
          getNumberOfPages: () => number
          pageSize: { getWidth: () => number; getHeight: () => number }
        }
        setPage: (page: number) => void
        setFont: (font: string, style: string) => void
        setFontSize: (size: number) => void
        setTextColor: (r: number, g: number, b: number) => void
        text: (text: string, x: number, y: number, options?: { align?: string }) => void
      }
      const worker = html2pdf()
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
        .toPdf()
        .get('pdf')
        .then((pdf: PdfHandle) => {
          const totalPages = pdf.internal.getNumberOfPages()
          const pageW = pdf.internal.pageSize.getWidth()
          const pageH = pdf.internal.pageSize.getHeight()
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i)
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(8)
            pdf.setTextColor(156, 163, 175)
            pdf.text('Proprietary and Confidential — Assembly AI', pageW / 2, pageH - 5, { align: 'center' })
          }
        }) as unknown as { save: () => Promise<void> }
      await worker.save()
      if (orgId) {
        localStorage.setItem(`c3.report.actionPlan.lastGenerated:${orgId}`, new Date().toISOString())
      }
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

      // Cover — logo (if present) then company name
      if (org?.logo_url) {
        try {
          const res = await fetch(org.logo_url)
          if (res.ok) {
            const buf = await res.arrayBuffer()
            const bytes = new Uint8Array(buf)
            const ct = (res.headers.get('content-type') ?? '').toLowerCase()
            const urlLower = org.logo_url.toLowerCase()
            const isPng = ct.includes('png') || urlLower.includes('.png')
            const isJpg = ct.includes('jpeg') || ct.includes('jpg') || urlLower.match(/\.(jpe?g)/i)
            const isSvg = ct.includes('svg') || urlLower.includes('.svg')
            const imgType: 'png' | 'jpg' | 'svg' | null = isPng ? 'png' : isJpg ? 'jpg' : isSvg ? 'svg' : null
            if (imgType) {
              const { ImageRun } = lib as unknown as { ImageRun: new (opts: Record<string, unknown>) => unknown }
              const imageOpts: Record<string, unknown> = {
                data: bytes,
                transformation: { width: 120, height: 60 },
                type: imgType,
              }
              if (imgType === 'svg') {
                imageOpts['fallback'] = { type: 'png', data: bytes }
              }
              children.push(new Paragraph({
                children: [new ImageRun(imageOpts) as unknown as InstanceType<typeof TextRun>],
                spacing: { after: 240 },
              }))
            }
          }
        } catch (err) {
          console.warn('[report] failed to embed logo in DOCX =>', err)
        }
      }
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
      ;(['17', '18', '20'] as const).forEach((sid, i) => {
        const o = getOutput(sid); const s = getStep(sid)
        const label = `2${String.fromCharCode(97 + i)}`
        children.push(subheading(lib, `${label}. ${s?.title ?? `Step ${sid}`}`))
        if (o && hasContent(sid)) {
          if (sid === '17') {
            const competitors = extractCompetitors(o.content)
            if (competitors.length === 0) {
              children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
            } else {
              competitors.forEach(c => {
                children.push(new Paragraph({
                  children: [new TextRun({ text: c.name, bold: true, size: 24 })],
                  spacing: { before: 160, after: 80 },
                }))
                if (c.whyBuyersChooseThem) children.push(para(lib, `Why Buyers Choose Them: ${c.whyBuyersChooseThem}`, false, true))
                if (c.keyPromise) children.push(para(lib, `Their Key Promise: ${c.keyPromise}`, false, true))
                if (c.vulnerability) children.push(para(lib, `Their Vulnerability: ${c.vulnerability}`, false, true))
              })
            }
          } else {
            const entries = extractByPainPoint(o, step4PainPoints)
            if (entries.length === 0) {
              children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
            } else {
              entries.forEach((e, idx) => {
                children.push(new Paragraph({
                  children: [new TextRun({ text: `Pain Point ${idx + 1}: ${e.label}`, bold: true, size: 22 })],
                  spacing: { before: 140, after: 60 },
                }))
                if (e.text) children.push(para(lib, e.text, false, true))
              })
            }
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
          const byPainPoint = extractStrategicMessageByPainPoint(o.content)
          if (byPainPoint.length > 0) {
            byPainPoint.forEach((e, idx) => {
              children.push(new Paragraph({
                children: [new TextRun({ text: `Pain Point ${e.index || idx + 1}`, bold: true, size: 22 })],
                spacing: { before: 140, after: 60 },
              }))
              children.push(para(lib, e.content, false, true))
            })
          } else {
            const b = extractBlend(o.content)
            if (b.mode === 'blended' && b.blended) {
              children.push(para(lib, b.blended))
            } else {
              b.entries
                .filter(e => e.content.trim().length > 0)
                .forEach(e => {
                  children.push(new Paragraph({
                    children: [new TextRun({ text: `Pain Point ${e.index}`, bold: true, size: 22 })],
                    spacing: { before: 140, after: 60 },
                  }))
                  children.push(para(lib, e.content, false, true))
                })
            }
          }
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      })

      // Section 4 — Action Plan (summary-only, falls back to first action tab)
      children.push(new Paragraph({ text: '4. Action Plan', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      ;(['31', '32', '33', '34', '35', '36', '37'] as const).forEach((sid) => {
        const o = getOutput(sid); const s = getStep(sid)
        children.push(subheading(lib, s?.title ?? `Step ${sid}`))
        if (o && hasContent(sid)) {
          const ap = extractActionPlan(o.content)
          if (ap.summary.trim().length > 0) {
            children.push(para(lib, ap.summary))
          } else {
            const firstEntry = ap.entries.find(e => e.content.trim().length > 0)
            if (firstEntry) {
              children.push(para(lib, firstEntry.content))
            } else {
              children.push(new Paragraph({ children: [new TextRun({ text: 'Summary not yet written', italics: true, color: '9CA3AF' })] }))
            }
          }
        } else children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        blank()
      })

      // Section 5 — 30/60/90 Day Action Plan
      children.push(new Paragraph({ text: '5. 30/60/90 Day Action Plan', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      ;([
        { label: 'First 30 Days', stepIds: ['31', '32'] as const },
        { label: 'Days 31-60', stepIds: ['33', '34'] as const },
        { label: 'Days 61-90', stepIds: ['35', '36'] as const },
      ]).forEach((bucket) => {
        children.push(subheading(lib, bucket.label))
        const entries = bucket.stepIds.map((sid) => {
          const o = getOutput(sid); const s = getStep(sid)
          const title = s?.title ?? `Step ${sid}`
          if (!o || !hasContent(sid)) return { id: sid, title, text: '' }
          const ap = extractActionPlan(o.content)
          if (ap.summary.trim().length > 0) return { id: sid, title, text: ap.summary }
          const firstEntry = ap.entries.find(e => e.content.trim().length > 0)
          return { id: sid, title, text: firstEntry?.content ?? '' }
        })
        const allEmpty = entries.every(e => e.text.length === 0)
        if (allEmpty) {
          children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
        } else {
          entries.forEach((e) => {
            children.push(new Paragraph({
              children: [new TextRun({ text: e.title, bold: true, size: 22 })],
              spacing: { before: 140, after: 60 },
            }))
            if (e.text) {
              children.push(para(lib, e.text, false, true))
            } else {
              children.push(new Paragraph({ children: [new TextRun({ text: 'Not yet completed', italics: true, color: '9CA3AF' })] }))
            }
          })
        }
        blank()
      })

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
      if (orgId) {
        localStorage.setItem(`c3.report.actionPlan.lastGenerated:${orgId}`, new Date().toISOString())
      }
    } catch (e) {
      console.error('DOCX export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  // ─── Future State Strategic Plan PDF ────────────────────────────────────────

  const canGenerateFutureState = dcpStatus === 'approved' && insightsContent !== null

  function buildFutureStateData(): FutureStateData | null {
    if (!insightsContent) return null

    const company = org?.name ?? 'Your Company'
    const dcpConf = dcpOverallConfidence ?? 0
    const insightsConf = insightsContent.overall_confidence ?? 0

    const step4Out = getOutput('4')
    const painPoints = step4Out ? extractPainPoints(step4Out.content) : []

    const step13Items = extractAssessmentItems(getOutput('13')?.content)
    const step14Items = extractAssessmentItems(getOutput('14')?.content)
    const gapItems: FutureStateGapItem[] = [
      ...step13Items.map((i) => ({ source: 'Critical Success Formula', ...i })),
      ...step14Items.map((i) => ({ source: 'Core Competency', ...i })),
    ].filter((i) => i.gapLevel === 'critical' || i.gapLevel === 'high')

    const step25Out = getOutput('25')
    const opportunities = step25Out ? extractByPainPoint(step25Out, painPoints) : []
    const step20Out = getOutput('20')
    const step24Out = getOutput('24')
    const threats = step20Out ? extractByPainPoint(step20Out, painPoints) : []
    const retaliations = step24Out ? extractByPainPoint(step24Out, painPoints) : []
    const threatPairCount = Math.max(threats.length, retaliations.length)

    const brandPerception = insightsContent.categories?.brand_perception
    const internalExternal = insightsContent.categories?.internal_external_gap
    const productGaps = insightsContent.categories?.product_gaps?.insights ?? []
    const step26Out = getOutput('26')
    const swEntries = step26Out ? extractByPainPoint(step26Out, painPoints) : []

    const stage7 = dcpStageSummaries.find((s) => s.stage_number === 7)
    const stage7Signals = Array.isArray(stage7?.key_signals) ? (stage7!.key_signals as string[]) : []
    const decisionSignals = insightsContent.categories?.decision_signals?.insights ?? []

    const criticalCount = gapItems.filter((g) => g.gapLevel === 'critical').length
    const highCount = gapItems.filter((g) => g.gapLevel === 'high').length

    const months1to3: string[] = []
    months1to3.push('Close all Critical capability gaps from Section 2 — decide build/hire/partner for each within 30 days.')
    if (criticalCount > 0) months1to3.push(`${criticalCount} Critical gap${criticalCount === 1 ? '' : 's'} require immediate ownership and a documented closure plan.`)
    if (opportunities.length > 0) months1to3.push('Launch the highest-leverage market opportunity from Section 3 as a quick-win pilot.')

    const months4to6: string[] = []
    if (retaliations.length > 0) months4to6.push('Execute the competitive retaliation strategies from Section 4 — sales enablement, battle cards, objection handling.')
    months4to6.push('Begin brand repositioning rollout — update website, pitch deck, and sales scripts to reflect buyer language.')
    if (highCount > 0) months4to6.push(`Close the ${highCount} High-priority capability gap${highCount === 1 ? '' : 's'} from Section 2.`)

    const months7to12: string[] = []
    if (opportunities.length > 1) months7to12.push('Pursue remaining market opportunities from Section 3 in priority order.')
    if (productGaps.length > 0) months7to12.push(`Address top product gaps surfaced in Insights: ${productGaps.slice(0, 2).join('; ')}.`)
    months7to12.push('Measure progress against the success metrics in Section 7 and iterate.')

    const months13to18: string[] = []
    months13to18.push('Scale the initiatives that produced the strongest leading indicators.')
    months13to18.push('Evaluate entry into adjacent segments based on validated win patterns.')
    if (swEntries.length > 0) months13to18.push('Use Step 26 strengths and weaknesses output to prioritize sustained differentiation investments.')

    const metrics: string[] = []
    stage7Signals.slice(0, 3).forEach((sig) => metrics.push(`Validation signal: ${sig}`))
    decisionSignals.slice(0, 3).forEach((sig) => metrics.push(`Decision signal: ${sig}`))
    metrics.push('Critical capability gaps closed (target: 100% within 90 days)')
    metrics.push('Win rate vs. priority competitors (target: +10 pts over baseline)')
    if (metrics.length < 7) metrics.push('Buyer conversations validating revised positioning (target: 3 per quarter)')

    return {
      company,
      generatedAt: new Date().toISOString(),
      dcpConf,
      insightsConf,
      gapItems,
      opportunities,
      threats,
      retaliations,
      threatPairCount,
      internalExternalInsights: Array.isArray(internalExternal?.insights) ? internalExternal!.insights : [],
      brandPerceptionInsights: Array.isArray(brandPerception?.insights) ? brandPerception!.insights : [],
      months1to3,
      months4to6,
      months7to12,
      months13to18,
      metrics,
    }
  }

  async function handleGenerateFutureState() {
    if (!canGenerateFutureState || !insightsContent) return
    setGeneratingFutureState(true)
    setFutureStateData(null)
    try {
      await loadData()
      if (orgId && typeof window !== 'undefined') {
        const ts = new Date().toISOString()
        localStorage.setItem(`c3.report.futureStatePlan.lastGenerated:${orgId}`, ts)
        setFutureStateLastGenerated(ts)
      }
    } finally {
      setGeneratingFutureState(false)
    }
  }

  async function handleFutureStatePdf() {
    if (!canGenerateFutureState || !insightsContent) return
    setGeneratingFutureState(true)
    const builtData = buildFutureStateData()
    if (builtData) setFutureStateData(builtData)
    try {
      const { jsPDF } = await import('jspdf')
      const company = org?.name ?? 'Your Company'
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

      const NAVY   = '#0A1628'
      const ORANGE = '#E8520A'
      const BLUE   = '#0EA5E9'
      const GREY   = '#6B7280'
      const BLACK  = '#0D0D0D'
      const AMBER  = '#D97706'
      const RED    = '#DC2626'

      const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 50
      const contentW = pageW - margin * 2

      function hexToRgb(hex: string): [number, number, number] {
        return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
      }
      function setFill(hex: string) { doc.setFillColor(...hexToRgb(hex)) }
      function setStroke(hex: string) { doc.setDrawColor(...hexToRgb(hex)) }
      function setTextColor(hex: string) { doc.setTextColor(...hexToRgb(hex)) }

      function wrappedText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
        const lines = doc.splitTextToSize(text, maxWidth) as string[]
        for (const line of lines) {
          if (y > pageH - margin - 36) { doc.addPage(); y = margin + 20 }
          doc.text(line, x, y)
          y += lineHeight
        }
        return y
      }

      function checkPage(y: number, needed = 60): number {
        if (y + needed > pageH - margin - 30) { doc.addPage(); return margin + 20 }
        return y
      }

      function sectionHeader(title: string, subtitle?: string): number {
        doc.addPage()
        let y = margin
        setFill(NAVY)
        doc.rect(0, 0, pageW, 50, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(15)
        setTextColor('#FFFFFF')
        doc.text(title, margin, 32)
        y = 78
        setFill(ORANGE)
        doc.rect(margin, y, 48, 3, 'F')
        y += 22
        if (subtitle) {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(10)
          setTextColor(GREY)
          y = wrappedText(subtitle, margin, y, contentW, 13)
          y += 12
        }
        return y
      }

      // ── Cover ──
      setFill(ORANGE)
      doc.rect(0, 0, pageW, 6, 'F')

      // Logo (if available) — embed via Image API
      if (org?.logo_url) {
        try {
          const res = await fetch(org.logo_url)
          if (res.ok) {
            const blob = await res.blob()
            const reader = new FileReader()
            const dataUrl: string = await new Promise((resolve, reject) => {
              reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '')
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
            if (dataUrl) {
              const fmt = dataUrl.includes('image/png') ? 'PNG' : dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : null
              if (fmt) doc.addImage(dataUrl, fmt, pageW / 2 - 50, 60, 100, 50)
            }
          }
        } catch {
          // logo embed is best-effort
        }
      }

      let y = 150
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      setTextColor(ORANGE)
      doc.text('ASSEMBLY AI', pageW / 2, y, { align: 'center', charSpace: 2 })
      y += 40

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(28)
      setTextColor(NAVY)
      doc.text('Future State Strategic Plan', pageW / 2, y, { align: 'center' })
      y += 32

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(14)
      setTextColor(GREY)
      doc.text('6-18 Month GTM Roadmap', pageW / 2, y, { align: 'center' })
      y += 28

      setStroke(ORANGE)
      doc.setLineWidth(1.5)
      doc.line(margin + 60, y, pageW - margin - 60, y)
      y += 36

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      setTextColor(NAVY)
      doc.text(company, pageW / 2, y, { align: 'center' })
      y += 22
      doc.setFont('helvetica', 'normal')
      setTextColor(GREY)
      doc.text(today, pageW / 2, y, { align: 'center' })

      // Confidential footer on cover
      setTextColor('#9CA3AF')
      doc.setFontSize(9)
      doc.text('Proprietary and Confidential', pageW / 2, pageH - 60, { align: 'center' })

      // ── Section 1: Executive Summary ──
      y = sectionHeader('1. Executive Summary',
        'Current state assessment and the strategic future state opportunity.')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      setTextColor(BLACK)
      const dcpConf = dcpOverallConfidence ?? 0
      const insightsConf = insightsContent.overall_confidence ?? 0
      const para1 = `${company} has completed Phase 1 buyer research with an overall Decision Clarity Profile confidence of ${dcpConf}/100. Insights analysis surfaced patterns across six intelligence categories with an aggregate confidence of ${insightsConf}/100. These signals form the foundation for the future state strategy outlined in this plan.`
      y = wrappedText(para1, margin, y, contentW, 16)
      y += 10
      const para2 = `This Future State Strategic Plan is the companion to the current state Strategic Plan. While the current state plan describes the actions to take today based on what is true, this plan describes the 6-18 month strategic agenda to close capability gaps, capture market opportunities, neutralize competitive threats, and reposition the brand to align with how buyers actually evaluate solutions.`
      y = wrappedText(para2, margin, y, contentW, 16)
      y += 10
      const para3 = `Execute the roadmap in sequence: close critical capability gaps first, pursue quick-win market opportunities next, then execute longer-horizon competitive and brand initiatives. Track the success metrics in Section 7 to measure progress toward the future state.`
      y = wrappedText(para3, margin, y, contentW, 16)

      // ── Section 2: Capability Gap Roadmap ──
      y = sectionHeader('2. Priority Capability Gaps to Address',
        'Critical and High gaps identified in Steps 13 (Critical Success Formulas) and 14 (Core Competencies).')

      const step13Items = extractAssessmentItems(getOutput('13')?.content)
      const step14Items = extractAssessmentItems(getOutput('14')?.content)
      const gapItems = [
        ...step13Items.map((i) => ({ source: 'Critical Success Formula', ...i })),
        ...step14Items.map((i) => ({ source: 'Core Competency', ...i })),
      ].filter((i) => i.gapLevel === 'critical' || i.gapLevel === 'high')

      if (gapItems.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        setTextColor(GREY)
        y = wrappedText('No critical or high gaps identified. Complete Steps 13 and 14 to surface capability gaps.', margin, y, contentW, 14)
      } else {
        gapItems.forEach((gap, idx) => {
          y = checkPage(y, 90)
          const badgeColor = gap.gapLevel === 'critical' ? RED : ORANGE
          const badgeLabel = gap.gapLevel === 'critical' ? 'CRITICAL' : 'HIGH'
          const timeline = gap.gapLevel === 'critical' ? '30 days' : '60-90 days'

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          setTextColor(NAVY)
          doc.text(`${idx + 1}. ${gap.label || 'Untitled gap'}`, margin, y)
          y += 16

          // Gap level badge
          setFill(badgeColor)
          doc.roundedRect(margin, y - 10, 56, 14, 2, 2, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          setTextColor('#FFFFFF')
          doc.text(badgeLabel, margin + 28, y, { align: 'center' })

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          setTextColor(GREY)
          doc.text(`${gap.source} · Close within ${timeline}`, margin + 64, y)
          y += 16

          if (gap.description) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            setTextColor(NAVY)
            doc.text('Current state:', margin, y); y += 12
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            setTextColor(BLACK)
            y = wrappedText(gap.description, margin, y, contentW, 13)
            y += 6
          }

          if (gap.notes) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            setTextColor(NAVY)
            doc.text('Notes:', margin, y); y += 12
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            setTextColor(BLACK)
            y = wrappedText(gap.notes, margin, y, contentW, 13)
            y += 6
          }

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          setTextColor(NAVY)
          doc.text('Recommended action:', margin, y); y += 12
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          setTextColor(BLACK)
          const action = gap.gapLevel === 'critical'
            ? `Decide within 30 days whether to build, hire for, or partner to close this gap. This capability is promised in the CVP and cannot be deferred.`
            : `Plan a 60-90 day initiative to strengthen this capability. Assign an owner and document a measurable target.`
          y = wrappedText(action, margin, y, contentW, 13)
          y += 14
        })
      }

      // ── Section 3: Competitive Opportunity Map ──
      y = sectionHeader('3. Market Opportunities to Pursue',
        'Competitive opportunities surfaced in Step 25 — gaps in the market where competitors are weak.')
      const step25 = getOutput('25')
      const step4PainPoints = (() => { const o = getOutput('4'); return o ? extractPainPoints(o.content) : [] })()
      const opportunities = step25 ? extractByPainPoint(step25, step4PainPoints) : []
      if (opportunities.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        setTextColor(GREY)
        y = wrappedText('No competitive opportunities recorded yet. Complete Step 25 to identify market openings.', margin, y, contentW, 14)
      } else {
        opportunities.forEach((opp, idx) => {
          y = checkPage(y, 60)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          setTextColor(NAVY)
          y = wrappedText(`${idx + 1}. ${opp.label}`, margin, y, contentW, 14)
          y += 4
          if (opp.text) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            setTextColor(BLACK)
            y = wrappedText(opp.text, margin, y, contentW, 13)
          }
          y += 12
        })
      }

      // ── Section 4: Competitive Threats and Response ──
      y = sectionHeader('4. Competitive Threats and Response Strategies',
        'Threats from Step 20 paired with the retaliation strategies developed in Step 24.')
      const step20 = getOutput('20')
      const step24 = getOutput('24')
      const threats = step20 ? extractByPainPoint(step20, step4PainPoints) : []
      const retaliations = step24 ? extractByPainPoint(step24, step4PainPoints) : []
      if (threats.length === 0 && retaliations.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        setTextColor(GREY)
        y = wrappedText('No competitive threats or retaliation strategies recorded yet. Complete Steps 20 and 24.', margin, y, contentW, 14)
      } else {
        const maxLen = Math.max(threats.length, retaliations.length)
        for (let i = 0; i < maxLen; i++) {
          y = checkPage(y, 80)
          const t = threats[i]
          const r = retaliations[i]
          const label = (t?.label || r?.label || `Pain Point ${i + 1}`)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          setTextColor(NAVY)
          y = wrappedText(label, margin, y, contentW, 14)
          y += 4
          if (t?.text) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            setTextColor(RED)
            doc.text('Threat:', margin, y); y += 12
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            setTextColor(BLACK)
            y = wrappedText(t.text, margin, y, contentW, 13)
            y += 6
          }
          if (r?.text) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            setTextColor(BLUE)
            doc.text('Retaliation strategy:', margin, y); y += 12
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            setTextColor(BLACK)
            y = wrappedText(r.text, margin, y, contentW, 13)
            y += 6
          }
          y += 8
        }
      }

      // ── Section 5: Brand Repositioning ──
      y = sectionHeader('5. Brand and Positioning Recommendations',
        'Drawn from the Insights categories: Brand Perception and Internal vs External Gap.')
      const brandPerception = insightsContent.categories?.brand_perception
      const internalExternal = insightsContent.categories?.internal_external_gap

      function renderInsightBlock(heading: string, sub: string, items: string[] | undefined): number {
        y = checkPage(y, 60)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        setTextColor(NAVY)
        y = wrappedText(heading, margin, y, contentW, 14)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        setTextColor(GREY)
        y = wrappedText(sub, margin, y, contentW, 12)
        y += 6
        const list = Array.isArray(items) ? items : []
        if (list.length === 0) {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(10)
          setTextColor(GREY)
          y = wrappedText('No findings in this category.', margin, y, contentW, 13)
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          setTextColor(BLACK)
          list.forEach((item) => {
            y = checkPage(y, 24)
            y = wrappedText(`• ${item}`, margin + 8, y, contentW - 8, 14)
            y += 4
          })
        }
        y += 10
        return y
      }

      y = renderInsightBlock(
        'Internal vs External Gaps',
        'Where the team\'s beliefs differ from what real buyers said.',
        internalExternal?.insights,
      )
      y = renderInsightBlock(
        'Brand Perception Gaps',
        'How buyers describe you vs. how you describe yourself — close this gap with deliberate messaging.',
        brandPerception?.insights,
      )

      // Recommendation block
      y = checkPage(y, 60)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      setTextColor(NAVY)
      doc.text('Repositioning Recommendation', margin, y); y += 16
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      setTextColor(BLACK)
      y = wrappedText('Use the gaps above to adjust positioning, website copy, sales collateral, and pitch language so the external story matches how buyers describe the problem and the desired outcome. Validate the revised positioning with three customer conversations before rolling out broadly.', margin, y, contentW, 14)

      // ── Section 6: 6-18 Month GTM Roadmap ──
      y = sectionHeader('6. 6-18 Month GTM Roadmap',
        'Sequenced initiatives drawing on Step 26 (Strengths and Weaknesses) and Insights product gaps.')
      const step26 = getOutput('26')
      const swEntries = step26 ? extractByPainPoint(step26, step4PainPoints) : []
      const productGaps = insightsContent.categories?.product_gaps?.insights ?? []

      function bucket(title: string, summary: string, lines: string[]): void {
        y = checkPage(y, 80)
        setFill(ORANGE)
        doc.rect(margin, y - 10, 4, 18, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        setTextColor(NAVY)
        doc.text(title, margin + 12, y); y += 16
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        setTextColor(GREY)
        y = wrappedText(summary, margin + 12, y, contentW - 12, 12)
        y += 6
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        setTextColor(BLACK)
        lines.forEach((line) => {
          y = checkPage(y, 24)
          y = wrappedText(`• ${line}`, margin + 16, y, contentW - 16, 14)
          y += 2
        })
        y += 14
      }

      const months1to3: string[] = []
      months1to3.push('Close all Critical capability gaps from Section 2 — decide build/hire/partner for each within 30 days.')
      const criticalCount = gapItems.filter((g) => g.gapLevel === 'critical').length
      if (criticalCount > 0) months1to3.push(`${criticalCount} Critical gap${criticalCount === 1 ? '' : 's'} require immediate ownership and a documented closure plan.`)
      if (opportunities.length > 0) months1to3.push(`Launch the highest-leverage market opportunity from Section 3 as a quick-win pilot.`)
      bucket('Months 1-3', 'Close critical gaps and launch quick-win opportunities.', months1to3)

      const months4to6: string[] = []
      if (retaliations.length > 0) months4to6.push('Execute the competitive retaliation strategies from Section 4 — sales enablement, battle cards, objection handling.')
      months4to6.push('Begin brand repositioning rollout — update website, pitch deck, and sales scripts to reflect buyer language.')
      const highCount = gapItems.filter((g) => g.gapLevel === 'high').length
      if (highCount > 0) months4to6.push(`Close the ${highCount} High-priority capability gap${highCount === 1 ? '' : 's'} from Section 2.`)
      bucket('Months 4-6', 'Execute competitive retaliation and begin brand repositioning.', months4to6)

      const months7to12: string[] = []
      if (opportunities.length > 1) months7to12.push('Pursue remaining market opportunities from Section 3 in priority order.')
      if (productGaps.length > 0) months7to12.push(`Address top product gaps surfaced in Insights: ${productGaps.slice(0, 2).join('; ')}.`)
      months7to12.push('Measure progress against the success metrics in Section 7 and iterate.')
      bucket('Months 7-12', 'Pursue competitive opportunities, measure and optimize.', months7to12)

      const months13to18: string[] = []
      months13to18.push('Scale the initiatives that produced the strongest leading indicators.')
      months13to18.push('Evaluate entry into adjacent segments based on validated win patterns.')
      if (swEntries.length > 0) months13to18.push('Use Step 26 strengths and weaknesses output to prioritize sustained differentiation investments.')
      bucket('Months 13-18', 'Scale what is working and enter new segments.', months13to18)

      // ── Section 7: Success Metrics ──
      y = sectionHeader('7. Success Metrics to Track',
        'Drawn from DCP Stage 7 (Confirmation) signals and Insights decision signals.')
      const stage7 = dcpStageSummaries.find((s) => s.stage_number === 7)
      const decisionSignals = insightsContent.categories?.decision_signals?.insights ?? []

      const metrics: string[] = []
      const stage7Signals = Array.isArray(stage7?.key_signals) ? (stage7!.key_signals as string[]) : []
      stage7Signals.slice(0, 3).forEach((sig) => metrics.push(`Validation signal: ${sig}`))
      decisionSignals.slice(0, 3).forEach((sig) => metrics.push(`Decision signal: ${sig}`))
      // Always-on operational metrics
      metrics.push('Critical capability gaps closed (target: 100% within 90 days)')
      metrics.push('Win rate vs. priority competitors from Section 4 (target: +10 pts over baseline)')
      if (metrics.length < 7) metrics.push('Number of buyer conversations validating revised positioning (target: 3 per quarter)')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      setTextColor(BLACK)
      metrics.slice(0, 7).forEach((m, idx) => {
        y = checkPage(y, 24)
        doc.setFont('helvetica', 'bold')
        setTextColor(ORANGE)
        doc.text(`${idx + 1}.`, margin, y)
        doc.setFont('helvetica', 'normal')
        setTextColor(BLACK)
        y = wrappedText(m, margin + 18, y, contentW - 18, 14)
        y += 6
      })

      // ── Footer on every page (except cover handled inline above) ──
      const totalPages = (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1
      for (let p = 2; p <= totalPages; p++) {
        doc.setPage(p)
        setFill(NAVY)
        doc.rect(0, pageH - 26, pageW, 26, 'F')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        setTextColor('#9CA3AF')
        doc.text(`Assembly AI Confidential — Future State Strategic Plan — ${company}`, margin, pageH - 10)
        doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 10, { align: 'right' })
      }

      const slug = company.toLowerCase().replace(/\s+/g, '-')
      doc.save(`${slug}-future-state-strategic-plan.pdf`)
      if (orgId) {
        const ts = new Date().toISOString()
        localStorage.setItem(`c3.report.futureStatePlan.lastGenerated:${orgId}`, ts)
        setFutureStateLastGenerated(ts)
      }
    } catch (e) {
      console.error('Future State PDF export failed:', e)
    } finally {
      setGeneratingFutureState(false)
    }
  }

  // ─── Future State Strategic Plan DOCX ───────────────────────────────────────

  async function handleFutureStateDocx() {
    if (!canGenerateFutureState || !insightsContent) return
    setExportingFutureStateDocx(true)
    try {
      const lib = await import('docx')
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = lib

      const company = org?.name ?? 'Your Company'
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const dcpConf = dcpOverallConfidence ?? 0
      const insightsConf = insightsContent.overall_confidence ?? 0

      const step4PainPoints = (() => { const o = getOutput('4'); return o ? extractPainPoints(o.content) : [] })()
      const step13Items = extractAssessmentItems(getOutput('13')?.content)
      const step14Items = extractAssessmentItems(getOutput('14')?.content)
      const gapItems = [
        ...step13Items.map((i) => ({ source: 'Critical Success Formula', ...i })),
        ...step14Items.map((i) => ({ source: 'Core Competency', ...i })),
      ].filter((i) => i.gapLevel === 'critical' || i.gapLevel === 'high')
      const criticalCount = gapItems.filter((g) => g.gapLevel === 'critical').length
      const highCount = gapItems.filter((g) => g.gapLevel === 'high').length

      const step25Out = getOutput('25')
      const opportunities = step25Out ? extractByPainPoint(step25Out, step4PainPoints) : []
      const step20Out = getOutput('20')
      const step24Out = getOutput('24')
      const threats = step20Out ? extractByPainPoint(step20Out, step4PainPoints) : []
      const retaliations = step24Out ? extractByPainPoint(step24Out, step4PainPoints) : []

      const brandPerception = insightsContent.categories?.brand_perception
      const internalExternal = insightsContent.categories?.internal_external_gap
      const productGaps = insightsContent.categories?.product_gaps?.insights ?? []
      const step26Out = getOutput('26')
      const swEntries = step26Out ? extractByPainPoint(step26Out, step4PainPoints) : []

      const stage7 = dcpStageSummaries.find((s) => s.stage_number === 7)
      const stage7Signals = Array.isArray(stage7?.key_signals) ? (stage7!.key_signals as string[]) : []
      const decisionSignals = insightsContent.categories?.decision_signals?.insights ?? []

      const children: InstanceType<typeof Paragraph>[] = []
      const blank = () => children.push(new Paragraph({ text: '' }))

      // Cover
      children.push(new Paragraph({ text: company, heading: HeadingLevel.TITLE, spacing: { after: 200 } }))
      children.push(new Paragraph({ children: [new TextRun({ text: 'Future State Strategic Plan', bold: true, size: 36, color: '0EA5E9' })], spacing: { after: 100 } }))
      children.push(new Paragraph({ children: [new TextRun({ text: '6-18 Month GTM Roadmap', size: 24, color: '6B7280' })], spacing: { after: 200 } }))
      children.push(new Paragraph({ children: [new TextRun({ text: today, size: 22, color: '6B7280' })], spacing: { after: 600 } }))

      // 1. Executive Summary
      children.push(new Paragraph({ text: '1. Executive Summary', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      children.push(para(lib, `${company} has completed Phase 1 buyer research with an overall Decision Clarity Profile confidence of ${dcpConf}/100. Insights analysis surfaced patterns across six intelligence categories with an aggregate confidence of ${insightsConf}/100. These signals form the foundation for the future state strategy outlined in this plan.`))
      children.push(para(lib, 'This Future State Strategic Plan is the companion to the current state Strategic Plan. While the current state plan describes the actions to take today based on what is true, this plan describes the 6-18 month strategic agenda to close capability gaps, capture market opportunities, neutralize competitive threats, and reposition the brand to align with how buyers actually evaluate solutions.'))
      children.push(para(lib, 'Execute the roadmap in sequence: close critical capability gaps first, pursue quick-win market opportunities next, then execute longer-horizon competitive and brand initiatives. Track the success metrics in Section 7 to measure progress toward the future state.'))
      blank()

      // 2. Capability Gap Roadmap
      children.push(new Paragraph({ text: '2. Priority Capability Gaps to Address', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      if (gapItems.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'No critical or high gaps identified. Complete Steps 13 and 14 to surface capability gaps.', italics: true, color: '9CA3AF' })] }))
      } else {
        gapItems.forEach((gap, idx) => {
          const badgeLabel = gap.gapLevel === 'critical' ? 'CRITICAL' : 'HIGH'
          const timeline = gap.gapLevel === 'critical' ? '30 days' : '60-90 days'
          children.push(new Paragraph({
            children: [new TextRun({ text: `${idx + 1}. ${gap.label || 'Untitled gap'}`, bold: true, size: 24 })],
            spacing: { before: 160, after: 60 },
          }))
          children.push(new Paragraph({
            children: [new TextRun({ text: `[${badgeLabel}] ${gap.source} · Close within ${timeline}`, color: gap.gapLevel === 'critical' ? 'DC2626' : 'E8520A', bold: true, size: 18 })],
            spacing: { after: 80 },
          }))
          if (gap.description) children.push(para(lib, `Current state: ${gap.description}`, false, true))
          if (gap.notes) children.push(para(lib, `Notes: ${gap.notes}`, false, true))
          const action = gap.gapLevel === 'critical'
            ? 'Decide within 30 days whether to build, hire for, or partner to close this gap. This capability is promised in the CVP and cannot be deferred.'
            : 'Plan a 60-90 day initiative to strengthen this capability. Assign an owner and document a measurable target.'
          children.push(para(lib, `Recommended action: ${action}`, false, true))
          blank()
        })
      }

      // 3. Competitive Opportunity Map
      children.push(new Paragraph({ text: '3. Market Opportunities to Pursue', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      if (opportunities.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'No competitive opportunities recorded yet. Complete Step 25 to identify market openings.', italics: true, color: '9CA3AF' })] }))
      } else {
        opportunities.forEach((opp, idx) => {
          children.push(new Paragraph({
            children: [new TextRun({ text: `${idx + 1}. ${opp.label}`, bold: true, size: 22 })],
            spacing: { before: 140, after: 60 },
          }))
          if (opp.text) children.push(para(lib, opp.text, false, true))
        })
      }
      blank()

      // 4. Competitive Threat Response
      children.push(new Paragraph({ text: '4. Competitive Threats and Response Strategies', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      const threatPairCount = Math.max(threats.length, retaliations.length)
      if (threatPairCount === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'No competitive threats or retaliation strategies recorded yet. Complete Steps 20 and 24.', italics: true, color: '9CA3AF' })] }))
      } else {
        for (let i = 0; i < threatPairCount; i++) {
          const t = threats[i]
          const r = retaliations[i]
          const label = t?.label || r?.label || `Pain Point ${i + 1}`
          children.push(new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 22 })],
            spacing: { before: 140, after: 60 },
          }))
          if (t?.text) children.push(para(lib, `Threat: ${t.text}`, false, true))
          if (r?.text) children.push(para(lib, `Retaliation strategy: ${r.text}`, false, true))
        }
      }
      blank()

      // 5. Brand Repositioning
      children.push(new Paragraph({ text: '5. Brand and Positioning Recommendations', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      children.push(subheading(lib, 'Internal vs External Gaps'))
      children.push(para(lib, "Where the team's beliefs differ from what real buyers said.", false, true))
      const ieList = Array.isArray(internalExternal?.insights) ? internalExternal!.insights : []
      if (ieList.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'No findings in this category.', italics: true, color: '9CA3AF' })] }))
      } else {
        ieList.forEach((item) => children.push(para(lib, `• ${item}`, false, true)))
      }
      blank()
      children.push(subheading(lib, 'Brand Perception Gaps'))
      children.push(para(lib, 'How buyers describe you vs. how you describe yourself — close this gap with deliberate messaging.', false, true))
      const bpList = Array.isArray(brandPerception?.insights) ? brandPerception!.insights : []
      if (bpList.length === 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'No findings in this category.', italics: true, color: '9CA3AF' })] }))
      } else {
        bpList.forEach((item) => children.push(para(lib, `• ${item}`, false, true)))
      }
      blank()
      children.push(subheading(lib, 'Repositioning Recommendation'))
      children.push(para(lib, 'Use the gaps above to adjust positioning, website copy, sales collateral, and pitch language so the external story matches how buyers describe the problem and the desired outcome. Validate the revised positioning with three customer conversations before rolling out broadly.'))
      blank()

      // 6. 6-18 Month Roadmap
      children.push(new Paragraph({ text: '6. 6-18 Month GTM Roadmap', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))

      const months1to3: string[] = []
      months1to3.push('Close all Critical capability gaps from Section 2 — decide build/hire/partner for each within 30 days.')
      if (criticalCount > 0) months1to3.push(`${criticalCount} Critical gap${criticalCount === 1 ? '' : 's'} require immediate ownership and a documented closure plan.`)
      if (opportunities.length > 0) months1to3.push('Launch the highest-leverage market opportunity from Section 3 as a quick-win pilot.')

      const months4to6: string[] = []
      if (retaliations.length > 0) months4to6.push('Execute the competitive retaliation strategies from Section 4 — sales enablement, battle cards, objection handling.')
      months4to6.push('Begin brand repositioning rollout — update website, pitch deck, and sales scripts to reflect buyer language.')
      if (highCount > 0) months4to6.push(`Close the ${highCount} High-priority capability gap${highCount === 1 ? '' : 's'} from Section 2.`)

      const months7to12: string[] = []
      if (opportunities.length > 1) months7to12.push('Pursue remaining market opportunities from Section 3 in priority order.')
      if (productGaps.length > 0) months7to12.push(`Address top product gaps surfaced in Insights: ${productGaps.slice(0, 2).join('; ')}.`)
      months7to12.push('Measure progress against the success metrics in Section 7 and iterate.')

      const months13to18: string[] = []
      months13to18.push('Scale the initiatives that produced the strongest leading indicators.')
      months13to18.push('Evaluate entry into adjacent segments based on validated win patterns.')
      if (swEntries.length > 0) months13to18.push('Use Step 26 strengths and weaknesses output to prioritize sustained differentiation investments.')

      const buckets = [
        { title: 'Months 1-3', summary: 'Close critical gaps and launch quick-win opportunities.', lines: months1to3 },
        { title: 'Months 4-6', summary: 'Execute competitive retaliation and begin brand repositioning.', lines: months4to6 },
        { title: 'Months 7-12', summary: 'Pursue competitive opportunities, measure and optimize.', lines: months7to12 },
        { title: 'Months 13-18', summary: 'Scale what is working and enter new segments.', lines: months13to18 },
      ]
      buckets.forEach((b) => {
        children.push(new Paragraph({
          children: [new TextRun({ text: b.title, bold: true, size: 24, color: '0A1628' })],
          spacing: { before: 160, after: 60 },
        }))
        children.push(new Paragraph({
          children: [new TextRun({ text: b.summary, italics: true, color: '6B7280', size: 20 })],
          spacing: { after: 80 },
        }))
        b.lines.forEach((line) => children.push(para(lib, `• ${line}`, false, true)))
        blank()
      })

      // 7. Success Metrics
      children.push(new Paragraph({ text: '7. Success Metrics to Track', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }))
      children.push(para(lib, 'Drawn from DCP Stage 7 (Confirmation) signals and Insights decision signals.', false, true))
      const metrics: string[] = []
      stage7Signals.slice(0, 3).forEach((sig) => metrics.push(`Validation signal: ${sig}`))
      decisionSignals.slice(0, 3).forEach((sig) => metrics.push(`Decision signal: ${sig}`))
      metrics.push('Critical capability gaps closed (target: 100% within 90 days)')
      metrics.push('Win rate vs. priority competitors from Section 4 (target: +10 pts over baseline)')
      if (metrics.length < 7) metrics.push('Number of buyer conversations validating revised positioning (target: 3 per quarter)')
      metrics.slice(0, 7).forEach((m, idx) => {
        children.push(para(lib, `${idx + 1}. ${m}`, false, true))
      })

      const doc = new Document({
        creator: 'Assembly AI',
        title: `${company} — Future State Strategic Plan`,
        description: 'Generated by Assembly AI',
        sections: [{ children }],
        styles: {
          paragraphStyles: [
            { id: 'Normal', name: 'Normal', run: { font: 'Calibri', size: 22 } },
          ],
        },
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${company.toLowerCase().replace(/\s+/g, '-')}-future-state-strategic-plan.docx`
      a.click()
      URL.revokeObjectURL(url)
      if (orgId) {
        const ts = new Date().toISOString()
        localStorage.setItem(`c3.report.futureStatePlan.lastGenerated:${orgId}`, ts)
        setFutureStateLastGenerated(ts)
      }
    } catch (e) {
      console.error('Future State DOCX export failed:', e)
    } finally {
      setExportingFutureStateDocx(false)
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

  function Step17CompetitorContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const competitors = extractCompetitors(o.content)
    if (competitors.length === 0) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    return (
      <div style={{ marginTop: '4px' }}>
        {competitors.map((c, i) => (
          <div key={i} style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0A1628', margin: '0 0 6px' }}>
              {c.name}
            </p>
            {c.whyBuyersChooseThem && (
              <p style={bodyStyle}>
                <strong>Why Buyers Choose Them:</strong> {c.whyBuyersChooseThem}
              </p>
            )}
            {c.keyPromise && (
              <p style={bodyStyle}>
                <strong>Their Key Promise:</strong> {c.keyPromise}
              </p>
            )}
            {c.vulnerability && (
              <p style={bodyStyle}>
                <strong>Their Vulnerability:</strong> {c.vulnerability}
              </p>
            )}
          </div>
        ))}
      </div>
    )
  }

  function PainPointLabeledContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    const entries = extractByPainPoint(o, step4PainPoints)
    if (entries.length === 0) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />
    return (
      <div style={{ marginTop: '4px' }}>
        {entries.map((e, i) => (
          <div key={i} style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0A1628', margin: '0 0 4px' }}>
              Pain Point {i + 1}: {e.label}
            </p>
            {e.text && <p style={bodyStyle}>{e.text}</p>}
          </div>
        ))}
      </div>
    )
  }

  function StrategicMessageContent({ id }: { id: string }) {
    const o = getOutput(id)
    const s = getStep(id)
    if (!o || !hasContent(id)) return <NotCompleted stepId={id} title={s?.title ?? `Step ${id}`} />

    // Prefer by_pain_point format (PainPointStepEditor saves)
    const byPainPoint = extractStrategicMessageByPainPoint(o.content)
    if (byPainPoint.length > 0) {
      return (
        <div style={{ marginTop: '4px' }}>
          {byPainPoint.map((e, i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#0A1628', margin: '0 0 4px' }}>
                Pain Point {e.index || i + 1}
              </p>
              <p style={bodyStyle}>{e.content}</p>
            </div>
          ))}
        </div>
      )
    }

    // Fallback to BlendEditor format (mode + per_pain_point + blended)
    const b = extractBlend(o.content)
    if (b.mode === 'blended' && b.blended) return <p style={bodyStyle}>{b.blended}</p>
    const nonEmpty = b.entries.filter(e => e.content.trim().length > 0)
    if (nonEmpty.length > 0) return (
      <div style={{ marginTop: '4px' }}>
        {nonEmpty.map(e => (
          <div key={e.index} style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0A1628', margin: '0 0 4px' }}>
              Pain Point {e.index}
            </p>
            <p style={bodyStyle}>{e.content}</p>
          </div>
        ))}
      </div>
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
    const firstEntry = ap.entries.find(e => e.content.trim().length > 0)
    if (firstEntry) return <p style={bodyStyle}>{firstEntry.content}</p>
    return (
      <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#9CA3AF' }}>Summary not yet written</p>
    )
  }

  function TimeBucketContent({ stepIds }: { stepIds: string[] }) {
    const entries = stepIds.map(id => {
      const o = getOutput(id)
      const s = getStep(id)
      const title = s?.title ?? `Step ${id}`
      if (!o || !hasContent(id)) return { id, title, text: '' }
      const ap = extractActionPlan(o.content)
      if (ap.summary.trim().length > 0) return { id, title, text: ap.summary }
      const firstEntry = ap.entries.find(e => e.content.trim().length > 0)
      return { id, title, text: firstEntry?.content ?? '' }
    })
    const allEmpty = entries.every(e => e.text.length === 0)
    if (allEmpty) {
      return (
        <p style={{ color: '#9CA3AF', fontSize: '13px', fontStyle: 'italic', margin: '4px 0 0' }}>
          Not yet completed
          <span className="screen-only">
            {' — '}
            <Link
              href={`/dashboard/journeys/step/${entries[0]?.id ?? '31'}`}
              style={{ color: '#0EA5E9', textDecoration: 'underline' }}
            >
              Go to {entries[0]?.title ?? 'Action Plan'}
            </Link>
          </span>
        </p>
      )
    }
    return (
      <div style={{ marginTop: '4px' }}>
        {entries.map(e => (
          <div key={e.id} style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0A1628', margin: '0 0 4px' }}>
              {e.title}
            </p>
            {e.text
              ? <p style={bodyStyle}>{e.text}</p>
              : <NotCompleted stepId={e.id} title={e.title} />}
          </div>
        ))}
      </div>
    )
  }

  // Section emptiness — used to set data-empty for PDF onclone hiding
  const COMP_STEP_IDS = ['17','18','20'] as const
  const sec2Empty = COMP_STEP_IDS.every(id => !hasContent(id))
  const sec3Empty = !hasContent('27') && !hasContent('28') && !hasContent('29') && !hasContent('30')
  const sec4Empty = ['31','32','33','34','35','36','37'].every(id => !hasContent(id))
  const sec5Empty = ['31','32','33','34','35','36'].every(id => !hasContent(id))

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
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
            Reports for {org?.name ?? 'your workspace'}
          </span>
        </div>

        {autoBannerState && (
          <div
            className="no-print"
            style={{
              maxWidth: '1280px',
              margin: '76px auto 0',
              padding: '0 32px',
            }}
          >
            <div style={{
              padding: '14px 18px',
              backgroundColor: autoBannerState.kind === 'success' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
              border: `1px solid ${autoBannerState.kind === 'success' ? 'rgba(22,163,74,0.45)' : 'rgba(220,38,38,0.45)'}`,
              borderRadius: '8px',
              color: autoBannerState.kind === 'success' ? '#86EFAC' : '#FCA5A5',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <span>{autoBannerState.message}</span>
              <Link
                href="/dashboard/journeys"
                style={{
                  color: '#FFFFFF',
                  backgroundColor: '#0EA5E9',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                Back to Journeys
              </Link>
            </div>
          </div>
        )}

        {/* Two report sections — Action Plan and Future State Plan */}
        <div
          className="no-print"
          style={{
            padding: '80px 32px 0',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            maxWidth: '1280px',
            margin: '0 auto',
          }}
        >
          {/* ── Action Plan section ── */}
          <div style={{
            backgroundColor: '#0F2140',
            border: '1px solid rgba(255,255,255,0.1)',
            borderLeft: '3px solid #E8520A',
            borderRadius: '10px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div>
              <p style={{
                fontSize: '11px', fontWeight: 700, color: '#E8520A',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                margin: '0 0 8px',
              }}>
                Current State
              </p>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 8px' }}>
                Strategic Action Plan
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
                Compiles Phase 1 foundation, competitive environment, strategic messages, and the 30/60/90 day action plan based on what is true today.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { void handleRefreshActionPlan() }}
                disabled={refreshingPreview}
                style={{
                  minHeight: '44px',
                  padding: '0 20px',
                  backgroundColor: refreshingPreview ? 'rgba(232,82,10,0.5)' : '#E8520A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: refreshingPreview ? 'not-allowed' : 'pointer',
                }}
              >
                {refreshingPreview ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                onClick={() => { void handlePdf() }}
                disabled={generatingPdf}
                style={{
                  minHeight: '44px',
                  padding: '0 20px',
                  backgroundColor: generatingPdf ? 'rgba(14,165,233,0.5)' : '#0EA5E9',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: generatingPdf ? 'not-allowed' : 'pointer',
                }}
              >
                {generatingPdf ? 'Preparing PDF…' : 'Download PDF'}
              </button>
              <button
                onClick={() => { void handleDocx() }}
                disabled={exporting}
                style={{
                  minHeight: '44px',
                  padding: '0 20px',
                  backgroundColor: exporting ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.08)',
                  color: exporting ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                }}
              >
                {exporting ? 'Preparing…' : 'Download Word'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {actionPlanApproved ? (
                <>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    minHeight: '32px', padding: '0 12px',
                    backgroundColor: 'rgba(22,163,74,0.15)',
                    border: '1px solid rgba(22,163,74,0.45)',
                    color: '#16A34A', borderRadius: '999px',
                    fontSize: '12px', fontWeight: 700,
                  }}>
                    ✓ Approved · {formatApprovalDate(actionPlanApproved)}
                  </span>
                  <button
                    onClick={handleRevokeActionPlan}
                    style={{
                      background: 'none', border: 'none',
                      color: 'rgba(255,255,255,0.55)',
                      fontSize: '12px', textDecoration: 'underline',
                      cursor: 'pointer', padding: 0,
                    }}
                  >
                    Revoke Approval
                  </button>
                </>
              ) : (
                <button
                  onClick={handleApproveActionPlan}
                  style={{
                    minHeight: '32px',
                    padding: '0 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#FFFFFF',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Approve as Final
                </button>
              )}
            </div>
            {/* Document preview — Strategic Action Plan body */}
            <div style={{ padding: '0 32px 40px', display: 'flex', justifyContent: 'center' }}>
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
                        {sid === '17' ? <Step17CompetitorContent id={sid} /> : <PainPointLabeledContent id={sid} />}
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

                  {/* ── Section 4: Action Plan ── */}
                  <div data-empty={sec4Empty ? 'true' : undefined}>
                    <div style={{ ...dividerStyle, margin: '40px 0' }} />
                    <h2 style={sectionHeadStyle}>4. Action Plan</h2>
                    {(['31', '32', '33', '34', '35', '36', '37'] as const).map((sid, i) => (
                      <div key={sid}>
                        <p style={subheadStyle}>{getStep(sid)?.title ?? `Step ${sid}`}</p>
                        <ActionPlanSummary id={sid} />
                        {i < 6 && <div style={dividerStyle} />}
                      </div>
                    ))}
                  </div>

                  {/* ── Section 5: 30/60/90 Day Action Plan ── */}
                  <div data-empty={sec5Empty ? 'true' : undefined}>
                    <div style={{ ...dividerStyle, margin: '40px 0' }} />
                    <h2 style={sectionHeadStyle}>5. 30/60/90 Day Action Plan</h2>

                    <p style={subheadStyle}>First 30 Days</p>
                    <TimeBucketContent stepIds={['31', '32']} />

                    <div style={dividerStyle} />

                    <p style={subheadStyle}>Days 31-60</p>
                    <TimeBucketContent stepIds={['33', '34']} />

                    <div style={dividerStyle} />

                    <p style={subheadStyle}>Days 61-90</p>
                    <TimeBucketContent stepIds={['35', '36']} />
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

          {/* ── Future State Plan section ── */}
          <div style={{
            backgroundColor: '#0F2140',
            border: '1px solid rgba(255,255,255,0.1)',
            borderLeft: '3px solid #0EA5E9',
            borderRadius: '10px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div>
              <p style={{
                fontSize: '11px', fontWeight: 700, color: '#0EA5E9',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                margin: '0 0 8px',
              }}>
                Future State · 6-18 months
              </p>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 8px' }}>
                Future State Strategic Plan
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
                6-18 month roadmap that closes capability gaps, captures market opportunities, neutralizes threats, and repositions the brand using Insights output.
              </p>
              {!canGenerateFutureState && (
                <p style={{
                  fontSize: '12px', color: '#D97706', margin: '12px 0 0',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  Locked — complete Intelligence (Gate 1) and generate Insights to unlock.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { void handleGenerateFutureState() }}
                disabled={!canGenerateFutureState || generatingFutureState}
                title={canGenerateFutureState
                  ? 'Generate the 6-18 month Future State Strategic Plan'
                  : 'Complete Intelligence (Gate 1) and generate Insights to unlock the Future State Plan.'}
                style={{
                  minHeight: '44px',
                  padding: '0 20px',
                  backgroundColor: !canGenerateFutureState
                    ? 'rgba(255,255,255,0.06)'
                    : generatingFutureState
                      ? 'rgba(232,82,10,0.5)'
                      : '#E8520A',
                  color: !canGenerateFutureState ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                  border: !canGenerateFutureState ? '1px solid rgba(255,255,255,0.15)' : 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: !canGenerateFutureState || generatingFutureState ? 'not-allowed' : 'pointer',
                }}
              >
                {generatingFutureState ? 'Generating…' : 'Refresh'}
              </button>
              {futureStateData && canGenerateFutureState && (
                <>
                  <button
                    onClick={() => { void handleFutureStatePdf() }}
                    disabled={generatingFutureState}
                    style={{
                      minHeight: '44px',
                      padding: '0 20px',
                      backgroundColor: generatingFutureState ? 'rgba(14,165,233,0.5)' : '#0EA5E9',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: generatingFutureState ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {generatingFutureState ? 'Preparing PDF…' : 'Download PDF'}
                  </button>
                  <button
                    onClick={() => { void handleFutureStateDocx() }}
                    disabled={exportingFutureStateDocx}
                    style={{
                      minHeight: '44px',
                      padding: '0 20px',
                      backgroundColor: exportingFutureStateDocx ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.08)',
                      color: exportingFutureStateDocx ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: exportingFutureStateDocx ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {exportingFutureStateDocx ? 'Preparing…' : 'Download Word'}
                  </button>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {futureStateApproved ? (
                <>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    minHeight: '32px', padding: '0 12px',
                    backgroundColor: 'rgba(22,163,74,0.15)',
                    border: '1px solid rgba(22,163,74,0.45)',
                    color: '#16A34A', borderRadius: '999px',
                    fontSize: '12px', fontWeight: 700,
                  }}>
                    ✓ Approved · {formatApprovalDate(futureStateApproved)}
                  </span>
                  <button
                    onClick={handleRevokeFutureState}
                    style={{
                      background: 'none', border: 'none',
                      color: 'rgba(255,255,255,0.55)',
                      fontSize: '12px', textDecoration: 'underline',
                      cursor: 'pointer', padding: 0,
                    }}
                  >
                    Revoke Approval
                  </button>
                </>
              ) : (
                <button
                  onClick={handleApproveFutureState}
                  disabled={!canGenerateFutureState}
                  style={{
                    minHeight: '32px',
                    padding: '0 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: canGenerateFutureState ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: canGenerateFutureState ? 'pointer' : 'not-allowed',
                  }}
                >
                  Approve as Final
                </button>
              )}
            </div>
            {/* Document preview — Future State Strategic Plan body */}
            {futureStateData && (() => {
              const data = futureStateData
              const { company, dcpConf, insightsConf, gapItems, opportunities, threats, retaliations, threatPairCount,
                internalExternalInsights, brandPerceptionInsights, months1to3, months4to6, months7to12, months13to18, metrics } = data

              return (
                <div style={{ padding: '0 32px 40px', display: 'flex', justifyContent: 'center' }}>
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
                        borderTop: '6px solid #0EA5E9',
                      }}
                    >
                      <div>
                        {org?.logo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={org.logo_url} alt="Company logo" style={{ maxHeight: '48px', marginBottom: '24px', objectFit: 'contain' }} />
                        )}
                        <div style={{ color: '#0EA5E9', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700 }}>
                          Future State Strategic Plan · 6-18 Months
                        </div>
                        <h1 style={{ color: '#FFFFFF', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                          {company}
                        </h1>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '40px' }}>
                        Generated {today} · Assembly AI
                      </div>
                    </div>

                    <div style={{ padding: '48px 48px 20px' }}>

                      {/* 1. Executive Summary */}
                      <h2 style={sectionHeadStyle}>1. Executive Summary</h2>
                      <p style={bodyStyle}>
                        {company} has completed Phase 1 buyer research with an overall Decision Clarity Profile confidence of {dcpConf}/100. Insights analysis surfaced patterns across six intelligence categories with an aggregate confidence of {insightsConf}/100. These signals form the foundation for the future state strategy outlined in this plan.
                      </p>
                      <p style={bodyStyle}>
                        This Future State Strategic Plan is the companion to the current state Strategic Plan. While the current state plan describes the actions to take today based on what is true, this plan describes the 6-18 month strategic agenda to close capability gaps, capture market opportunities, neutralize competitive threats, and reposition the brand to align with how buyers actually evaluate solutions.
                      </p>
                      <p style={bodyStyle}>
                        Execute the roadmap in sequence: close critical capability gaps first, pursue quick-win market opportunities next, then execute longer-horizon competitive and brand initiatives. Track the success metrics in Section 7 to measure progress toward the future state.
                      </p>

                      {/* 2. Capability Gap Roadmap */}
                      <div style={{ ...dividerStyle, margin: '40px 0' }} />
                      <h2 style={sectionHeadStyle}>2. Priority Capability Gaps to Address</h2>
                      {gapItems.length === 0 ? (
                        <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#9CA3AF' }}>
                          No critical or high gaps identified. Complete Steps 13 and 14 to surface capability gaps.
                        </p>
                      ) : (
                        <div style={{ marginTop: '4px' }}>
                          {gapItems.map((gap, idx) => {
                            const isCritical = gap.gapLevel === 'critical'
                            const badgeColor = isCritical ? '#DC2626' : '#E8520A'
                            const badgeLabel = isCritical ? 'CRITICAL' : 'HIGH'
                            const timeline = isCritical ? '30 days' : '60-90 days'
                            return (
                              <div key={idx} style={{ marginBottom: '20px' }}>
                                <p style={{ fontSize: '14px', fontWeight: 700, color: '#0A1628', margin: '0 0 6px' }}>
                                  {idx + 1}. {gap.label || 'Untitled gap'}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px', flexWrap: 'wrap' }}>
                                  <span style={{
                                    display: 'inline-block', padding: '2px 8px',
                                    backgroundColor: badgeColor, color: '#FFFFFF',
                                    borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                                  }}>
                                    {badgeLabel}
                                  </span>
                                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                                    {gap.source} · Close within {timeline}
                                  </span>
                                </div>
                                {gap.description && (
                                  <p style={{ ...bodyStyle, margin: '0 0 6px' }}>
                                    <strong style={{ color: '#0A1628' }}>Current state:</strong> {gap.description}
                                  </p>
                                )}
                                {gap.notes && (
                                  <p style={{ ...bodyStyle, margin: '0 0 6px' }}>
                                    <strong style={{ color: '#0A1628' }}>Notes:</strong> {gap.notes}
                                  </p>
                                )}
                                <p style={{ ...bodyStyle, margin: 0 }}>
                                  <strong style={{ color: '#0A1628' }}>Recommended action:</strong>{' '}
                                  {isCritical
                                    ? 'Decide within 30 days whether to build, hire for, or partner to close this gap. This capability is promised in the CVP and cannot be deferred.'
                                    : 'Plan a 60-90 day initiative to strengthen this capability. Assign an owner and document a measurable target.'}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* 3. Competitive Opportunity Map */}
                      <div style={{ ...dividerStyle, margin: '40px 0' }} />
                      <h2 style={sectionHeadStyle}>3. Market Opportunities to Pursue</h2>
                      {opportunities.length === 0 ? (
                        <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#9CA3AF' }}>
                          No competitive opportunities recorded yet. Complete Step 25 to identify market openings.
                        </p>
                      ) : (
                        <div style={{ marginTop: '4px' }}>
                          {opportunities.map((opp, idx) => (
                            <div key={idx} style={{ marginBottom: '14px' }}>
                              <p style={{ fontSize: '13px', fontWeight: 700, color: '#0A1628', margin: '0 0 4px' }}>
                                {idx + 1}. {opp.label}
                              </p>
                              {opp.text && <p style={bodyStyle}>{opp.text}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 4. Competitive Threat Response */}
                      <div style={{ ...dividerStyle, margin: '40px 0' }} />
                      <h2 style={sectionHeadStyle}>4. Competitive Threats and Response Strategies</h2>
                      {threatPairCount === 0 ? (
                        <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#9CA3AF' }}>
                          No competitive threats or retaliation strategies recorded yet. Complete Steps 20 and 24.
                        </p>
                      ) : (
                        <div style={{ marginTop: '4px' }}>
                          {Array.from({ length: threatPairCount }).map((_, i) => {
                            const t = threats[i]
                            const r = retaliations[i]
                            const label = t?.label || r?.label || `Pain Point ${i + 1}`
                            return (
                              <div key={i} style={{ marginBottom: '16px' }}>
                                <p style={{ fontSize: '14px', fontWeight: 700, color: '#0A1628', margin: '0 0 6px' }}>
                                  {label}
                                </p>
                                {t?.text && (
                                  <p style={{ ...bodyStyle, margin: '0 0 6px' }}>
                                    <strong style={{ color: '#DC2626' }}>Threat:</strong> {t.text}
                                  </p>
                                )}
                                {r?.text && (
                                  <p style={bodyStyle}>
                                    <strong style={{ color: '#0EA5E9' }}>Retaliation strategy:</strong> {r.text}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* 5. Brand Repositioning */}
                      <div style={{ ...dividerStyle, margin: '40px 0' }} />
                      <h2 style={sectionHeadStyle}>5. Brand and Positioning Recommendations</h2>
                      <p style={{ ...subheadStyle, marginTop: '12px' }}>Internal vs External Gaps</p>
                      <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#6B7280' }}>
                        Where the team&apos;s beliefs differ from what real buyers said.
                      </p>
                      {internalExternalInsights.length > 0 ? (
                        <ul style={{ paddingLeft: '20px', margin: '8px 0 0' }}>
                          {internalExternalInsights.map((item, i) => (
                            <li key={i} style={bodyStyle}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#9CA3AF' }}>No findings in this category.</p>
                      )}

                      <p style={{ ...subheadStyle, marginTop: '20px' }}>Brand Perception Gaps</p>
                      <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#6B7280' }}>
                        How buyers describe you vs. how you describe yourself — close this gap with deliberate messaging.
                      </p>
                      {brandPerceptionInsights.length > 0 ? (
                        <ul style={{ paddingLeft: '20px', margin: '8px 0 0' }}>
                          {brandPerceptionInsights.map((item, i) => (
                            <li key={i} style={bodyStyle}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#9CA3AF' }}>No findings in this category.</p>
                      )}

                      <p style={{ ...subheadStyle, marginTop: '20px' }}>Repositioning Recommendation</p>
                      <p style={bodyStyle}>
                        Use the gaps above to adjust positioning, website copy, sales collateral, and pitch language so the external story matches how buyers describe the problem and the desired outcome. Validate the revised positioning with three customer conversations before rolling out broadly.
                      </p>

                      {/* 6. 6-18 Month Roadmap */}
                      <div style={{ ...dividerStyle, margin: '40px 0' }} />
                      <h2 style={sectionHeadStyle}>6. 6-18 Month GTM Roadmap</h2>
                      {([
                        { title: 'Months 1-3', summary: 'Close critical gaps and launch quick-win opportunities.', lines: months1to3 },
                        { title: 'Months 4-6', summary: 'Execute competitive retaliation and begin brand repositioning.', lines: months4to6 },
                        { title: 'Months 7-12', summary: 'Pursue competitive opportunities, measure and optimize.', lines: months7to12 },
                        { title: 'Months 13-18', summary: 'Scale what is working and enter new segments.', lines: months13to18 },
                      ]).map((bucket, idx) => (
                        <div key={idx} style={{
                          borderLeft: '3px solid #E8520A',
                          padding: '4px 0 4px 14px',
                          marginBottom: '18px',
                        }}>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: '#0A1628', margin: '0 0 4px' }}>
                            {bucket.title}
                          </p>
                          <p style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic', margin: '0 0 8px' }}>
                            {bucket.summary}
                          </p>
                          <ul style={{ paddingLeft: '20px', margin: 0 }}>
                            {bucket.lines.map((line, i) => (
                              <li key={i} style={bodyStyle}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ))}

                      {/* 7. Success Metrics */}
                      <div style={{ ...dividerStyle, margin: '40px 0' }} />
                      <h2 style={sectionHeadStyle}>7. Success Metrics to Track</h2>
                      <p style={{ ...bodyStyle, fontStyle: 'italic', color: '#6B7280' }}>
                        Drawn from DCP Stage 7 (Confirmation) signals and Insights decision signals.
                      </p>
                      <ol style={{ paddingLeft: '24px', margin: '12px 0 0' }}>
                        {metrics.slice(0, 7).map((m, i) => (
                          <li key={i} style={bodyStyle}>{m}</li>
                        ))}
                      </ol>

                      {/* Footer */}
                      <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Generated {today}</span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Assembly AI · Future State Plan</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

      </div>
    </>
  )
}
