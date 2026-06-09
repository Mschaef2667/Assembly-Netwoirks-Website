'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Search, Lightbulb } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type DealLossFrequency = '' | 'Frequently' | 'Sometimes' | 'Rarely' | 'Unknown'

interface Competitor {
  index: number
  name: string
  why_buyers_choose: string
  key_promise: string
  vulnerability: string
  deal_loss_frequency: DealLossFrequency
}

type Category = 'agency' | 'consultancy' | 'fractional' | 'internal' | 'status quo'

interface DiscoveryOption {
  name: string
  description: string
  category: Category
  alignment_score: number
}

interface DiscoveryApiCompetitor {
  name: string
  description: string
  why_relevant: string
  alignment_score?: number
}

interface DiscoveryApiResult {
  known_validators?: DiscoveryApiCompetitor[]
  adjacent_competitors?: DiscoveryApiCompetitor[]
  emerging_threats?: DiscoveryApiCompetitor[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface CompetitorStepEditorProps {
  workspaceId: string
  stepId: string
  stepTitle: string
  preferredModel?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 800
const MAX_COMPETITORS = 4

const DEAL_LOSS_OPTIONS: DealLossFrequency[] = ['Frequently', 'Sometimes', 'Rarely', 'Unknown']

const TIPS: Array<{ headline: string; body: string }> = [
  {
    headline: 'Competitors are anyone your buyer considers',
    body: 'A competitor is any alternative your buyer considers — not just similar products.',
  },
  {
    headline: 'Where deals actually go',
    body: 'You most often lose to: other agencies, fractional executives, internal hires, or doing nothing.',
  },
  {
    headline: 'Focus on lost deals',
    body: 'Focus on who you LOSE DEALS to, not who has similar features.',
  },
  {
    headline: 'Vulnerability wins the comparison',
    body: 'Understanding their vulnerability is how you win the comparison.',
  },
]

const PANEL_CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  padding: '20px',
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

const STATUS_QUO_NAME = 'Status Quo / Do Nothing'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEmpty(idx: number): Competitor {
  return {
    index: idx,
    name: '',
    why_buyers_choose: '',
    key_promise: '',
    vulnerability: '',
    deal_loss_frequency: '',
  }
}

function defaultCompetitors(): Competitor[] {
  return [1, 2, 3, 4].map(makeEmpty)
}

function parseSaved(raw: unknown): Competitor[] {
  if (!Array.isArray(raw)) return defaultCompetitors()
  const out = defaultCompetitors()
  for (const r of raw as Array<Record<string, unknown>>) {
    const idx = Number(r['index'])
    if (!Number.isFinite(idx) || idx < 1 || idx > MAX_COMPETITORS) continue
    const freqRaw = String(r['deal_loss_frequency'] ?? '')
    const freq: DealLossFrequency =
      freqRaw === 'Frequently' || freqRaw === 'Sometimes' || freqRaw === 'Rarely' || freqRaw === 'Unknown'
        ? freqRaw
        : ''
    out[idx - 1] = {
      index: idx,
      name: String(r['name'] ?? ''),
      why_buyers_choose: String(r['why_buyers_choose'] ?? ''),
      key_promise: String(r['key_promise'] ?? ''),
      vulnerability: String(r['vulnerability'] ?? ''),
      deal_loss_frequency: freq,
    }
  }
  return out
}

function categorise(name: string, description: string, group: 'known' | 'adjacent' | 'emerging'): Category {
  const blob = `${name} ${description}`.toLowerCase()
  if (blob.includes('agency') || blob.includes('agencies')) return 'agency'
  if (blob.includes('consultanc') || blob.includes('consultant')) return 'consultancy'
  if (blob.includes('fractional') || blob.includes('interim')) return 'fractional'
  if (blob.includes('in-house') || blob.includes('internal hire') || blob.includes('build in-house')) return 'internal'
  if (group === 'adjacent') return 'consultancy'
  return 'agency'
}

function parseAlignmentScore(raw: unknown): number {
  const v = Number(raw)
  if (!Number.isFinite(v)) return 5
  return Math.max(1, Math.min(10, Math.round(v)))
}

function flattenDiscovery(api: DiscoveryApiResult): DiscoveryOption[] {
  const flat: DiscoveryOption[] = []
  for (const c of api.known_validators ?? []) {
    flat.push({ name: c.name, description: c.description, category: categorise(c.name, c.description, 'known'), alignment_score: parseAlignmentScore(c.alignment_score) })
  }
  for (const c of api.adjacent_competitors ?? []) {
    flat.push({ name: c.name, description: c.description, category: categorise(c.name, c.description, 'adjacent'), alignment_score: parseAlignmentScore(c.alignment_score) })
  }
  for (const c of api.emerging_threats ?? []) {
    flat.push({ name: c.name, description: c.description, category: categorise(c.name, c.description, 'emerging'), alignment_score: parseAlignmentScore(c.alignment_score) })
  }
  return flat
    .filter(o => !o.name.toLowerCase().includes('status quo'))
    .sort((a, b) => b.alignment_score - a.alignment_score)
}

function threatBadge(score: number): { label: string; color: string; bg: string } {
  if (score >= 8) return { label: 'HIGH THREAT', color: '#FFFFFF', bg: '#EF4444' }
  if (score >= 5) return { label: 'MODERATE', color: '#FFFFFF', bg: '#F59E0B' }
  return { label: 'INDIRECT', color: '#FFFFFF', bg: '#10B981' }
}

function categoryColor(c: Category): string {
  switch (c) {
    case 'agency': return '#0EA5E9'
    case 'consultancy': return '#A855F7'
    case 'fractional': return '#F59E0B'
    case 'internal': return '#10B981'
    case 'status quo': return '#6B7280'
  }
}

function categoryLabel(c: Category): string {
  if (c === 'status quo') return 'Alternative'
  return c.charAt(0).toUpperCase() + c.slice(1)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280' }}>
      <Loader2 size={12} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return <span style={{ fontSize: '12px', color: '#16A34A' }}>Saved</span>
  return <span style={{ fontSize: '12px', color: '#EF4444' }}>Save failed</span>
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompetitorStepEditor({
  workspaceId,
  stepId,
  stepTitle,
  preferredModel = 'claude-sonnet-4-5',
}: CompetitorStepEditorProps) {
  const [loading, setLoading] = useState(true)
  const [competitors, setCompetitors] = useState<Competitor[]>(defaultCompetitors())
  const [activeTab, setActiveTab] = useState(1)
  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const [discoveryOptions, setDiscoveryOptions] = useState<DiscoveryOption[] | null>(null)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [applyMsg, setApplyMsg] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('step_output')
          .select('id, content, version')
          .eq('workspace_id', workspaceId)
          .eq('step_id', stepId)
          .order('version', { ascending: false })
          .limit(1)

        if (data && data.length > 0) {
          const row = data[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          if (c && Array.isArray(c['competitors'])) {
            setCompetitors(parseSaved(c['competitors']))
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

  const persistContent = useCallback(async (rows: Competitor[]) => {
    setSaveState('saving')
    try {
      const contentPayload = { competitors: rows }
      const now = new Date().toISOString()

      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content: contentPayload, last_saved_at: now, last_updated_at: now })
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
            content: contentPayload,
            copilot_assisted: false,
            last_saved_at: now,
            last_updated_at: now,
          })
          .select('id')
          .single()
        if (error) throw error
        if (data) setOutputId((data as Record<string, unknown>)['id'] as string)
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }, [outputId, outputVersion, stepId, workspaceId])

  saveRef.current = async () => { await persistContent(competitors) }

  function scheduleSave(next?: Competitor[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (next) void persistContent(next)
      else void saveRef.current()
    }, AUTOSAVE_MS)
  }

  function updateField<K extends keyof Competitor>(idx: number, field: K, value: Competitor[K]) {
    setCompetitors(prev => {
      const next = prev.map(c => c.index === idx ? { ...c, [field]: value } : c)
      scheduleSave(next)
      return next
    })
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void saveRef.current()
  }

  // ── Discovery ───────────────────────────────────────────────────────────────

  async function runDiscovery() {
    if (discoveryLoading) return
    setDiscoveryLoading(true)
    setDiscoveryOptions(null)
    setDiscoveryError(null)
    setSelectedNames([])

    try {
      const [s1, s2, s3, s11, icpFirm] = await Promise.all([
        supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '1').order('version', { ascending: false }).limit(1),
        supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '2').order('version', { ascending: false }).limit(1),
        supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '3').order('version', { ascending: false }).limit(1),
        supabase.from('step_output').select('content').eq('workspace_id', workspaceId).eq('step_id', '11').order('version', { ascending: false }).limit(1),
        supabase.from('icp_definition').select('segment_name, industry_verticals, company_size_range, job_titles').eq('org_id', workspaceId),
      ] as const)

      function getStepText(data: Array<Record<string, unknown>> | null): string {
        if (!data || data.length === 0) return 'Not provided.'
        const c = data[0]['content']
        return c ? JSON.stringify(c, null, 2) : 'Not provided.'
      }

      const companyContext = [
        'STEP 1 - PRODUCT/SERVICE PROFILE:\n' + getStepText(s1.data as Array<Record<string, unknown>> | null),
        'STEP 2 - TARGET SEGMENTS:\n' + getStepText(s2.data as Array<Record<string, unknown>> | null),
        'STEP 3 - DECISION MAKERS:\n' + getStepText(s3.data as Array<Record<string, unknown>> | null),
      ].join('\n\n')

      const cvpContext = 'STEP 11 - CUSTOMER VALUE PROPOSITIONS:\n' + getStepText(s11.data as Array<Record<string, unknown>> | null)

      const icpLines: string[] = []
      if (icpFirm.data) {
        for (const rawRow of icpFirm.data) {
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

      const painPointContext = 'See Step 4 endemic problem and Step 11 CVPs above.'

      const res = await fetch('/api/copilot/competitive-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          companyContext,
          icpContext,
          painPointContext,
          cvpContext,
          preferredModel,
        }),
      })

      if (!res.ok) {
        let errMsg = `Error ${res.status}`
        try {
          const errBody = (await res.json()) as Record<string, unknown>
          errMsg = String(errBody['error'] ?? errMsg)
        } catch { /* ignore */ }
        setDiscoveryError(res.status === 422 ? 'Could not parse competitor data. Please try again.' : errMsg)
        return
      }

      const data = (await res.json()) as DiscoveryApiResult
      const discovered = flattenDiscovery(data)
      console.log('[CompetitorStepEditor] discovered array length:', discovered.length, discovered)
      setDiscoveryOptions(discovered)
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'An error occurred during discovery.')
    } finally {
      setDiscoveryLoading(false)
    }
  }

  const includeStatusQuo = competitors[3]?.name === STATUS_QUO_NAME
  const maxSelectable = includeStatusQuo ? MAX_COMPETITORS - 1 : MAX_COMPETITORS

  function toggleSelect(name: string) {
    setSelectedNames(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name)
      if (prev.length >= maxSelectable) return prev
      return [...prev, name]
    })
  }

  function toggleStatusQuo() {
    setCompetitors(prev => {
      const next = prev.map(c => ({ ...c }))
      const c4 = next[3]
      if (c4.name === STATUS_QUO_NAME) {
        next[3] = makeEmpty(4)
      } else {
        next[3] = { ...makeEmpty(4), name: STATUS_QUO_NAME }
      }
      scheduleSave(next)
      return next
    })
    setSelectedNames(prev => prev.slice(0, MAX_COMPETITORS - 1))
  }

  async function autofillCompetitor(opt: DiscoveryOption): Promise<{ why_buyers_choose_them: string; their_key_promise: string; their_vulnerability: string }> {
    const empty = { why_buyers_choose_them: '', their_key_promise: '', their_vulnerability: '' }
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
          extraContext: `Competitor: ${opt.name}\nDescription: ${opt.description}`,
        }),
      })
      if (!res.ok || !res.body) return empty
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }
      if (accumulated.includes('__STREAM_ERROR__')) return empty
      const stripped = accumulated
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      const firstBrace = stripped.indexOf('{')
      const lastBrace = stripped.lastIndexOf('}')
      const jsonText = firstBrace !== -1 && lastBrace > firstBrace ? stripped.slice(firstBrace, lastBrace + 1) : stripped
      const parsed = JSON.parse(jsonText) as Record<string, unknown>
      return {
        why_buyers_choose_them: String(parsed['why_buyers_choose_them'] ?? ''),
        their_key_promise: String(parsed['their_key_promise'] ?? ''),
        their_vulnerability: String(parsed['their_vulnerability'] ?? ''),
      }
    } catch {
      return empty
    }
  }

  async function applySelection() {
    if (selectedNames.length === 0 || applying) return
    setApplying(true)
    try {
      const optionsByName = new Map((discoveryOptions ?? []).map(o => [o.name, o]))
      const maxFill = includeStatusQuo ? MAX_COMPETITORS - 1 : MAX_COMPETITORS
      const targets = selectedNames.slice(0, maxFill)

      let appliedCount = 0
      for (let i = 0; i < targets.length; i++) {
        const name = targets[i]
        const tabIndex = i + 1
        const opt = optionsByName.get(name)
        const fill = opt
          ? await autofillCompetitor(opt)
          : { why_buyers_choose_them: '', their_key_promise: '', their_vulnerability: '' }

        setCompetitors(prev => {
          const next = prev.map(c => ({ ...c }))
          const target = next.find(c => c.index === tabIndex)
          if (target) {
            target.name = name
            if (fill.why_buyers_choose_them) target.why_buyers_choose = fill.why_buyers_choose_them
            if (fill.their_key_promise) target.key_promise = fill.their_key_promise
            if (fill.their_vulnerability) target.vulnerability = fill.their_vulnerability
          }
          scheduleSave(next)
          return next
        })
        appliedCount++
      }

      setApplyMsg(`Added ${appliedCount} competitor${appliedCount === 1 ? '' : 's'} to your tabs ✓`)
      setSelectedNames([])
      setTimeout(() => setApplyMsg(null), 2500)
    } finally {
      setApplying(false)
    }
  }

  function dismissDiscovery() {
    setDiscoveryOptions(null)
    setSelectedNames([])
  }

  function removeActiveCompetitor() {
    if (typeof window !== 'undefined' && !window.confirm('Remove this competitor and clear all fields?')) return
    setCompetitors(prev => {
      const next = prev.map(c => c.index === activeTab ? makeEmpty(activeTab) : c)
      scheduleSave(next)
      return next
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  const active = competitors[activeTab - 1]
  void stepTitle

  return (
    <>
      {/* ── Discover Competitors button ────────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => void runDiscovery()}
          disabled={discoveryLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', minHeight: '44px',
            backgroundColor: discoveryLoading ? '#F3F4F6' : '#0EA5E9',
            color: discoveryLoading ? '#9CA3AF' : '#FFFFFF',
            border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600,
            cursor: discoveryLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {discoveryLoading
            ? <><Loader2 size={15} className="animate-spin" /> Searching for competitors…</>
            : <><Search size={15} /> Discover Competitors with Copilot</>
          }
        </button>
        <p style={{
          margin: '8px 0 0',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.55)',
        }}>
          Copilot uses web search across your company profile, ICPs, and CVPs to surface the alternatives your buyers actually consider.
        </p>
      </div>

      {discoveryError && (
        <div style={{
          padding: '12px 16px', backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5', borderRadius: '8px', marginBottom: '16px',
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#991B1B' }}>{discoveryError}</p>
        </div>
      )}

      {discoveryOptions && (
        <div style={{ backgroundColor: '#0F2140', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
                Potential Competitors
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                Select up to {maxSelectable} to populate your competitor tabs ({selectedNames.length}/{maxSelectable} selected).
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={toggleStatusQuo}
                style={{
                  background: includeStatusQuo ? 'rgba(232,82,10,0.18)' : 'none',
                  border: `1px solid ${includeStatusQuo ? '#E8520A' : '#374151'}`,
                  borderRadius: '6px',
                  color: includeStatusQuo ? '#FDBA74' : '#9CA3AF',
                  fontSize: '12px', fontWeight: 600,
                  padding: '6px 12px', minHeight: '32px',
                  cursor: 'pointer',
                }}
              >
                {includeStatusQuo ? '✓ ' : ''}Include Status Quo / Do Nothing
              </button>
              <button
                onClick={dismissDiscovery}
                style={{
                  background: 'none', border: '1px solid #374151', borderRadius: '6px',
                  color: '#9CA3AF', fontSize: '12px', padding: '6px 12px',
                  cursor: 'pointer', minHeight: '32px',
                }}
              >
                Dismiss
              </button>
              <button
                onClick={() => void applySelection()}
                disabled={selectedNames.length === 0 || applying}
                style={{
                  backgroundColor: selectedNames.length === 0 || applying ? '#6B7280' : '#E8520A',
                  border: 'none', borderRadius: '6px',
                  color: '#FFFFFF', fontSize: '12px', fontWeight: 600,
                  padding: '6px 14px', minHeight: '32px',
                  cursor: selectedNames.length === 0 || applying ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {applying && <Loader2 size={12} className="animate-spin" />}
                {applying ? 'Generating profiles…' : 'Apply Selection'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {discoveryOptions.slice(0, 6).map((opt, i) => {
              const isSelected = selectedNames.includes(opt.name)
              const atLimit = !isSelected && selectedNames.length >= maxSelectable
              const threat = threatBadge(opt.alignment_score)
              return (
                <button
                  key={`${opt.name}-${i}`}
                  onClick={() => { if (!atLimit) toggleSelect(opt.name) }}
                  disabled={atLimit}
                  style={{
                    textAlign: 'left',
                    backgroundColor: isSelected ? 'rgba(232,82,10,0.18)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isSelected ? '#E8520A' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: atLimit ? 'not-allowed' : 'pointer',
                    opacity: atLimit ? 0.45 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>{opt.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '999px',
                        backgroundColor: threat.bg,
                        color: threat.color,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}>
                        {threat.label}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '999px',
                        backgroundColor: `${categoryColor(opt.category)}22`,
                        color: categoryColor(opt.category),
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}>
                        {categoryLabel(opt.category)}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                    {opt.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {applyMsg && (
        <div style={{
          padding: '10px 14px', backgroundColor: 'rgba(22,163,74,0.15)',
          border: '1px solid rgba(22,163,74,0.45)', borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '13px', fontWeight: 600, color: '#86EFAC',
        }}>
          {applyMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

        {/* ── Left: tabs + form ─────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4].map(idx => {
              const comp = competitors[idx - 1]
              const fullLabel = comp.name.trim() || `Comp ${idx}`
              const label = `Comp ${idx}`
              const isActive = idx === activeTab
              return (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  title={fullLabel}
                  style={{
                    padding: '6px 14px',
                    minHeight: '36px',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    backgroundColor: isActive ? '#E8520A' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#0D0D0D',
                    border: `1px solid ${isActive ? '#E8520A' : '#E5E7EB'}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div style={PANEL_CARD}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <label style={LABEL_STYLE}>Competitor {activeTab}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <SaveIndicator state={saveState} />
                <button
                  onClick={removeActiveCompetitor}
                  style={{
                    background: 'none', border: 'none', padding: '2px 4px',
                    color: '#EF4444', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Remove Competitor
                </button>
              </div>
            </div>

            {/* Competitor Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>
                Competitor Name <span style={{ color: '#E8520A' }}>*</span>
              </label>
              <input
                type="text"
                value={active.name}
                onChange={e => updateField(activeTab, 'name', e.target.value)}
                onBlur={handleBlur}
                placeholder="e.g. Acme Consulting, Status Quo / Do Nothing"
                style={FIELD_INPUT}
              />
            </div>

            {/* Why Buyers Choose Them */}
            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>Why Buyers Choose Them</label>
              <textarea
                value={active.why_buyers_choose}
                onChange={e => updateField(activeTab, 'why_buyers_choose', e.target.value)}
                onBlur={handleBlur}
                placeholder="What do buyers say when they choose this competitor over you?"
                style={FIELD_TEXTAREA}
              />
            </div>

            {/* Their Key Promise */}
            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>Their Key Promise</label>
              <textarea
                value={active.key_promise}
                onChange={e => updateField(activeTab, 'key_promise', e.target.value)}
                onBlur={handleBlur}
                placeholder="What is their primary value proposition or CVP?"
                style={FIELD_TEXTAREA}
              />
            </div>

            {/* Their Vulnerability */}
            <div style={{ marginBottom: '16px' }}>
              <label style={LABEL_STYLE}>Their Vulnerability</label>
              <textarea
                value={active.vulnerability}
                onChange={e => updateField(activeTab, 'vulnerability', e.target.value)}
                onBlur={handleBlur}
                placeholder="Where are they weakest? What do they fail to deliver?"
                style={FIELD_TEXTAREA}
              />
            </div>

            {/* Deal Loss Frequency */}
            <div>
              <label style={LABEL_STYLE}>Deal Loss Frequency</label>
              <select
                value={active.deal_loss_frequency}
                onChange={e => updateField(activeTab, 'deal_loss_frequency', e.target.value as DealLossFrequency)}
                onBlur={handleBlur}
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

        {/* ── Right: Tips panel ─────────────────────────────────────────────── */}
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
                fontSize: '11px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                Tips &amp; Best Practices
              </span>
            </div>
            <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: '14px' }} />
            {TIPS.map((tip, i) => (
              <div key={i}>
                <div style={{ paddingBottom: i < TIPS.length - 1 ? '12px' : '0' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px', lineHeight: '1.4' }}>
                    {tip.headline}
                  </p>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: '1.6' }}>
                    {tip.body}
                  </p>
                </div>
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
