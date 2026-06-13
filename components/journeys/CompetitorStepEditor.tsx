'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Search, Lightbulb, X, AlertCircle, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type DealLossFrequency = '' | 'Frequently' | 'Sometimes' | 'Rarely' | 'Unknown'
type CompetitorSource = '' | 'dcp' | 'discovery' | 'manual'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface CompetitorData {
  index: number
  name: string
  whyBuyersChooseThem: string
  keyPromise: string
  vulnerability: string
  dealFrequency: DealLossFrequency
  source: CompetitorSource
}

interface DiscoveredCompetitor {
  name: string
  category: string
  description: string
  alignmentScore: number
  dcpIdentified: boolean
  assignedToTab: number | null
}

interface DiscoveryApiCompetitor {
  name: string
  description: string
  why_relevant?: string
  alignment_score?: number
}

interface DiscoveryApiResult {
  known_validators?: DiscoveryApiCompetitor[]
  adjacent_competitors?: DiscoveryApiCompetitor[]
  emerging_threats?: DiscoveryApiCompetitor[]
}

export interface CompetitorStepEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
  onContentChange?: (hasNonEmptyContent: boolean) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 1500
const TAB_COUNT = 4
const STATUS_QUO_NAME = 'Status Quo / Do Nothing'

const DEAL_LOSS_OPTIONS: DealLossFrequency[] = ['Frequently', 'Sometimes', 'Rarely', 'Unknown']

const TIPS: string[] = [
  'Your Select Set = the 3-4 competitors your buyers compare you against in final decisions.',
  'Buyers typically narrow to 3-5 options. Focus your positioning on who actually makes their shortlist.',
  'DCP Identified competitors were named by your actual buyers in the survey — prioritize these.',
]

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL_CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  padding: '20px',
  position: 'relative',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '6px',
  display: 'block',
}

const FIELD_INPUT: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #9CA3AF',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#0D0D0D',
  backgroundColor: '#FFFFFF',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
}

const FIELD_TEXTAREA: React.CSSProperties = {
  ...FIELD_INPUT,
  minHeight: '90px',
  lineHeight: '1.55',
  resize: 'vertical',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEmpty(idx: number): CompetitorData {
  return {
    index: idx,
    name: '',
    whyBuyersChooseThem: '',
    keyPromise: '',
    vulnerability: '',
    dealFrequency: '',
    source: '',
  }
}

function defaultCompetitors(): CompetitorData[] {
  return [1, 2, 3, 4].map(makeEmpty)
}

function asSource(raw: unknown): CompetitorSource {
  const s = String(raw ?? '')
  return s === 'dcp' || s === 'discovery' || s === 'manual' ? s : ''
}

function asDealFrequency(raw: unknown): DealLossFrequency {
  const s = String(raw ?? '')
  return s === 'Frequently' || s === 'Sometimes' || s === 'Rarely' || s === 'Unknown' ? s : ''
}

function parseAlignmentScore(raw: unknown): number {
  const v = Number(raw)
  if (!Number.isFinite(v)) return 5
  return Math.max(1, Math.min(10, Math.round(v)))
}

function parseSavedCompetitors(raw: unknown): CompetitorData[] {
  if (!Array.isArray(raw)) return defaultCompetitors()
  const out = defaultCompetitors()
  for (const r of raw as Array<Record<string, unknown>>) {
    const idx = Number(r['index'])
    if (!Number.isFinite(idx) || idx < 1 || idx > TAB_COUNT) continue
    out[idx - 1] = {
      index: idx,
      name: String(r['name'] ?? ''),
      whyBuyersChooseThem: String(r['whyBuyersChooseThem'] ?? r['why_buyers_choose'] ?? ''),
      keyPromise: String(r['keyPromise'] ?? r['key_promise'] ?? ''),
      vulnerability: String(r['vulnerability'] ?? ''),
      dealFrequency: asDealFrequency(r['dealFrequency'] ?? r['deal_loss_frequency']),
      source: asSource(r['source']),
    }
  }
  return out
}

function parseSavedDiscovered(raw: unknown): DiscoveredCompetitor[] {
  if (!Array.isArray(raw)) return []
  return (raw as Array<Record<string, unknown>>).map(d => ({
    name: String(d['name'] ?? ''),
    category: String(d['category'] ?? 'Alternative'),
    description: String(d['description'] ?? ''),
    alignmentScore: parseAlignmentScore(d['alignmentScore']),
    dcpIdentified: Boolean(d['dcpIdentified']),
    assignedToTab: d['assignedToTab'] == null ? null : Number(d['assignedToTab']),
  })).filter(d => d.name.length > 0)
}

function categorise(name: string, description: string): string {
  const blob = `${name} ${description}`.toLowerCase()
  if (blob.includes('agency') || blob.includes('agencies')) return 'Agency'
  if (blob.includes('consultanc') || blob.includes('consultant')) return 'Consultancy'
  if (blob.includes('fractional') || blob.includes('interim')) return 'Fractional'
  if (blob.includes('in-house') || blob.includes('internal hire') || blob.includes('build in-house')) return 'Internal'
  return 'Alternative'
}

function flattenDiscovery(api: DiscoveryApiResult): Array<Omit<DiscoveredCompetitor, 'dcpIdentified' | 'assignedToTab'>> {
  const flat: Array<Omit<DiscoveredCompetitor, 'dcpIdentified' | 'assignedToTab'>> = []
  const groups = [api.known_validators ?? [], api.adjacent_competitors ?? [], api.emerging_threats ?? []]
  for (const group of groups) {
    for (const c of group) {
      if (!c?.name) continue
      flat.push({
        name: c.name,
        description: c.description ?? '',
        category: categorise(c.name, c.description ?? ''),
        alignmentScore: parseAlignmentScore(c.alignment_score),
      })
    }
  }
  return flat.filter(o => !o.name.toLowerCase().includes('status quo'))
}

function alignmentBadge(score: number): { label: string; bg: string; color: string } {
  if (score >= 8) return { label: 'HIGH', bg: '#EF4444', color: '#FFFFFF' }
  if (score >= 5) return { label: 'MODERATE', bg: '#F59E0B', color: '#FFFFFF' }
  return { label: 'INDIRECT', bg: '#10B981', color: '#FFFFFF' }
}

function categoryColor(category: string): string {
  const c = category.toLowerCase()
  if (c === 'agency') return '#0EA5E9'
  if (c === 'consultancy') return '#A855F7'
  if (c === 'fractional') return '#F59E0B'
  if (c === 'internal') return '#10B981'
  return '#6B7280'
}

function sourceBadge(source: CompetitorSource): { label: string; bg: string; color: string } | null {
  if (source === 'dcp') return { label: 'DCP Identified', bg: 'rgba(14,165,233,0.18)', color: '#0EA5E9' }
  if (source === 'discovery') return { label: 'Discovery', bg: 'rgba(232,82,10,0.18)', color: '#FDBA74' }
  if (source === 'manual') return { label: 'Manual', bg: 'rgba(255,255,255,0.10)', color: '#9CA3AF' }
  return null
}

function nameInText(name: string, blob: string): boolean {
  if (!name || !blob) return false
  return blob.toLowerCase().includes(name.toLowerCase())
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280' }}>
      <Loader2 size={12} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return <span style={{ fontSize: '12px', color: '#16A34A' }}>Saved</span>
  if (state === 'error') return <span style={{ fontSize: '12px', color: '#EF4444' }}>Save failed</span>
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompetitorStepEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
  onContentChange,
}: CompetitorStepEditorProps) {
  void stepTitle

  const [loading, setLoading] = useState(true)
  const [competitors, setCompetitors] = useState<CompetitorData[]>(defaultCompetitors())
  const [activeTab, setActiveTab] = useState<number>(1)
  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const [discoveredList, setDiscoveredList] = useState<DiscoveredCompetitor[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)

  const [autoFillingTab, setAutoFillingTab] = useState<number | null>(null)
  const [statusQuoActive, setStatusQuoActive] = useState(false)
  const [dcpStage5Text, setDcpStage5Text] = useState<string>('')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [stepRes, dcpRes] = await Promise.all([
          supabase
            .from('step_output')
            .select('id, content, version')
            .eq('workspace_id', workspaceId)
            .eq('step_id', stepId)
            .order('version', { ascending: false })
            .limit(1),
          supabase
            .from('dcp_analysis')
            .select('stage_summaries')
            .eq('org_id', workspaceId)
            .maybeSingle(),
        ])

        if (stepRes.data && stepRes.data.length > 0) {
          const row = stepRes.data[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          if (c) {
            if (Array.isArray(c['competitors'])) {
              const parsed = parseSavedCompetitors(c['competitors'])
              setCompetitors(parsed)
              if (parsed.some(comp => comp.name.trim().length > 0)) {
                onContentChange?.(true)
              }
            }
            if (Array.isArray(c['discoveredList'])) setDiscoveredList(parseSavedDiscovered(c['discoveredList']))
            if (c['statusQuoActive'] === true) setStatusQuoActive(true)
          }
        }

        if (dcpRes.data) {
          const summaries = (dcpRes.data as Record<string, unknown>)['stage_summaries']
          if (Array.isArray(summaries)) {
            const stage5 = (summaries as Array<Record<string, unknown>>).find(s => Number(s['stage_number']) === 5)
            if (stage5) {
              const parts: string[] = []
              if (stage5['summary']) parts.push(String(stage5['summary']))
              if (Array.isArray(stage5['key_signals'])) parts.push(...(stage5['key_signals'] as unknown[]).map(String))
              setDcpStage5Text(parts.join(' \n '))
            }
          }
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [workspaceId, stepId])

  // ── Save ────────────────────────────────────────────────────────────────────

  const persistContent = useCallback(async (
    rows: CompetitorData[],
    list: DiscoveredCompetitor[],
    sqActive: boolean,
  ) => {
    setSaveState('saving')
    try {
      const payload = {
        competitors: rows,
        discoveredList: list,
        statusQuoActive: sqActive,
      }
      const now = new Date().toISOString()

      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content: payload, last_saved_at: now, last_updated_at: now })
          .eq('id', outputId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('step_output')
          .insert({
            workspace_id: workspaceId,
            step_id: stepId,
            version: outputVersion,
            status: 'draft',
            content: payload,
            copilot_assisted: false,
            last_saved_at: now,
            last_updated_at: now,
          })
          .select('id')
          .single()
        if (error) throw error
        if (data) setOutputId(String((data as Record<string, unknown>)['id'] ?? ''))
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }, [outputId, outputVersion, stepId, workspaceId])

  const scheduleSave = useCallback((
    nextComp?: CompetitorData[],
    nextList?: DiscoveredCompetitor[],
    nextSq?: boolean,
  ) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const comp = nextComp ?? competitors
    const list = nextList ?? discoveredList
    const sq = nextSq ?? statusQuoActive
    saveTimer.current = setTimeout(() => { void persistContent(comp, list, sq) }, AUTOSAVE_MS)
  }, [competitors, discoveredList, statusQuoActive, persistContent])

  // ── Field updates ───────────────────────────────────────────────────────────

  function updateField<K extends keyof CompetitorData>(idx: number, field: K, value: CompetitorData[K]) {
    setCompetitors(prev => {
      const next = prev.map(c => {
        if (c.index !== idx) return c
        const updated = { ...c, [field]: value }
        if (field === 'name') {
          const newName = String(value).trim()
          if (newName === '') {
            updated.source = ''
          } else if (c.source === '') {
            updated.source = 'manual'
          }
        }
        return updated
      })
      scheduleSave(next)
      return next
    })
  }

  // ── Discovery ───────────────────────────────────────────────────────────────

  async function buildDiscoveryContext() {
    const [s1, s2, s3, s11, icpRes] = await Promise.all([
      supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '1').order('version', { ascending: false }).limit(1),
      supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '2').order('version', { ascending: false }).limit(1),
      supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '3').order('version', { ascending: false }).limit(1),
      supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '11').order('version', { ascending: false }).limit(1),
      supabase.from('icp_definition').select('segment_name, industry_verticals, company_size_range, job_titles').eq('org_id', workspaceId),
    ])

    function stepText(data: Array<Record<string, unknown>> | null): string {
      if (!data || data.length === 0) return 'Not provided.'
      const c = data[0]['content']
      return c ? JSON.stringify(c, null, 2) : 'Not provided.'
    }

    const companyContext = [
      'STEP 1 - PRODUCT/SERVICE PROFILE:\n' + stepText(s1.data as Array<Record<string, unknown>> | null),
      'STEP 2 - TARGET SEGMENTS:\n' + stepText(s2.data as Array<Record<string, unknown>> | null),
      'STEP 3 - DECISION MAKERS:\n' + stepText(s3.data as Array<Record<string, unknown>> | null),
    ].join('\n\n')

    const cvpContext = 'STEP 11 - CUSTOMER VALUE PROPOSITIONS:\n' + stepText(s11.data as Array<Record<string, unknown>> | null)

    const icpLines: string[] = []
    if (icpRes.data) {
      for (const rawRow of icpRes.data) {
        const row = rawRow as Record<string, unknown>
        const verticals = Array.isArray(row['industry_verticals'])
          ? (row['industry_verticals'] as unknown[]).map(String).join(', ')
          : ''
        const size = row['company_size_range'] != null ? String(row['company_size_range']) : ''
        const titles = Array.isArray(row['job_titles'])
          ? (row['job_titles'] as unknown[]).map(String).join(', ')
          : ''
        icpLines.push(`Segment: ${String(row['segment_name'] ?? '')} | Industries: ${verticals} | Size: ${size} | Titles: ${titles}`)
      }
    }
    const icpContext = icpLines.length > 0 ? icpLines.join('\n') : 'Not provided.'

    return { companyContext, cvpContext, icpContext, painPointContext: 'See Step 4 endemic problem and Step 11 CVPs above.' }
  }

  async function runDiscovery() {
    if (discovering) return
    setDiscovering(true)
    setDiscoveryError(null)

    try {
      const ctx = await buildDiscoveryContext()
      const res = await fetch('/api/copilot/competitive-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          companyContext: ctx.companyContext,
          icpContext: ctx.icpContext,
          painPointContext: ctx.painPointContext,
          cvpContext: ctx.cvpContext,
          preferredModel,
        }),
      })

      if (!res.ok) {
        let msg = `Error ${res.status}`
        try {
          const body = (await res.json()) as Record<string, unknown>
          msg = String(body['error'] ?? msg)
        } catch { /* ignore */ }
        setDiscoveryError(res.status === 422 ? 'Could not parse competitor data. Please try again.' : msg)
        return
      }

      const data = (await res.json()) as DiscoveryApiResult
      const fresh = flattenDiscovery(data)

      setDiscoveredList(prev => {
        const byName = new Map(prev.map(d => [d.name.toLowerCase(), d]))
        for (const f of fresh) {
          const key = f.name.toLowerCase()
          if (byName.has(key)) {
            const existing = byName.get(key)!
            byName.set(key, {
              ...existing,
              category: existing.category || f.category,
              description: existing.description || f.description,
              alignmentScore: existing.alignmentScore || f.alignmentScore,
              dcpIdentified: existing.dcpIdentified || nameInText(f.name, dcpStage5Text),
            })
          } else {
            byName.set(key, {
              name: f.name,
              category: f.category,
              description: f.description,
              alignmentScore: f.alignmentScore,
              dcpIdentified: nameInText(f.name, dcpStage5Text),
              assignedToTab: null,
            })
          }
        }
        const merged = Array.from(byName.values())
        scheduleSave(undefined, merged, undefined)
        return merged
      })
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'An error occurred during discovery.')
    } finally {
      setDiscovering(false)
    }
  }

  // ── Auto-fill ───────────────────────────────────────────────────────────────

  async function autofillFromCard(card: DiscoveredCompetitor, tabIndex: number) {
    setAutoFillingTab(tabIndex)
    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: '17-autofill',
          workspaceId,
          stepTitle: 'Competitor Autofill',
          stepDescription: '',
          currentContent: '',
          preferredModel,
          extraContext: `Competitor: ${card.name}\nDescription: ${card.description}`,
        }),
      })

      if (!res.ok || !res.body) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }
      if (accumulated.includes('__STREAM_ERROR__')) return

      const stripped = accumulated
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      const firstBrace = stripped.indexOf('{')
      const lastBrace = stripped.lastIndexOf('}')
      const jsonText = firstBrace !== -1 && lastBrace > firstBrace
        ? stripped.slice(firstBrace, lastBrace + 1)
        : stripped

      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(jsonText) as Record<string, unknown> } catch { return }

      const why = String(parsed['why_buyers_choose_them'] ?? '')
      const promise = String(parsed['their_key_promise'] ?? '')
      const vuln = String(parsed['their_vulnerability'] ?? '')

      setCompetitors(prev => {
        const next = prev.map(c => c.index === tabIndex
          ? { ...c, whyBuyersChooseThem: why || c.whyBuyersChooseThem, keyPromise: promise || c.keyPromise, vulnerability: vuln || c.vulnerability }
          : c
        )
        scheduleSave(next)
        return next
      })
    } catch {
      // non-fatal
    } finally {
      setAutoFillingTab(null)
    }
  }

  // ── Card click / tab assignment ─────────────────────────────────────────────

  function findNextEmptyTab(reserveTab4: boolean): number | null {
    const upper = reserveTab4 ? TAB_COUNT - 1 : TAB_COUNT
    for (let i = 0; i < upper; i++) {
      if (!competitors[i].name.trim()) return i + 1
    }
    return null
  }

  function handleCardClick(card: DiscoveredCompetitor) {
    if (card.assignedToTab != null) return
    const targetTab = findNextEmptyTab(statusQuoActive)
    if (targetTab == null) return

    const newSource: CompetitorSource = card.dcpIdentified ? 'dcp' : 'discovery'

    setCompetitors(prev => {
      const next = prev.map(c => c.index === targetTab
        ? { ...c, name: card.name, source: newSource }
        : c
      )
      scheduleSave(next)
      return next
    })

    setDiscoveredList(prev => {
      const next = prev.map(d => d.name === card.name ? { ...d, assignedToTab: targetTab } : d)
      scheduleSave(undefined, next, undefined)
      return next
    })

    setActiveTab(targetTab)
    void autofillFromCard(card, targetTab)
  }

  // ── Remove ──────────────────────────────────────────────────────────────────

  function removeCompetitor(tabIndex: number) {
    setCompetitors(prev => {
      const next = prev.map(c => c.index === tabIndex ? makeEmpty(tabIndex) : c)
      scheduleSave(next)
      return next
    })

    setDiscoveredList(prev => {
      const next = prev.map(d => d.assignedToTab === tabIndex ? { ...d, assignedToTab: null } : d)
      scheduleSave(undefined, next, undefined)
      return next
    })

    if (tabIndex === TAB_COUNT && statusQuoActive) {
      setStatusQuoActive(false)
      scheduleSave(undefined, undefined, false)
    }
  }

  // ── Status Quo toggle ───────────────────────────────────────────────────────

  function toggleStatusQuo() {
    setStatusQuoActive(prev => {
      const nextActive = !prev
      setCompetitors(curr => {
        const next = curr.map(c => ({ ...c }))
        if (nextActive) {
          next[3] = {
            ...makeEmpty(TAB_COUNT),
            name: STATUS_QUO_NAME,
            source: 'manual',
          }
        } else if (next[3].name === STATUS_QUO_NAME) {
          next[3] = makeEmpty(TAB_COUNT)
        }
        scheduleSave(next, undefined, nextActive)
        return next
      })
      return nextActive
    })
  }

  // ── Sort discovered cards ───────────────────────────────────────────────────

  const sortedDiscovered = [...discoveredList].sort((a, b) => {
    if (a.dcpIdentified !== b.dcpIdentified) return a.dcpIdentified ? -1 : 1
    return b.alignmentScore - a.alignmentScore
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  const active = competitors[activeTab - 1]
  const activeBadge = sourceBadge(active.source)
  const isStatusQuoTab = active.index === TAB_COUNT && active.name === STATUS_QUO_NAME

  return (
    <>
      {/* ── Open Discovery button ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setDiscoveryOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', minHeight: '44px',
            backgroundColor: '#0EA5E9', color: '#FFFFFF',
            border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Search size={15} /> {discoveryOpen ? 'Hide Select Set Discovery' : 'Open Select Set Discovery'}
        </button>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.55)', maxWidth: '520px' }}>
          Identify the 3-4 competitors your buyers most often compare you against in final evaluations.
        </p>
      </div>

      {/* ── Discovery panel ───────────────────────────────────────────────── */}
      {discoveryOpen && (
        <div style={{ backgroundColor: '#0F2140', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
                Select Set Discovery
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                Identify the 3-4 competitors your buyers most often compare you against in final evaluations.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={toggleStatusQuo}
                style={{
                  background: statusQuoActive ? 'rgba(232,82,10,0.18)' : 'none',
                  border: `1px solid ${statusQuoActive ? '#E8520A' : '#374151'}`,
                  borderRadius: '6px',
                  color: statusQuoActive ? '#FDBA74' : '#9CA3AF',
                  fontSize: '12px', fontWeight: 600,
                  padding: '6px 12px', minHeight: '32px', cursor: 'pointer',
                }}
              >
                {statusQuoActive ? '✓ ' : ''}Reserve Tab 4 for Status Quo
              </button>
              <button
                onClick={() => void runDiscovery()}
                disabled={discovering}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  backgroundColor: discovering ? '#374151' : '#E8520A',
                  border: 'none', borderRadius: '6px',
                  color: '#FFFFFF', fontSize: '12px', fontWeight: 600,
                  padding: '6px 14px', minHeight: '32px',
                  cursor: discovering ? 'not-allowed' : 'pointer',
                }}
              >
                {discovering
                  ? <><Loader2 size={12} className="animate-spin" /> Discovering…</>
                  : <><Sparkles size={12} /> Discover Competitors</>
                }
              </button>
              <button
                onClick={() => setDiscoveryOpen(false)}
                aria-label="Dismiss"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: '1px solid #374151', borderRadius: '6px',
                  color: '#9CA3AF', padding: '6px 10px', minHeight: '32px', cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Best practice tip banner */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            backgroundColor: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: '8px', padding: '10px 14px',
            marginBottom: '16px',
          }}>
            <AlertCircle size={15} style={{ color: '#FBBF24', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '12px', color: '#FCD34D', lineHeight: '1.55' }}>
              Focus on 3-4 Select Set competitors. These are the firms your buyers actually choose between in final decisions — not every company in your space.
            </p>
          </div>

          {/* Error */}
          {discoveryError && (
            <div style={{
              padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px',
              marginBottom: '16px',
            }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#FCA5A5' }}>{discoveryError}</p>
            </div>
          )}

          {/* Cards */}
          {sortedDiscovered.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              No competitors yet. Click <strong>Discover Competitors</strong> to surface candidates from your company profile, ICPs, and CVPs.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
              {sortedDiscovered.map(card => {
                const isAssigned = card.assignedToTab != null
                const align = alignmentBadge(card.alignmentScore)
                return (
                  <button
                    key={card.name}
                    onClick={() => handleCardClick(card)}
                    disabled={isAssigned}
                    title={isAssigned ? `Assigned to Comp ${card.assignedToTab}` : 'Click to assign to the next empty tab'}
                    style={{
                      textAlign: 'left',
                      backgroundColor: isAssigned ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isAssigned ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)'}`,
                      borderRadius: '8px', padding: '12px',
                      cursor: isAssigned ? 'default' : 'pointer',
                      opacity: isAssigned ? 0.55 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>{card.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700,
                          padding: '2px 8px', borderRadius: '999px',
                          backgroundColor: align.bg, color: align.color,
                          textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                        }}>{align.label}</span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700,
                          padding: '2px 8px', borderRadius: '999px',
                          backgroundColor: `${categoryColor(card.category)}22`,
                          color: categoryColor(card.category),
                          textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                        }}>{card.category}</span>
                        {card.dcpIdentified && (
                          <span style={{
                            fontSize: '10px', fontWeight: 700,
                            padding: '2px 8px', borderRadius: '999px',
                            backgroundColor: 'rgba(14,165,233,0.18)', color: '#0EA5E9',
                            textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                          }}>DCP Identified</span>
                        )}
                        {isAssigned && (
                          <span style={{
                            fontSize: '10px', fontWeight: 700,
                            padding: '2px 8px', borderRadius: '999px',
                            backgroundColor: 'rgba(232,82,10,0.18)', color: '#FDBA74',
                            textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                          }}>Comp {card.assignedToTab}</span>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                      {card.description}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Main grid: tabs+form (left) / tips (right) ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

        {/* Left column */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4].map(idx => {
              const comp = competitors[idx - 1]
              const isActive = idx === activeTab
              const isReserved = idx === TAB_COUNT && statusQuoActive && comp.name === STATUS_QUO_NAME
              const label = `Comp ${idx}`
              return (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  title={comp.name || label}
                  style={{
                    padding: '6px 14px', minHeight: '36px', maxWidth: '200px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    backgroundColor: isActive ? '#E8520A' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#0D0D0D',
                    border: `1px solid ${isActive ? '#E8520A' : isReserved ? '#FDBA74' : '#E5E7EB'}`,
                    borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Editor card */}
          <div style={PANEL_CARD}>
            {/* Loading overlay */}
            {autoFillingTab === activeTab && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 5,
                backgroundColor: 'rgba(255,255,255,0.75)',
                borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '10px',
              }}>
                <Loader2 size={26} className="animate-spin" style={{ color: '#E8520A' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0A1628' }}>Copilot is filling in details…</span>
              </div>
            )}

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label style={LABEL_STYLE}>Comp {activeTab}</label>
                {activeBadge && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    padding: '2px 8px', borderRadius: '999px',
                    backgroundColor: activeBadge.bg, color: activeBadge.color,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{activeBadge.label}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <SaveIndicator state={saveState} />
                {active.name.trim() !== '' && (
                  <button
                    onClick={() => removeCompetitor(activeTab)}
                    style={{
                      background: 'none', border: 'none', padding: '2px 4px',
                      color: '#EF4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {active.name.trim() === '' ? (
              <p style={{
                margin: 0, fontSize: '13px', color: '#6B7280',
                fontStyle: 'italic', padding: '24px 0', textAlign: 'center',
              }}>
                Click a competitor in the discovery panel or enter manually
              </p>
            ) : null}

            {/* Competitor Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>
                Competitor Name <span style={{ color: '#E8520A' }}>*</span>
              </label>
              <input
                type="text"
                value={active.name}
                onChange={e => updateField(activeTab, 'name', e.target.value)}
                placeholder="e.g. Acme Consulting"
                disabled={isStatusQuoTab}
                style={{ ...FIELD_INPUT, backgroundColor: isStatusQuoTab ? '#F3F4F6' : '#FFFFFF' }}
              />
            </div>

            {/* Why Buyers Choose Them */}
            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>Why Buyers Choose Them</label>
              <textarea
                value={active.whyBuyersChooseThem}
                onChange={e => updateField(activeTab, 'whyBuyersChooseThem', e.target.value)}
                placeholder="What do buyers say when they choose this competitor over you?"
                style={FIELD_TEXTAREA}
              />
            </div>

            {/* Their Key Promise */}
            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>Their Key Promise</label>
              <textarea
                value={active.keyPromise}
                onChange={e => updateField(activeTab, 'keyPromise', e.target.value)}
                placeholder="What is their primary value proposition?"
                style={FIELD_TEXTAREA}
              />
            </div>

            {/* Their Vulnerability */}
            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>Their Vulnerability</label>
              <textarea
                value={active.vulnerability}
                onChange={e => updateField(activeTab, 'vulnerability', e.target.value)}
                placeholder="Where are they weakest? What do they fail to deliver?"
                style={FIELD_TEXTAREA}
              />
            </div>

            {/* Deal Loss Frequency */}
            <div>
              <label style={LABEL_STYLE}>Deal Loss Frequency</label>
              <select
                value={active.dealFrequency}
                onChange={e => updateField(activeTab, 'dealFrequency', e.target.value as DealLossFrequency)}
                style={FIELD_INPUT}
              >
                <option value="">How often do you lose to them?</option>
                {DEAL_LOSS_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right column: tips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            backgroundColor: '#0F2140',
            border: '1px solid rgba(255,255,255,0.1)',
            borderLeft: '3px solid #E8520A',
            borderRadius: '10px',
            padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Lightbulb size={15} style={{ color: '#E8520A', flexShrink: 0 }} />
              <span style={{
                fontSize: '11px', fontWeight: 700,
                color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                Tips &amp; Best Practices
              </span>
            </div>
            <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: '14px' }} />
            {TIPS.map((tip, i) => (
              <div key={i}>
                <p style={{
                  fontSize: '13px', color: 'rgba(255,255,255,0.75)',
                  margin: 0, lineHeight: '1.6',
                }}>
                  {tip}
                </p>
                {i < TIPS.length - 1 && (
                  <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
