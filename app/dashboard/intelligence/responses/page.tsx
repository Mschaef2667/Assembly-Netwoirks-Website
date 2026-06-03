'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Upload, UserPlus, CheckCircle2, Users, ChevronDown, List, X, Search, Eye, Trash2, Sparkles, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type Audience = 'internal' | 'current' | 'lost' | 'potential'

interface Segment {
  id: string
  name: string
  slug: string
}

interface SurveyQuestion {
  id: string
  text: string
  stageId: number
}

interface ParsedRow {
  [col: string]: string
}

interface ImportResponseRow {
  respondent_name?: string
  respondent_title?: string
  respondent_company?: string
  respondent_size?: string
  decision_role?: string
  answers: Record<string, string>
}

interface RecentResponse {
  id: string
  respondent_name: string | null
  respondent_title: string | null
  audience: string
  submitted_at: string
}

interface ViewResponse {
  id: string
  survey_link_id: string
  respondent_name: string | null
  respondent_title: string | null
  respondent_company: string | null
  respondent_size: string | null
  decision_role: string | null
  audience: string
  segment_slug: string
  answers: Record<string, string>
  submitted_at: string
  source: string | null
}

interface SimulatedRespondent {
  name: string
  title: string
  company: string
  company_size: string
  decision_role: string
}

interface SimulatedResponseCard {
  id: string
  respondent: SimulatedRespondent
  answers: Record<string, string>
  questions: SurveyQuestion[]
  audience: string
  segmentSlug: string
  segmentName: string
  accepted: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIENCE_LABELS: Record<Audience, string> = {
  internal: 'Internal Stakeholders',
  current: 'Current Customers',
  lost: 'Lost Customers',
  potential: 'Potential Customers',
}

const AUDIENCES: Audience[] = ['internal', 'current', 'lost', 'potential']

const SOURCE_LABELS: Record<string, string> = {
  link: 'Survey Link',
  manual: 'Manual Entry',
  csv: 'CSV Upload',
  simulated: 'Copilot Simulated',
}

const STAGE_NAMES: Record<number, string> = {
  1: 'Need Recognition',
  2: 'Motivation to Act',
  3: 'Information Search',
  4: 'Evaluation of Alternatives',
  5: 'Select Set',
  6: 'Purchase Decision',
  7: 'Confirmation',
}

const PAGE_SIZE = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return { headers: [], rows: [] }

  function splitLine(line: string): string[] {
    const cells: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (c === ',' && !inQ) {
        cells.push(cur); cur = ''
      } else cur += c
    }
    cells.push(cur)
    return cells
  }

  const headers = splitLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const cells = splitLine(line)
    const row: ParsedRow = {}
    headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
    return row
  })
  return { headers, rows }
}

function parseSegments(content: Record<string, unknown>): Segment[] {
  if (Array.isArray(content['segments'])) {
    return (content['segments'] as Array<Record<string, unknown>>)
      .filter(s => typeof s['name'] === 'string' && (s['name'] as string).trim())
      .slice(0, 3)
      .map(s => {
        const name = (s['name'] as string).trim()
        return { id: name, name, slug: name.toLowerCase().replace(/\s+/g, '-') }
      })
  }
  const segs: Segment[] = []
  for (let i = 1; i <= 3; i++) {
    const raw = content[`segment_${i}_name`] ?? content[`segment_name_${i}`]
    if (typeof raw === 'string' && raw.trim()) {
      const name = raw.trim()
      segs.push({ id: name, name, slug: name.toLowerCase().replace(/\s+/g, '-') })
    }
  }
  return segs
}

function autoMapColumns(headers: string[], questions: SurveyQuestion[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) {
    const l = h.toLowerCase()
    if ((l.includes('name') || l.includes('respondent')) && !l.includes('company') && !l.includes('org')) {
      map[h] = 'respondent_name'
    } else if (l.includes('title') || l.includes('position') || l.includes('job')) {
      map[h] = 'respondent_title'
    } else if (l.includes('company') || l.includes('organization') || l.includes(' org')) {
      map[h] = 'respondent_company'
    } else if (l.includes('size') || l.includes('employees') || l.includes('headcount')) {
      map[h] = 'respondent_size'
    } else if (l.includes('decision') && l.includes('role')) {
      map[h] = 'decision_role'
    } else {
      const stageMatch = h.match(/^\[Stage\s+(\d+)/)
      if (stageMatch) {
        const stageId = parseInt(stageMatch[1], 10)
        const stageQs = questions.filter(q => q.stageId === stageId)
        map[h] = stageQs.length > 0 ? `q_${stageQs[0].id}` : 'skip'
      } else {
        map[h] = 'skip'
      }
    }
  }
  return map
}

function buildResponses(rows: ParsedRow[], columnMap: Record<string, string>): ImportResponseRow[] {
  return rows.map(row => {
    const r: ImportResponseRow = { answers: {} }
    for (const [col, field] of Object.entries(columnMap)) {
      if (!field || field === 'skip') continue
      const val = (row[col] ?? '').trim()
      if (!val) continue
      if (field === 'respondent_name') r.respondent_name = val
      else if (field === 'respondent_title') r.respondent_title = val
      else if (field === 'respondent_company') r.respondent_company = val
      else if (field === 'respondent_size') r.respondent_size = val
      else if (field === 'decision_role') r.decision_role = val
      else if (field.startsWith('q_')) r.answers[field.slice(2)] = val
    }
    return r
  })
}

async function fetchQuestionsForAudience(
  orgId: string,
  audience: Audience,
  segment: Segment | null,
): Promise<SurveyQuestion[]> {
  const slug = segment?.slug ?? 'all-segments'
  const stepId = `survey-builder-${audience}-${slug}`
  try {
    const { data } = await supabase
      .from('step_output')
      .select('content')
      .eq('workspace_id', orgId)
      .eq('step_id', stepId)
      .maybeSingle()
    if (!data) return []
    const content = (data as Record<string, unknown>)['content'] as Record<string, unknown>
    const questionsMap = (content['questions'] ?? content) as Record<string, unknown>
    const questions: SurveyQuestion[] = []
    for (let stage = 1; stage <= 7; stage++) {
      const stageQs = questionsMap[String(stage)]
      if (!Array.isArray(stageQs)) continue
      for (const q of stageQs as Array<Record<string, unknown>>) {
        if (typeof q['id'] === 'string' && typeof q['text'] === 'string') {
          questions.push({ id: q['id'] as string, text: q['text'] as string, stageId: stage })
        }
      }
    }
    return questions
  } catch {
    return []
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function countAnswers(answers: Record<string, string>): number {
  return Object.values(answers).filter(v => typeof v === 'string' && v.trim().length > 0).length
}

// ── Shared select component ───────────────────────────────────────────────────

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{
        fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '10px 32px 10px 12px', fontSize: '14px',
            color: '#FFFFFF', backgroundColor: '#1A3050',
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
            appearance: 'none', cursor: 'pointer', outline: 'none',
          }}
        >
          {options.map(o => (
            <option key={o.value} value={o.value} style={{ backgroundColor: '#1A3050', color: '#FFFFFF' }}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResponseImportPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [segments, setSegments] = useState<Segment[]>([])
  const [activeTab, setActiveTab] = useState<'csv' | 'manual' | 'view' | 'simulate'>('csv')

  // CSV tab
  const [csvAudience, setCsvAudience] = useState<Audience>('current')
  const [csvSegment, setCsvSegment] = useState<Segment | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [isDragOver, setIsDragOver] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null)
  const [csvQuestions, setCsvQuestions] = useState<SurveyQuestion[]>([])
  const [csvQuestionsLoading, setCsvQuestionsLoading] = useState(false)

  // Manual tab
  const [manAudience, setManAudience] = useState<Audience>('current')
  const [manSegment, setManSegment] = useState<Segment | null>(null)
  const [manName, setManName] = useState('')
  const [manTitle, setManTitle] = useState('')
  const [manCompany, setManCompany] = useState('')
  const [manSize, setManSize] = useState('')
  const [manDecisionRole, setManDecisionRole] = useState('')
  const [manAnswers, setManAnswers] = useState<Record<string, string>>({})
  const [manQuestions, setManQuestions] = useState<SurveyQuestion[]>([])
  const [manQuestionsLoading, setManQuestionsLoading] = useState(false)
  const [manSaving, setManSaving] = useState(false)
  const [manError, setManError] = useState<string | null>(null)
  const [manSuccess, setManSuccess] = useState(false)

  // Simulate tab
  const [simSegment, setSimSegment] = useState<Segment | null>(null)
  const [simCount, setSimCount] = useState<number>(3)
  const [simGenerating, setSimGenerating] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)
  const [simResponses, setSimResponses] = useState<SimulatedResponseCard[]>([])
  const [simAccepting, setSimAccepting] = useState<Record<string, boolean>>({})

  // Summary
  const [audienceCounts, setAudienceCounts] = useState<Record<Audience, number>>({
    internal: 0, current: 0, lost: 0, potential: 0,
  })
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  // View Responses tab
  const [viewResponses, setViewResponses] = useState<ViewResponse[]>([])
  const [viewLoading, setViewLoading] = useState(false)
  const [viewFilterAudience, setViewFilterAudience] = useState('')
  const [viewFilterSegment, setViewFilterSegment] = useState('')
  const [viewSearch, setViewSearch] = useState('')
  const [viewPage, setViewPage] = useState(0)
  const [selectedResponse, setSelectedResponse] = useState<ViewResponse | null>(null)
  const [detailQuestions, setDetailQuestions] = useState<SurveyQuestion[]>([])
  const [detailQuestionsLoading, setDetailQuestionsLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [viewFilterSource, setViewFilterSource] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const orgIdRef = useRef<string | null>(null)
  const hasBackfilledRef = useRef(false)

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    void init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Backfill null source values for existing records
  useEffect(() => {
    if (!orgId || hasBackfilledRef.current) return
    hasBackfilledRef.current = true
    void (async () => {
      try {
        await supabase
          .from('survey_link_responses')
          .update({ source: 'link' })
          .eq('org_id', orgId)
          .is('source', null)
          .not('survey_link_id', 'is', null)
        await supabase
          .from('survey_link_responses')
          .update({ source: 'manual' })
          .eq('org_id', orgId)
          .is('source', null)
          .is('survey_link_id', null)
      } catch {
        // non-fatal
      }
    })()
  }, [orgId])

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userRow } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (!userRow) return
      const oid = (userRow as Record<string, unknown>)['org_id'] as string
      orgIdRef.current = oid
      setOrgId(oid)

      const { data: step2 } = await supabase
        .from('step_output')
        .select('content')
        .eq('workspace_id', oid)
        .eq('step_id', '2')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (step2) {
        const segs = parseSegments((step2 as Record<string, unknown>)['content'] as Record<string, unknown>)
        setSegments(segs)
        if (segs.length > 0) {
          setCsvSegment(segs[0])
          setManSegment(segs[0])
          setSimSegment(segs[0])
        }
      }

      await loadStats(oid)
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  async function loadStats(oid: string) {
    setStatsLoading(true)
    try {
      const { data } = await supabase
        .from('survey_link_responses')
        .select('id, respondent_name, respondent_title, audience, submitted_at')
        .eq('org_id', oid)
        .order('submitted_at', { ascending: false })
        .limit(100)

      if (data) {
        const rows = data as RecentResponse[]
        const counts: Record<Audience, number> = { internal: 0, current: 0, lost: 0, potential: 0 }
        for (const r of rows) {
          const a = r.audience as Audience
          if (a in counts) counts[a]++
        }
        setAudienceCounts(counts)
        setRecentResponses(rows.slice(0, 15))
      }
    } catch {
      // non-fatal — table may not exist yet
    } finally {
      setStatsLoading(false)
    }
  }

  // ── View Responses tab — load data ────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'view' && orgId) {
      void loadViewResponses(orgId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, orgId])

  // Reset pagination when filters change
  useEffect(() => {
    setViewPage(0)
  }, [viewFilterAudience, viewFilterSegment, viewSearch, viewFilterSource])

  // Load detail questions when a response is selected — try survey_links snapshot first, fall back to step_output
  useEffect(() => {
    if (!selectedResponse || !orgId) {
      setDetailQuestions([])
      return
    }
    setDetailQuestionsLoading(true)
    void (async () => {
      let qs: SurveyQuestion[] = []
      if (selectedResponse.survey_link_id) {
        try {
          const { data } = await supabase
            .from('survey_links')
            .select('questions')
            .eq('id', selectedResponse.survey_link_id)
            .maybeSingle()
          if (data) {
            const raw = (data as Record<string, unknown>)['questions'] as Array<Record<string, unknown>> | null
            if (Array.isArray(raw) && raw.length > 0) {
              qs = raw.map(q => ({
                id: q['id'] as string,
                text: q['text'] as string,
                stageId: (q['stageId'] ?? q['stage_id']) as number,
              }))
            }
          }
        } catch {
          // fall through to step_output
        }
      }
      if (qs.length === 0) {
        const seg = segments.find(s => s.slug === selectedResponse.segment_slug) ?? null
        qs = await fetchQuestionsForAudience(orgId, selectedResponse.audience as Audience, seg)
      }
      setDetailQuestions(qs)
      setDetailQuestionsLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResponse, orgId])

  async function loadViewResponses(oid: string) {
    setViewLoading(true)
    try {
      const { data, error } = await supabase
        .from('survey_link_responses')
        .select('id, survey_link_id, respondent_name, respondent_title, respondent_company, respondent_size, decision_role, audience, segment_slug, answers, submitted_at, source')
        .eq('org_id', oid)
        .order('submitted_at', { ascending: false })

      if (!error && data) {
        const rows = (data as unknown as ViewResponse[]).map(r => ({
          ...r,
          source: r.source ?? (r.survey_link_id ? 'link' : 'manual'),
        }))
        setViewResponses(rows)
      }
    } catch {
      // non-fatal
    } finally {
      setViewLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!orgId) return
    const deleted = viewResponses.find(r => r.id === id)
    setDeletingId(id)
    setDeleteError(null)
    try {
      const res = await fetch('/api/intelligence/delete-response', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId: id }),
      })
      const body = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Delete failed')
      setViewResponses(prev => prev.filter(r => r.id !== id))
      if (deleted) {
        const a = deleted.audience as Audience
        setAudienceCounts(prev => ({
          ...prev,
          [a]: Math.max(0, (prev[a] ?? 0) - 1),
        }))
        setRecentResponses(prev => prev.filter(r => r.id !== id))
      }
      if (selectedResponse?.id === id) setSelectedResponse(null)
      setDeleteConfirmId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed. Please try again.')
      setDeleteConfirmId(null)
    } finally {
      setDeletingId(null)
    }
  }

  // ── CSV questions re-load when audience/segment changes ───────────────────────

  useEffect(() => {
    if (!orgId) return
    setCsvQuestionsLoading(true)
    void fetchQuestionsForAudience(orgId, csvAudience, csvSegment).then(qs => {
      setCsvQuestions(qs)
      if (csvHeaders.length > 0) setColumnMap(autoMapColumns(csvHeaders, qs))
      setCsvQuestionsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvAudience, csvSegment, orgId])

  // ── Manual questions re-load when audience/segment changes ────────────────────

  useEffect(() => {
    if (!orgId) return
    setManQuestionsLoading(true)
    setManAnswers({})
    void fetchQuestionsForAudience(orgId, manAudience, manSegment).then(qs => {
      setManQuestions(qs)
      setManQuestionsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manAudience, manSegment, orgId])

  // ── CSV file handling ─────────────────────────────────────────────────────────

  function loadFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result
      if (typeof text !== 'string') return
      const { headers, rows } = parseCSV(text)
      setCsvHeaders(headers)
      setCsvRows(rows)
      setColumnMap(autoMapColumns(headers, csvQuestions))
      setCsvError(null)
      setCsvSuccess(null)
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  // ── CSV import ────────────────────────────────────────────────────────────────

  async function handleCsvImport() {
    if (!orgId || csvRows.length === 0) return
    const segName = csvSegment?.name ?? 'All Segments'
    const segSlug = csvSegment?.slug ?? 'all-segments'
    const responses = buildResponses(csvRows, columnMap)

    setCsvImporting(true)
    setCsvError(null)
    setCsvSuccess(null)
    try {
      const res = await fetch('/api/intelligence/import-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, audience: csvAudience, segmentSlug: segSlug, segmentName: segName, responses, source: 'csv' }),
      })
      const body = await res.json() as { success?: boolean; count?: number; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Import failed')
      setCsvSuccess(`${body.count ?? responses.length} response${(body.count ?? responses.length) !== 1 ? 's' : ''} imported successfully.`)
      setCsvHeaders([])
      setCsvRows([])
      setColumnMap({})
      await loadStats(orgId)
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setCsvImporting(false)
    }
  }

  // ── Manual save ───────────────────────────────────────────────────────────────

  async function handleManualSave() {
    if (!orgId) return
    const segName = manSegment?.name ?? 'All Segments'
    const segSlug = manSegment?.slug ?? 'all-segments'

    setManSaving(true)
    setManError(null)
    setManSuccess(false)
    try {
      const res = await fetch('/api/intelligence/import-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          audience: manAudience,
          segmentSlug: segSlug,
          segmentName: segName,
          responses: [{
            respondent_name: manName || undefined,
            respondent_title: manTitle || undefined,
            respondent_company: manCompany || undefined,
            respondent_size: manSize || undefined,
            decision_role: manDecisionRole || undefined,
            answers: manAnswers,
          }],
          source: 'manual',
        }),
      })
      const body = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Save failed')
      setManSuccess(true)
      setManName(''); setManTitle(''); setManCompany(''); setManSize(''); setManDecisionRole('')
      setManAnswers({})
      await loadStats(orgId)
    } catch (err) {
      setManError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setManSaving(false)
    }
  }

  // ── Simulate handlers ─────────────────────────────────────────────────────────

  async function handleSimulateGenerate() {
    if (!orgId) return
    const segName = simSegment?.name ?? 'All Segments'
    const segSlug = simSegment?.slug ?? 'all-segments'

    setSimGenerating(true)
    setSimError(null)
    setSimResponses([])
    try {
      const res = await fetch('/api/intelligence/simulate-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience: 'simulated',
          segmentSlug: segSlug,
          segmentName: segName,
          count: simCount,
        }),
      })
      const body = await res.json() as {
        responses?: Array<{ respondent: SimulatedRespondent; answers: Record<string, string> }>
        questions?: SurveyQuestion[]
        error?: string
      }
      if (!res.ok) throw new Error(body.error ?? 'Generation failed')
      const responses = body.responses ?? []
      const questions = body.questions ?? []
      const cards: SimulatedResponseCard[] = responses.map((r, i) => ({
        id: `sim_${Date.now()}_${i}`,
        respondent: r.respondent,
        answers: r.answers,
        questions,
        audience: 'simulated',
        segmentSlug: segSlug,
        segmentName: segName,
        accepted: false,
      }))
      setSimResponses(cards)
    } catch (err) {
      setSimError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setSimGenerating(false)
    }
  }

  async function handleAcceptSimulated(card: SimulatedResponseCard) {
    if (!orgId) return
    setSimAccepting(prev => ({ ...prev, [card.id]: true }))
    try {
      const res = await fetch('/api/intelligence/accept-simulated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondent: card.respondent,
          answers: card.answers,
          audience: card.audience,
          segmentSlug: card.segmentSlug,
          segmentName: card.segmentName,
        }),
      })
      const body = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Failed to save response')
      setSimResponses(prev => prev.map(r => r.id === card.id ? { ...r, accepted: true } : r))
      await loadStats(orgId)
    } catch (err) {
      setSimError(err instanceof Error ? err.message : 'Failed to save response')
    } finally {
      setSimAccepting(prev => ({ ...prev, [card.id]: false }))
    }
  }

  function handleDeclineSimulated(cardId: string) {
    setSimResponses(prev => prev.filter(r => r.id !== cardId))
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  const audienceOptions = AUDIENCES.map(a => ({ value: a, label: AUDIENCE_LABELS[a] }))
  const segmentOptions = segments.length === 0
    ? [{ value: '__all', label: 'All Segments' }]
    : segments.map(s => ({ value: s.id, label: s.name }))

  const csvFieldOptions = [
    { value: 'skip', label: '— Skip —' },
    { value: 'respondent_name', label: 'Respondent Name' },
    { value: 'respondent_title', label: 'Job Title' },
    { value: 'respondent_company', label: 'Company' },
    { value: 'respondent_size', label: 'Company Size' },
    { value: 'decision_role', label: 'Decision Role' },
    ...csvQuestions.map((q, i) => ({
      value: `q_${q.id}`,
      label: `Q${i + 1}: ${q.text.length > 48 ? q.text.slice(0, 48) + '…' : q.text}`,
    })),
  ]

  const totalResponses = Object.values(audienceCounts).reduce((a, b) => a + b, 0)

  // View tab computed values
  const filteredResponses = viewResponses.filter(r => {
    if (viewFilterAudience && r.audience !== viewFilterAudience) return false
    if (viewFilterSegment && r.segment_slug !== viewFilterSegment) return false
    if (viewFilterSource && r.source !== viewFilterSource) return false
    if (viewSearch.trim()) {
      const q = viewSearch.toLowerCase()
      const haystack = [r.respondent_name, r.respondent_title, r.respondent_company]
        .filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
  const totalPages = Math.ceil(filteredResponses.length / PAGE_SIZE)
  const pagedResponses = filteredResponses.slice(viewPage * PAGE_SIZE, (viewPage + 1) * PAGE_SIZE)

  function segmentNameFromSlug(slug: string): string {
    const seg = segments.find(s => s.slug === slug)
    if (seg) return seg.name
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const CARD: React.CSSProperties = {
    backgroundColor: '#0F2140',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '24px',
  }

  // Detail panel: group questions by stage
  const stageGroups: Record<number, SurveyQuestion[]> = {}
  for (const q of detailQuestions) {
    if (!stageGroups[q.stageId]) stageGroups[q.stageId] = []
    stageGroups[q.stageId].push(q)
  }

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>

      {/* Header */}
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Response Manager
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          Import survey responses from external tools or add them manually
        </p>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {([
            { key: 'csv' as const, icon: Upload, label: 'Upload CSV' },
            { key: 'manual' as const, icon: UserPlus, label: 'Add Manually' },
            { key: 'simulate' as const, icon: Sparkles, label: 'Simulate with Copilot' },
            { key: 'view' as const, icon: List, label: 'View Responses' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 20px', minHeight: '44px', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 600, borderRadius: '8px 8px 0 0',
                backgroundColor: activeTab === key ? '#0F2140' : 'transparent',
                color: activeTab === key ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                borderBottom: activeTab === key ? '2px solid #E8520A' : '2px solid transparent',
                transition: 'color 0.15s, background-color 0.15s',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── CSV Tab ─────────────────────────────────────────────────────────── */}
        {activeTab === 'csv' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Audience + Segment */}
            <div style={CARD}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <LabeledSelect
                  label="Audience"
                  value={csvAudience}
                  onChange={v => { setCsvAudience(v as Audience) }}
                  options={audienceOptions}
                />
                <LabeledSelect
                  label="Segment"
                  value={csvSegment?.id ?? '__all'}
                  onChange={v => setCsvSegment(v === '__all' ? null : (segments.find(s => s.id === v) ?? null))}
                  options={segmentOptions}
                />
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                backgroundColor: isDragOver ? 'rgba(232,82,10,0.06)' : '#0F2140',
                border: `2px dashed ${isDragOver ? '#E8520A' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '12px', padding: '48px 24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                cursor: 'pointer', transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              <Upload size={36} style={{ color: isDragOver ? '#E8520A' : 'rgba(255,255,255,0.35)' }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                  Drop a CSV file here, or click to browse
                </p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '6px 0 0' }}>
                  Accepts CSV exports from Google Forms, Typeform, HubSpot, or any survey tool
                </p>
              </div>
              {csvHeaders.length > 0 && (
                <span style={{
                  padding: '4px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                  backgroundColor: 'rgba(14,165,233,0.15)', color: '#0EA5E9',
                }}>
                  {csvRows.length} rows · {csvHeaders.length} columns loaded
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Preview + Column mapper */}
            {csvHeaders.length > 0 && (
              <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>

                {/* Preview table */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 12px' }}>
                    Preview — first {Math.min(5, csvRows.length)} of {csvRows.length} rows
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '100%' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#0A1628' }}>
                          {csvHeaders.map((h, i) => (
                            <th
                              key={i}
                              title={h}
                              style={{
                                padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.5)',
                                fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                                whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}
                            >
                              {h.length > 22 ? h.slice(0, 22) + '…' : h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 5).map((row, ri) => (
                          <tr key={ri} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            {csvHeaders.map((h, ci) => (
                              <td
                                key={ci}
                                style={{
                                  padding: '8px 12px', color: 'rgba(255,255,255,0.8)', fontSize: '12px',
                                  maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                              >
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Column mapping */}
                <div style={{ padding: '20px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px' }}>
                    Map Columns
                  </p>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>
                    Match each column to a field. Unmapped columns are skipped.
                    {csvQuestionsLoading && (
                      <span style={{ color: '#0EA5E9', marginLeft: '8px' }}>
                        <Loader2 size={11} className="animate-spin" style={{ display: 'inline', marginRight: '4px' }} />
                        Loading survey questions…
                      </span>
                    )}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {csvHeaders.map(h => (
                      <div key={h} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label
                          title={h}
                          style={{
                            fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {h.length > 36 ? h.slice(0, 36) + '…' : h}
                        </label>
                        <div style={{ position: 'relative' }}>
                          <select
                            value={columnMap[h] ?? 'skip'}
                            onChange={e => setColumnMap(prev => ({ ...prev, [h]: e.target.value }))}
                            style={{
                              width: '100%', padding: '8px 28px 8px 10px', fontSize: '13px',
                              color: '#FFFFFF', backgroundColor: '#1A3050',
                              border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
                              appearance: 'none', cursor: 'pointer', outline: 'none',
                            }}
                          >
                            {csvFieldOptions.map(o => (
                              <option key={o.value} value={o.value} style={{ backgroundColor: '#1A3050', color: '#FFFFFF' }}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={13}
                            style={{
                              position: 'absolute', right: '8px', top: '50%',
                              transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {csvError && <p style={{ fontSize: '13px', color: '#EF4444', margin: 0 }}>{csvError}</p>}
            {csvSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#16A34A' }}>
                <CheckCircle2 size={16} />
                {csvSuccess}
              </div>
            )}

            {csvHeaders.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => void handleCsvImport()}
                  disabled={csvImporting || csvRows.length === 0}
                  style={{
                    minHeight: '44px', padding: '0 28px', fontSize: '14px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    borderRadius: '8px', border: 'none',
                    backgroundColor: (csvImporting || csvRows.length === 0) ? 'rgba(255,255,255,0.1)' : '#E8520A',
                    color: (csvImporting || csvRows.length === 0) ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                    cursor: (csvImporting || csvRows.length === 0) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {csvImporting && <Loader2 size={14} className="animate-spin" />}
                  Import {csvRows.length} Response{csvRows.length !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Manual Tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Profile fields */}
            <div style={CARD}>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px' }}>
                Respondent Profile
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <LabeledSelect
                  label="Audience"
                  value={manAudience}
                  onChange={v => setManAudience(v as Audience)}
                  options={audienceOptions}
                />
                <LabeledSelect
                  label="Segment"
                  value={manSegment?.id ?? '__all'}
                  onChange={v => setManSegment(v === '__all' ? null : (segments.find(s => s.id === v) ?? null))}
                  options={segmentOptions}
                />
                {([
                  { key: 'name', label: 'Full Name', value: manName, setter: setManName, placeholder: 'Jane Smith' },
                  { key: 'title', label: 'Job Title', value: manTitle, setter: setManTitle, placeholder: 'VP of Marketing' },
                  { key: 'company', label: 'Company', value: manCompany, setter: setManCompany, placeholder: 'Acme Corp' },
                ] as const).map(({ key, label, value, setter, placeholder }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{
                      fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                    }}>
                      {label}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={e => setter(e.target.value)}
                      placeholder={placeholder}
                      style={{
                        padding: '10px 12px', fontSize: '14px',
                        color: '#0D0D0D', backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', outline: 'none',
                      }}
                    />
                  </div>
                ))}
                <LabeledSelect
                  label="Company Size"
                  value={manSize}
                  onChange={v => setManSize(v)}
                  options={[
                    { value: '', label: 'Select company size' },
                    { value: '1-10 employees', label: '1-10 employees' },
                    { value: '11-50 employees', label: '11-50 employees' },
                    { value: '51-200 employees', label: '51-200 employees' },
                    { value: '201-500 employees', label: '201-500 employees' },
                    { value: '501-1,000 employees', label: '501-1,000 employees' },
                    { value: '1,000+ employees', label: '1,000+ employees' },
                  ]}
                />
                <div style={{ gridColumn: 'span 2' }}>
                  <LabeledSelect
                    label={manAudience === 'internal' ? 'Internal Role' : 'Decision Role'}
                    value={manDecisionRole}
                    onChange={v => setManDecisionRole(v)}
                    options={manAudience === 'internal' ? [
                      { value: '', label: 'Select your role' },
                      { value: 'Founder / CEO', label: 'Founder / CEO' },
                      { value: 'Sales Leadership (CRO / VP Sales)', label: 'Sales Leadership (CRO / VP Sales)' },
                      { value: 'Marketing Leadership (CMO / VP Marketing)', label: 'Marketing Leadership (CMO / VP Marketing)' },
                      { value: 'Revenue Operations', label: 'Revenue Operations' },
                      { value: 'Account Executive', label: 'Account Executive' },
                      { value: 'Business Development', label: 'Business Development' },
                      { value: 'Customer Success', label: 'Customer Success' },
                      { value: 'Product', label: 'Product' },
                      { value: 'Other', label: 'Other' },
                    ] : [
                      { value: '', label: 'Select your role' },
                      { value: 'Final Decision Maker', label: 'Final Decision Maker' },
                      { value: 'Strong Influence', label: 'Strong Influence' },
                      { value: 'Evaluator / Analyst', label: 'Evaluator / Analyst' },
                      { value: 'Champion (internal advocate)', label: 'Champion (internal advocate)' },
                      { value: 'Gatekeeper / Procurement', label: 'Gatekeeper / Procurement' },
                      { value: 'End User', label: 'End User' },
                      { value: 'Observer / No direct role', label: 'Observer / No direct role' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Questions loading indicator */}
            {manQuestionsLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                <Loader2 size={14} className="animate-spin" style={{ color: '#0EA5E9' }} />
                Loading survey questions...
              </div>
            )}

            {/* Survey answers */}
            <div style={CARD}>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px' }}>
                Survey Responses
              </p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 20px' }}>
                {manQuestionsLoading
                  ? 'Loading questions…'
                  : manQuestions.length === 0
                    ? 'No saved survey found for this audience and segment. Build your survey first in the Survey Builder.'
                    : `Enter the respondent's answers for each question.`}
              </p>

              {manQuestionsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: '#0EA5E9' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {manQuestions.map((q, i) => (
                    <div key={q.id}>
                      <label style={{ display: 'block', marginBottom: '8px', lineHeight: '1.5' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, color: '#0EA5E9',
                          textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '8px',
                        }}>
                          Q{i + 1} · {STAGE_NAMES[q.stageId] ?? `Stage ${q.stageId}`}
                        </span>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                          {q.text}
                        </span>
                      </label>
                      <textarea
                        value={manAnswers[q.id] ?? ''}
                        onChange={e => setManAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Enter respondent's answer…"
                        rows={3}
                        style={{
                          width: '100%', padding: '10px 12px', fontSize: '13px',
                          color: '#0D0D0D', backgroundColor: '#FFFFFF',
                          border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                          outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {manError && <p style={{ fontSize: '13px', color: '#EF4444', margin: 0 }}>{manError}</p>}
            {manSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#16A34A' }}>
                <CheckCircle2 size={16} />
                Response saved successfully.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => void handleManualSave()}
                disabled={manSaving}
                style={{
                  minHeight: '44px', padding: '0 28px', fontSize: '14px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px',
                  borderRadius: '8px', border: 'none',
                  backgroundColor: manSaving ? 'rgba(255,255,255,0.1)' : '#E8520A',
                  color: manSaving ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                  cursor: manSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {manSaving && <Loader2 size={14} className="animate-spin" />}
                Save Response
              </button>
            </div>
          </div>
        )}

        {/* ── View Responses Tab ───────────────────────────────────────────────── */}
        {activeTab === 'view' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Filters */}
            <div style={CARD}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '16px', alignItems: 'end' }}>
                <LabeledSelect
                  label="Audience"
                  value={viewFilterAudience}
                  onChange={setViewFilterAudience}
                  options={[
                    { value: '', label: 'All Audiences' },
                    { value: 'internal', label: 'Internal Stakeholders' },
                    { value: 'current', label: 'Current Customers' },
                    { value: 'lost', label: 'Lost Customers' },
                    { value: 'potential', label: 'Potential Customers' },
                  ]}
                />
                <LabeledSelect
                  label="Segment"
                  value={viewFilterSegment}
                  onChange={setViewFilterSegment}
                  options={[
                    { value: '', label: 'All Segments' },
                    ...segments.map(s => ({ value: s.slug, label: s.name })),
                  ]}
                />
                <LabeledSelect
                  label="Source"
                  value={viewFilterSource}
                  onChange={setViewFilterSource}
                  options={[
                    { value: '', label: 'All Sources' },
                    { value: 'link', label: 'Survey Link' },
                    { value: 'manual', label: 'Manual Entry' },
                    { value: 'csv', label: 'CSV Upload' },
                    { value: 'simulated', label: 'Copilot Simulated' },
                  ]}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{
                    fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Search
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={14}
                      style={{
                        position: 'absolute', left: '12px', top: '50%',
                        transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      value={viewSearch}
                      onChange={e => setViewSearch(e.target.value)}
                      placeholder="Search by name, title, or company…"
                      style={{
                        width: '100%', padding: '10px 12px 10px 34px', fontSize: '14px',
                        color: '#FFFFFF', backgroundColor: '#1A3050',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {deleteError && (
              <p style={{ fontSize: '13px', color: '#EF4444', margin: 0 }}>{deleteError}</p>
            )}

            {/* Table */}
            {viewLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
            ) : filteredResponses.length === 0 ? (
              <div style={{ ...CARD, textAlign: 'center', padding: '48px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>
                  No responses found. Adjust your filters or add responses using the other tabs.
                </p>
              </div>
            ) : (
              <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ backgroundColor: '#0A1628' }}>
                      <tr>
                        {(['Name', 'Title', 'Role', 'Audience', 'Segment', 'Date', 'Actions'] as const).map(col => (
                          <th
                            key={col}
                            style={{
                              padding: '11px 16px', textAlign: 'left',
                              color: 'rgba(255,255,255,0.45)', fontSize: '11px',
                              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                              whiteSpace: 'nowrap',
                              ...(col === 'Actions' ? { minWidth: '120px' } : {}),
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedResponses.map(r => (
                        <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <td
                            onClick={() => setSelectedResponse(r)}
                            style={{ padding: '12px 16px', color: '#FFFFFF', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}
                          >
                            {r.respondent_name ?? <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.7)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.respondent_title ?? <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.7)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.decision_role ?? <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                              backgroundColor: 'rgba(14,165,233,0.15)', color: '#0EA5E9',
                            }}>
                              {AUDIENCE_LABELS[r.audience as Audience] ?? r.audience}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {segmentNameFromSlug(r.segment_slug)}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.45)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {formatDate(r.submitted_at)}
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', minWidth: '120px' }}>
                            {deleteConfirmId === r.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Delete?</span>
                                <button
                                  onClick={() => void handleDelete(r.id)}
                                  disabled={deletingId === r.id}
                                  style={{
                                    minHeight: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600,
                                    borderRadius: '6px', border: 'none', cursor: deletingId === r.id ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#EF4444', color: '#FFFFFF',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                  }}
                                >
                                  {deletingId === r.id ? <Loader2 size={11} className="animate-spin" /> : null}
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  style={{
                                    minHeight: '32px', padding: '0 10px', fontSize: '12px', fontWeight: 600,
                                    borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)',
                                  }}
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  onClick={() => {
                                    console.log('[ResponseImport] View clicked, opening panel for:', r.id, r.respondent_name)
                                    setSelectedResponse(r)
                                  }}
                                  style={{
                                    minHeight: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600,
                                    borderRadius: '6px', border: '1px solid rgba(14,165,233,0.4)',
                                    cursor: 'pointer', backgroundColor: 'rgba(14,165,233,0.1)',
                                    color: '#0EA5E9', display: 'flex', alignItems: 'center', gap: '4px',
                                  }}
                                >
                                  <Eye size={12} />
                                  View
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(r.id)}
                                  style={{
                                    minHeight: '32px', padding: '0 10px', fontSize: '12px', fontWeight: 600,
                                    borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
                                    cursor: 'pointer', backgroundColor: 'rgba(239,68,68,0.08)',
                                    color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px',
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{
                    padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
                      {filteredResponses.length} responses · page {viewPage + 1} of {totalPages}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setViewPage(p => Math.max(0, p - 1))}
                        disabled={viewPage === 0}
                        style={{
                          minHeight: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 600,
                          borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
                          cursor: viewPage === 0 ? 'not-allowed' : 'pointer',
                          backgroundColor: 'transparent',
                          color: viewPage === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                        }}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setViewPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={viewPage >= totalPages - 1}
                        style={{
                          minHeight: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 600,
                          borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
                          cursor: viewPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                          backgroundColor: 'transparent',
                          color: viewPage >= totalPages - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Simulate Tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'simulate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Info header */}
            <div style={{
              ...CARD,
              borderLeft: '3px solid #E8520A',
              display: 'flex', alignItems: 'flex-start', gap: '14px',
            }}>
              <Sparkles size={22} style={{ color: '#E8520A', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px' }}>
                  Generate realistic synthetic survey responses using Copilot
                </p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.55 }}>
                  Copilot generates realistic responses from the perspective of potential buyers actively evaluating GTM strategy partners. Review each response before adding it to your research.
                </p>
              </div>
            </div>

            {/* Generator controls */}
            <div style={CARD}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <LabeledSelect
                  label="Segment"
                  value={simSegment?.id ?? '__all'}
                  onChange={v => setSimSegment(v === '__all' ? null : (segments.find(s => s.id === v) ?? null))}
                  options={segmentOptions}
                />
                <LabeledSelect
                  label="Number of Responses"
                  value={String(simCount)}
                  onChange={v => setSimCount(Number(v))}
                  options={[
                    { value: '1', label: '1 response' },
                    { value: '2', label: '2 responses' },
                    { value: '3', label: '3 responses' },
                    { value: '5', label: '5 responses' },
                  ]}
                />
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => void handleSimulateGenerate()}
                  disabled={simGenerating}
                  style={{
                    minHeight: '44px', padding: '0 24px', fontSize: '14px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    borderRadius: '8px', border: 'none',
                    backgroundColor: simGenerating ? 'rgba(255,255,255,0.1)' : '#E8520A',
                    color: simGenerating ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                    cursor: simGenerating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {simGenerating
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Sparkles size={14} />
                  }
                  Generate Simulated Responses
                </button>
              </div>
              <p style={{ fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic', margin: '8px 0 0', textAlign: 'right' }}>
                This typically takes 20-40 seconds depending on the number of responses.
              </p>
            </div>

            {simError && <p style={{ fontSize: '13px', color: '#EF4444', margin: 0 }}>{simError}</p>}

            {/* Loading state */}
            {simGenerating && (
              <div style={{ ...CARD, textAlign: 'center', padding: '40px' }}>
                <Loader2 size={28} className="animate-spin" style={{ color: '#E8520A', marginBottom: '12px' }} />
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                  Copilot is generating realistic buyer responses...
                </p>
              </div>
            )}

            {/* Generated cards */}
            {!simGenerating && simResponses.length > 0 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {simResponses.map(card => {
                    const acceptingThis = !!simAccepting[card.id]
                    return (
                      <div
                        key={card.id}
                        style={{
                          ...CARD, padding: 0, overflow: 'hidden',
                          borderColor: card.accepted ? 'rgba(22,163,74,0.5)' : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        {/* Card header */}
                        <div style={{
                          padding: '14px 20px',
                          backgroundColor: '#0A1628',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          flexWrap: 'wrap', gap: '8px',
                        }}>
                          <span style={{
                            padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                            backgroundColor: 'rgba(232,82,10,0.15)', color: '#E8520A',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                          }}>
                            <Sparkles size={11} />
                            Copilot Simulated
                          </span>
                          {card.accepted && (
                            <span style={{
                              padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                              backgroundColor: 'rgba(22,163,74,0.15)', color: '#16A34A',
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                            }}>
                              <CheckCircle2 size={12} />
                              Added to your responses
                            </span>
                          )}
                        </div>

                        {/* Respondent profile */}
                        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px' }}>
                            Simulated Respondent
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {([
                              { label: 'Name', value: card.respondent.name },
                              { label: 'Title', value: card.respondent.title },
                              { label: 'Company', value: card.respondent.company },
                              { label: 'Company Size', value: card.respondent.company_size },
                              { label: 'Decision Role', value: card.respondent.decision_role },
                            ]).map(({ label, value }) => (
                              <div key={label}>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                                  {label}
                                </p>
                                <p style={{ fontSize: '13px', color: value ? '#FFFFFF' : 'rgba(255,255,255,0.25)', margin: 0 }}>
                                  {value ?? '—'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Answers */}
                        <div style={{ padding: '18px 20px' }}>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px' }}>
                            Simulated Answers
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {card.questions.map((q, qi) => {
                              const answer = card.answers[q.id]
                              const hasAnswer = typeof answer === 'string' && answer.trim().length > 0
                              return (
                                <div
                                  key={q.id}
                                  style={{
                                    backgroundColor: '#0A1628',
                                    borderRadius: '8px', padding: '12px 14px',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                  }}
                                >
                                  <p style={{
                                    fontSize: '11px', fontWeight: 700, color: '#0EA5E9',
                                    textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px',
                                  }}>
                                    Q{qi + 1} · {STAGE_NAMES[q.stageId] ?? `Stage ${q.stageId}`}
                                  </p>
                                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.5 }}>
                                    {q.text}
                                  </p>
                                  <p style={{
                                    fontSize: '13px',
                                    color: hasAnswer ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                                    margin: 0, lineHeight: 1.6,
                                    fontStyle: hasAnswer ? 'normal' : 'italic',
                                  }}>
                                    {hasAnswer ? answer : 'No answer generated'}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Card actions */}
                        {!card.accepted && (
                          <div style={{
                            padding: '14px 20px',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', justifyContent: 'flex-end', gap: '10px',
                          }}>
                            <button
                              onClick={() => handleDeclineSimulated(card.id)}
                              disabled={acceptingThis}
                              style={{
                                minHeight: '40px', padding: '0 18px', fontSize: '13px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '6px',
                                borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)',
                                backgroundColor: 'rgba(239,68,68,0.1)',
                                color: '#EF4444',
                                cursor: acceptingThis ? 'not-allowed' : 'pointer',
                                opacity: acceptingThis ? 0.5 : 1,
                              }}
                            >
                              <X size={14} />
                              Decline
                            </button>
                            <button
                              onClick={() => void handleAcceptSimulated(card)}
                              disabled={acceptingThis}
                              style={{
                                minHeight: '40px', padding: '0 18px', fontSize: '13px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '6px',
                                borderRadius: '8px', border: 'none',
                                backgroundColor: acceptingThis ? 'rgba(255,255,255,0.1)' : '#16A34A',
                                color: acceptingThis ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                                cursor: acceptingThis ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {acceptingThis
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Check size={14} />
                              }
                              Accept Response
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Summary */}
                <div style={{
                  ...CARD,
                  textAlign: 'center', padding: '16px 20px',
                  backgroundColor: '#0A1628',
                }}>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 600 }}>
                    {simResponses.filter(r => r.accepted).length} of {simResponses.length} simulated response{simResponses.length !== 1 ? 's' : ''} accepted
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Summary (View Responses tab only) ────────────────────────────────── */}
        {activeTab === 'view' && (<div style={{ marginTop: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Users size={18} style={{ color: '#0EA5E9' }} />
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              Imported Responses
            </h2>
            {!statsLoading && (
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
                {totalResponses} total
              </span>
            )}
          </div>

          {statsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
            </div>
          ) : totalResponses === 0 ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>
                No responses imported yet. Upload a CSV or add responses manually above.
              </p>
            </div>
          ) : (
            <>
              {/* Audience count tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {AUDIENCES.map(a => (
                  <div
                    key={a}
                    style={{
                      ...CARD, padding: '18px 20px',
                      borderLeft: audienceCounts[a] > 0 ? '3px solid #E8520A' : '3px solid transparent',
                    }}
                  >
                    <p style={{ fontSize: '28px', fontWeight: 700, color: '#FFFFFF', margin: 0, lineHeight: 1 }}>
                      {audienceCounts[a]}
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      {AUDIENCE_LABELS[a]}
                    </p>
                  </div>
                ))}
              </div>

              {/* Recent respondents */}
              <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                    Recent Respondents
                  </p>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ backgroundColor: '#0A1628' }}>
                    <tr>
                      {(['Name', 'Title', 'Audience', 'Date'] as const).map(col => (
                        <th
                          key={col}
                          style={{
                            padding: '10px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.45)',
                            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentResponses.map(r => (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '11px 16px', color: '#FFFFFF', fontWeight: 600 }}>
                          {r.respondent_name ?? <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 16px', color: 'rgba(255,255,255,0.7)' }}>
                          {r.respondent_title ?? <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                            backgroundColor: 'rgba(14,165,233,0.15)', color: '#0EA5E9',
                          }}>
                            {AUDIENCE_LABELS[r.audience as Audience] ?? r.audience}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                          {formatDate(r.submitted_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <a
                  href="/dashboard/intelligence/dcp-map"
                  style={{
                    minHeight: '44px', padding: '0 24px', display: 'inline-flex', alignItems: 'center',
                    backgroundColor: '#E8520A', color: '#FFFFFF', borderRadius: '8px',
                    textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                  }}
                >
                  Analyze with Copilot →
                </a>
              </div>
            </>
          )}
        </div>)}
      </div>

      {/* ── Detail Slide-out Panel ───────────────────────────────────────────────── */}
      {selectedResponse && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'stretch',
        }}>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedResponse(null)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', cursor: 'pointer' }}
          />
          {/* Panel */}
          <div style={{
            width: '560px', maxWidth: '90vw',
            backgroundColor: '#0F2140',
            borderLeft: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'sticky', top: 0, backgroundColor: '#0F2140', zIndex: 1,
            }}>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  {selectedResponse.respondent_name ?? 'Unnamed Respondent'}
                </p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>
                  Response detail
                </p>
              </div>
              <button
                onClick={() => setSelectedResponse(null)}
                style={{
                  minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.5)', borderRadius: '8px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Respondent profile */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px' }}>
                Respondent Profile
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {([
                  { label: 'Name', value: selectedResponse.respondent_name },
                  { label: 'Title', value: selectedResponse.respondent_title },
                  { label: 'Company', value: selectedResponse.respondent_company },
                  { label: 'Company Size', value: selectedResponse.respondent_size },
                  { label: 'Decision Role', value: selectedResponse.decision_role },
                  { label: 'Audience', value: AUDIENCE_LABELS[selectedResponse.audience as Audience] ?? selectedResponse.audience },
                  { label: 'Segment', value: segmentNameFromSlug(selectedResponse.segment_slug) },
                  { label: 'Date Submitted', value: formatDate(selectedResponse.submitted_at) },
                ] as { label: string; value: string | null }[]).map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                      {label}
                    </p>
                    <p style={{ fontSize: '13px', color: value ? '#FFFFFF' : 'rgba(255,255,255,0.25)', margin: 0 }}>
                      {value ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Q&A by stage */}
            <div style={{ padding: '20px 24px', flex: 1 }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 16px' }}>
                Survey Answers — {countAnswers(selectedResponse.answers)} answered
              </p>

              {detailQuestionsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: '#0EA5E9' }} />
                </div>
              ) : detailQuestions.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  No survey questions found for this audience and segment.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {[1, 2, 3, 4, 5, 6, 7].map(stageNum => {
                    const stageQs = stageGroups[stageNum]
                    if (!stageQs || stageQs.length === 0) return null
                    return (
                      <div key={stageNum}>
                        <p style={{
                          fontSize: '11px', fontWeight: 700, color: '#0EA5E9',
                          textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px',
                        }}>
                          Stage {stageNum} — {STAGE_NAMES[stageNum] ?? `Stage ${stageNum}`}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {stageQs.map((q, qi) => {
                            const answer = selectedResponse.answers[q.id]
                            const hasAnswer = typeof answer === 'string' && answer.trim().length > 0
                            return (
                              <div
                                key={q.id}
                                style={{
                                  backgroundColor: '#0A1628',
                                  borderRadius: '8px',
                                  padding: '14px 16px',
                                  border: `1px solid ${hasAnswer ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                                }}
                              >
                                <p style={{
                                  fontSize: '12px', fontWeight: 600,
                                  color: hasAnswer ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                                  margin: '0 0 8px', lineHeight: '1.5',
                                }}>
                                  Q{qi + 1}. {q.text}
                                </p>
                                <p style={{
                                  fontSize: '13px',
                                  color: hasAnswer ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                                  margin: 0, lineHeight: '1.6',
                                  fontStyle: hasAnswer ? 'normal' : 'italic',
                                }}>
                                  {hasAnswer ? answer : 'No answer provided'}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
