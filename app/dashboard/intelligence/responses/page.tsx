'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Upload, UserPlus, CheckCircle2, Users, ChevronDown } from 'lucide-react'
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

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIENCE_LABELS: Record<Audience, string> = {
  internal: 'Internal Stakeholders',
  current: 'Current Customers',
  lost: 'Lost Customers',
  potential: 'Potential Customers',
}

const AUDIENCES: Audience[] = ['internal', 'current', 'lost', 'potential']

const STAGE_NAMES: Record<number, string> = {
  1: 'Need Recognition',
  2: 'Motivation to Act',
  3: 'Information Search',
  4: 'Evaluation of Alternatives',
  5: 'Select Set',
  6: 'Purchase Decision',
  7: 'Confirmation',
}

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
    const questions: SurveyQuestion[] = []
    for (let stage = 1; stage <= 7; stage++) {
      const stageQs = content[String(stage)]
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
    month: 'short', day: 'numeric', year: 'numeric',
  })
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
  const [activeTab, setActiveTab] = useState<'csv' | 'manual'>('csv')

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

  // Summary
  const [audienceCounts, setAudienceCounts] = useState<Record<Audience, number>>({
    internal: 0, current: 0, lost: 0, potential: 0,
  })
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const orgIdRef = useRef<string | null>(null)

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    void init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        .eq('step_id', 'step-2')
        .maybeSingle()

      if (step2) {
        const segs = parseSegments((step2 as Record<string, unknown>)['content'] as Record<string, unknown>)
        setSegments(segs)
        if (segs.length > 0) {
          setCsvSegment(segs[0])
          setManSegment(segs[0])
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
        body: JSON.stringify({ orgId, audience: csvAudience, segmentSlug: segSlug, segmentName: segName, responses }),
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

  const CARD: React.CSSProperties = {
    backgroundColor: '#0F2140',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '24px',
  }

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>

      {/* Header */}
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Response Import
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
                  { key: 'size', label: 'Company Size', value: manSize, setter: setManSize, placeholder: '50–200 employees' },
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                  <label style={{
                    fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Decision Role
                  </label>
                  <input
                    type="text"
                    value={manDecisionRole}
                    onChange={e => setManDecisionRole(e.target.value)}
                    placeholder="Final approver / Champion / Influencer / Budget holder"
                    style={{
                      padding: '10px 12px', fontSize: '14px',
                      color: '#0D0D0D', backgroundColor: '#FFFFFF',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

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

        {/* ── Summary ──────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: '48px' }}>
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
        </div>
      </div>
    </div>
  )
}
