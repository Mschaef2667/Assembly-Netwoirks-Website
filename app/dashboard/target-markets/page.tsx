'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Loader2, Wand2, ChevronDown, ChevronRight, Plus, X, AlertTriangle, Check, Lock, MessageSquare, ArrowRight, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import BaselineProfiles from '@/components/icp/BaselineProfiles'

// ── Types ─────────────────────────────────────────────────────────────────────

type BuyerType = 'economic_buyer' | 'champion'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Segment {
  index: number
  name: string
  description: string
}

// Shape BaselineProfiles (Step 1) expects. Segments carry firmographics so a
// baseline profile can prefill industry / company size from its segment.
interface BaselineSegment {
  index: number
  name: string
  industry?: string
  companySize?: string
}

interface Objection {
  objection: string
  overcomes: string
}

interface IcpFormData {
  buyer_type: BuyerType
  job_titles: string[]
  company_size_range: string
  industry_verticals: string[]
  decision_making_power: string
  budget_range: string
  buying_motion: string
  buying_urgency_trigger: string
  primary_challenges: string[]
  barriers_to_success: string[]
  the_big_win: string
  success_metrics: string[]
  buying_triggers: string[]
  information_sources: string[]
  preferred_communication: string
  purchase_criteria: string[]
  buyer_values: string
  common_objections: Objection[]
  risk_sensitivities: string
  tech_stack: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 800

const CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '20px',
}

const LABEL_ST: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '6px',
}

const INPUT_ST: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#FFFFFF',
  backgroundColor: '#1A3050',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
  minHeight: '40px',
}

const TEXTAREA_ST: React.CSSProperties = {
  ...INPUT_ST,
  minHeight: '80px',
  resize: 'vertical',
  lineHeight: '1.6',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultIcp(buyerType: BuyerType = 'economic_buyer'): IcpFormData {
  return {
    buyer_type: buyerType,
    job_titles: [],
    company_size_range: '',
    industry_verticals: [],
    decision_making_power: '',
    budget_range: '',
    buying_motion: '',
    buying_urgency_trigger: '',
    primary_challenges: [],
    barriers_to_success: [],
    the_big_win: '',
    success_metrics: [],
    buying_triggers: [],
    information_sources: [],
    preferred_communication: '',
    purchase_criteria: [],
    buyer_values: '',
    common_objections: [],
    risk_sensitivities: '',
    tech_stack: '',
  }
}

function setAt<T>(arr: T[], i: number, val: T): T[] {
  return arr.map((x, idx) => (idx === i ? val : x))
}

function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again."
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return 'The request took too long. Try again.'
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

function sanitizeIcp(parsed: Record<string, unknown>): IcpFormData {
  const d = defaultIcp()
  const strArr = (v: unknown, max: number): string[] =>
    Array.isArray(v) ? (v as unknown[]).map(String).slice(0, max) : []
  const objArr = (v: unknown): Objection[] =>
    Array.isArray(v)
      ? (v as Array<Record<string, unknown>>).slice(0, 5).map(o => ({
          objection: typeof o['objection'] === 'string' ? o['objection'] : '',
          overcomes: typeof o['overcomes'] === 'string' ? o['overcomes'] : '',
        }))
      : []

  return {
    buyer_type: parsed['buyer_type'] === 'champion' ? 'champion' : 'economic_buyer',
    job_titles: strArr(parsed['job_titles'], 10),
    company_size_range: typeof parsed['company_size_range'] === 'string' ? parsed['company_size_range'] : d.company_size_range,
    industry_verticals: strArr(parsed['industry_verticals'], 10),
    decision_making_power: typeof parsed['decision_making_power'] === 'string' ? parsed['decision_making_power'] : d.decision_making_power,
    budget_range: typeof parsed['budget_range'] === 'string' ? parsed['budget_range'] : d.budget_range,
    buying_motion: typeof parsed['buying_motion'] === 'string' ? parsed['buying_motion'] : d.buying_motion,
    buying_urgency_trigger: typeof parsed['buying_urgency_trigger'] === 'string' ? parsed['buying_urgency_trigger'] : d.buying_urgency_trigger,
    primary_challenges: strArr(parsed['primary_challenges'], 5),
    barriers_to_success: strArr(parsed['barriers_to_success'], 5),
    the_big_win: typeof parsed['the_big_win'] === 'string' ? parsed['the_big_win'] : d.the_big_win,
    success_metrics: strArr(parsed['success_metrics'], 5),
    buying_triggers: strArr(parsed['buying_triggers'], 5),
    information_sources: strArr(parsed['information_sources'], 6),
    preferred_communication: typeof parsed['preferred_communication'] === 'string' ? parsed['preferred_communication'] : d.preferred_communication,
    purchase_criteria: strArr(parsed['purchase_criteria'], 5),
    buyer_values: typeof parsed['buyer_values'] === 'string' ? parsed['buyer_values'] : d.buyer_values,
    common_objections: objArr(parsed['common_objections']),
    risk_sensitivities: typeof parsed['risk_sensitivities'] === 'string' ? parsed['risk_sensitivities'] : d.risk_sensitivities,
    tech_stack: typeof parsed['tech_stack'] === 'string' ? parsed['tech_stack'] : d.tech_stack,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
      <Loader2 size={11} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#16A34A' }}>
      <Check size={11} /> Saved
    </span>
  )
  return <span style={{ fontSize: '12px', color: '#EF4444' }}>Save failed</span>
}

function StepHeading({ n, title, subtitle, locked = false }: { n: number; title: string; subtitle: string; locked?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
      <div style={{
        flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: 700,
        backgroundColor: locked ? 'rgba(255,255,255,0.06)' : 'rgba(232,82,10,0.15)',
        color: locked ? 'rgba(255,255,255,0.45)' : '#E8520A',
      }}>
        {n}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#FFFFFF' }}>{title}</h2>
          {locked && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
              color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '999px', padding: '2px 9px',
            }}>
              <Lock size={10} /> Locked
            </span>
          )}
        </div>
        <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.55' }}>{subtitle}</p>
      </div>
    </div>
  )
}

function TagInput({
  tags, onChange, maxItems = 10, placeholder = 'Type and press Enter…',
}: { tags: string[]; onChange: (tags: string[]) => void; maxItems?: number; placeholder?: string }) {
  const [input, setInput] = useState('')
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const t = input.trim()
      if (t && !tags.includes(t) && tags.length < maxItems) {
        onChange([...tags, t])
        setInput('')
      }
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
      padding: '8px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
      backgroundColor: '#1A3050', minHeight: '44px',
    }}>
      {tags.map((tag, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 10px', backgroundColor: 'rgba(14,165,233,0.15)',
          color: '#0EA5E9', borderRadius: '999px', fontSize: '13px', fontWeight: 500,
        }}>
          {tag}
          <button onClick={() => onChange(tags.filter((_, ti) => ti !== i))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0EA5E9', padding: '0 0 0 2px', lineHeight: 1 }}>
            ×
          </button>
        </span>
      ))}
      {tags.length < maxItems && (
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{ flex: 1, minWidth: '120px', border: 'none', outline: 'none', fontSize: '14px', color: '#FFFFFF', backgroundColor: 'transparent' }} />
      )}
    </div>
  )
}

function ListInput({
  values, onChange, maxItems = 5, placeholder = 'Enter item…',
}: { values: string[]; onChange: (values: string[]) => void; maxItems?: number; placeholder?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="text" value={v} placeholder={placeholder}
            onChange={e => { const n = [...values]; n[i] = e.target.value; onChange(n) }}
            style={{ ...INPUT_ST, flex: 1 }} />
          <button onClick={() => onChange(values.filter((_, vi) => vi !== i))}
            style={{ minWidth: '32px', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'transparent', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#DC2626', cursor: 'pointer' }}>
            <X size={13} />
          </button>
        </div>
      ))}
      {values.length < maxItems && (
        <button onClick={() => onChange([...values, ''])}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', minHeight: '36px',
            backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px dashed rgba(255,255,255,0.2)',
            borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Add item
        </button>
      )}
    </div>
  )
}

function ObjectionsInput({ objections, onChange }: { objections: Objection[]; onChange: (o: Objection[]) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {objections.map((obj, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: '6px', alignItems: 'center' }}>
          <input type="text" value={obj.objection} placeholder="Objection…"
            onChange={e => { const n = [...objections]; n[i] = { ...n[i], objection: e.target.value }; onChange(n) }}
            style={INPUT_ST} />
          <input type="text" value={obj.overcomes} placeholder="What overcomes it…"
            onChange={e => { const n = [...objections]; n[i] = { ...n[i], overcomes: e.target.value }; onChange(n) }}
            style={INPUT_ST} />
          <button onClick={() => onChange(objections.filter((_, oi) => oi !== i))}
            style={{ minWidth: '32px', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'transparent', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#DC2626', cursor: 'pointer' }}>
            <X size={13} />
          </button>
        </div>
      ))}
      {objections.length < 5 && (
        <button onClick={() => onChange([...objections, { objection: '', overcomes: '' }])}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', minHeight: '36px',
            backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px dashed rgba(255,255,255,0.2)',
            borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Add objection
        </button>
      )}
    </div>
  )
}

// ── ICP Preview Panel ─────────────────────────────────────────────────────────

function IcpPreviewPanel({
  preview, onApply, onDiscard,
}: { preview: IcpFormData; onApply: () => void; onDiscard: () => void }) {
  return (
    <div style={{ ...CARD, border: '2px solid #E8520A', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#E8520A', margin: 0 }}>
          Copilot generated ICP — review before applying
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onApply}
            style={{ minHeight: '36px', padding: '0 16px', backgroundColor: '#E8520A', color: '#FFFFFF',
              border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Apply to form
          </button>
          <button onClick={onDiscard}
            style={{ minHeight: '36px', padding: '0 16px', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Discard
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
        {preview.buyer_type && <div><strong>Buyer type:</strong> {preview.buyer_type.replace('_', ' ')}</div>}
        {preview.company_size_range && <div><strong>Company size:</strong> {preview.company_size_range}</div>}
        {preview.budget_range && <div><strong>Budget:</strong> {preview.budget_range}</div>}
        {preview.buying_motion && <div><strong>Buying motion:</strong> {preview.buying_motion}</div>}
        {preview.job_titles.length > 0 && <div style={{ gridColumn: 'span 2' }}><strong>Job titles:</strong> {preview.job_titles.join(', ')}</div>}
        {preview.primary_challenges.length > 0 && (
          <div style={{ gridColumn: 'span 2' }}><strong>Primary challenges:</strong> {preview.primary_challenges.join(' · ')}</div>
        )}
        {preview.the_big_win && <div style={{ gridColumn: 'span 2' }}><strong>The big win:</strong> {preview.the_big_win}</div>}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TargetMarketsPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [preferredModel, setPreferredModel] = useState('claude-sonnet-4-5')
  const [loading, setLoading] = useState(true)
  const [gate1Approved, setGate1Approved] = useState<boolean | null>(null)
  const [missingEndemicSteps, setMissingEndemicSteps] = useState<string[]>([])

  // Segments (from Step 2)
  const [segments, setSegments] = useState<Segment[]>([
    { index: 1, name: 'Segment 1', description: '' },
    { index: 2, name: 'Segment 2', description: '' },
    { index: 3, name: 'Segment 3', description: '' },
  ])

  // Firmographic-bearing view of the segments, passed to Step 1 (Baseline Profiles).
  const [baselineSegments, setBaselineSegments] = useState<BaselineSegment[]>([])

  // Step 2 status panel: how many buyer responses exist to tag.
  const [responseCount, setResponseCount] = useState<number | null>(null)


  // ICP forms (index 0, 1, 2 = segments 1, 2, 3) — independent per buyer_type
  const [icpForms, setIcpForms] = useState<Record<BuyerType, IcpFormData>[]>([
    { economic_buyer: defaultIcp('economic_buyer'), champion: defaultIcp('champion') },
    { economic_buyer: defaultIcp('economic_buyer'), champion: defaultIcp('champion') },
    { economic_buyer: defaultIcp('economic_buyer'), champion: defaultIcp('champion') },
  ])
  // The id of the ICP row the client marked primary. Exactly one per org, enforced
  // by a partial unique index, so switching primary is a two-step update.
  const [primaryIcpId, setPrimaryIcpId] = useState<string | null>(null)
  const [primarySaving, setPrimarySaving] = useState(false)
  const [icpDbIds, setIcpDbIds] = useState<Record<BuyerType, string | null>[]>([
    { economic_buyer: null, champion: null },
    { economic_buyer: null, champion: null },
    { economic_buyer: null, champion: null },
  ])
  const [icpSaveStates, setIcpSaveStates] = useState<Record<BuyerType, SaveState>[]>([
    { economic_buyer: 'idle', champion: 'idle' },
    { economic_buyer: 'idle', champion: 'idle' },
    { economic_buyer: 'idle', champion: 'idle' },
  ])
  const [activeBuyerType, setActiveBuyerType] = useState<BuyerType[]>(['economic_buyer', 'economic_buyer', 'economic_buyer'])
  const [openAccordions, setOpenAccordions] = useState<boolean[]>([true, false, false])

  // Copilot per segment
  const [copilotLoading, setCopilotLoading] = useState<boolean[]>([false, false, false])
  const [copilotPreviews, setCopilotPreviews] = useState<(IcpFormData | null)[]>([null, null, null])
  const [copilotErrors, setCopilotErrors] = useState<(string | null)[]>([null, null, null])


  // Refs
  const icpFormsRef = useRef<Record<BuyerType, IcpFormData>[]>([
    { economic_buyer: defaultIcp('economic_buyer'), champion: defaultIcp('champion') },
    { economic_buyer: defaultIcp('economic_buyer'), champion: defaultIcp('champion') },
    { economic_buyer: defaultIcp('economic_buyer'), champion: defaultIcp('champion') },
  ])
  const segmentsRef = useRef<Segment[]>(segments)
  const icpDbIdsRef = useRef<Record<BuyerType, string | null>[]>([
    { economic_buyer: null, champion: null },
    { economic_buyer: null, champion: null },
    { economic_buyer: null, champion: null },
  ])
  const activeBuyerTypeRef = useRef<BuyerType[]>(['economic_buyer', 'economic_buyer', 'economic_buyer'])
  const workspaceIdRef = useRef<string | null>(null)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Keep refs current
  icpFormsRef.current = icpForms
  segmentsRef.current = segments
  icpDbIdsRef.current = icpDbIds
  activeBuyerTypeRef.current = activeBuyerType
  workspaceIdRef.current = workspaceId

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase.from('users').select('org_id').eq('id', user.id).single()
        if (!userRow) return
        const wsId = (userRow as Record<string, unknown>)['org_id'] as string
        setWorkspaceId(wsId)
        workspaceIdRef.current = wsId

        // Preferred model
        const { data: org } = await supabase.from('organizations').select('preferred_model').eq('id', wsId).single()
        if (org) setPreferredModel(String((org as Record<string, unknown>)['preferred_model'] ?? 'claude-sonnet-4-5'))

        // Gate 1 status — required to unlock ICP Calibrator
        const { data: dcpRow } = await supabase
          .from('dcp_analysis')
          .select('status')
          .eq('org_id', wsId)
          .maybeSingle()
        const dcpStatus = dcpRow ? String((dcpRow as Record<string, unknown>)['status'] ?? '') : ''
        setGate1Approved(dcpStatus === 'approved')

        // Step 2 segments
        const { data: step2Rows } = await supabase
          .from('step_output')
          .select('content')
          .eq('workspace_id', wsId)
          .eq('step_id', '2')
          .order('version', { ascending: false })
          .limit(1)
        if (step2Rows && step2Rows.length > 0) {
          const c = (step2Rows[0] as Record<string, unknown>)['content'] as Record<string, unknown> | null
          const rawSegs = c?.['segments']
          if (Array.isArray(rawSegs) && rawSegs.length > 0) {
            const segArr = (rawSegs as Array<Record<string, unknown>>).slice(0, 3)
            const loaded = segArr.map((s, i) => ({
              index: i + 1,
              name: typeof s['name'] === 'string' && s['name'].trim() ? s['name'] : `Segment ${i + 1}`,
              description: typeof s['description'] === 'string' ? s['description'] : '',
            }))
            // Fill to 3 if fewer defined
            while (loaded.length < 3) {
              loaded.push({ index: loaded.length + 1, name: `Segment ${loaded.length + 1}`, description: '' })
            }
            setSegments(loaded)

            // Firmographic view for Step 1. Only real segments (not the filler),
            // carrying industry / company_size so baseline profiles can prefill.
            setBaselineSegments(segArr.map((s, i) => ({
              index: i + 1,
              name: typeof s['name'] === 'string' && s['name'].trim() ? String(s['name']) : `Segment ${i + 1}`,
              industry: typeof s['industry'] === 'string' ? String(s['industry']) : undefined,
              companySize: typeof s['company_size'] === 'string' ? String(s['company_size']) : undefined,
            })))
          }
        }

        // Step 2 status: count buyer responses available to tag.
        const { count: respCount } = await supabase
          .from('survey_link_responses')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', wsId)
        setResponseCount(respCount ?? 0)

        // Endemic Problems readiness (Steps 4-8) — soft warning, never blocks
        const { data: endemicRows } = await supabase
          .from('step_output')
          .select('step_id, content')
          .eq('workspace_id', wsId)
          .in('step_id', ['4', '5', '6', '7', '8'])
          .order('version', { ascending: false })
        const latestEndemicByStep = new Map<string, Record<string, unknown> | null>()
        for (const raw of (endemicRows ?? []) as Array<Record<string, unknown>>) {
          const sid = String(raw['step_id'] ?? '')
          if (latestEndemicByStep.has(sid)) continue
          latestEndemicByStep.set(sid, (raw['content'] as Record<string, unknown> | null) ?? null)
        }
        const missing: string[] = []
        for (const sid of ['4', '5', '6', '7', '8']) {
          const content = latestEndemicByStep.get(sid) ?? null
          // Mirror runCopilot's journeyContext construction: use content.text if present,
          // otherwise JSON.stringify(content). Treat empty/blank result as missing.
          const text = content?.['text'] ? String(content['text']) : JSON.stringify(content ?? {})
          const trimmed = text.trim()
          if (!content || trimmed === '' || trimmed === '{}' || trimmed === 'null') {
            missing.push(sid)
          }
        }
        setMissingEndemicSteps(missing)

        // Existing ICP records
        const { data: icpRows } = await supabase
          .from('icp_definition')
          .select('*')
          .eq('org_id', wsId)
          .order('segment_index')
        if (icpRows) {
          const newForms: Record<BuyerType, IcpFormData>[] = [
            { economic_buyer: defaultIcp('economic_buyer'), champion: defaultIcp('champion') },
            { economic_buyer: defaultIcp('economic_buyer'), champion: defaultIcp('champion') },
            { economic_buyer: defaultIcp('economic_buyer'), champion: defaultIcp('champion') },
          ]
          const newIds: Record<BuyerType, string | null>[] = [
            { economic_buyer: null, champion: null },
            { economic_buyer: null, champion: null },
            { economic_buyer: null, champion: null },
          ]
          for (const raw of icpRows as Array<Record<string, unknown>>) {
            const si = Number(raw['segment_index'] ?? 0)
            if (si < 1 || si > 3) continue
            const i = si - 1
            const bt: BuyerType = raw['buyer_type'] === 'champion' ? 'champion' : 'economic_buyer'
            newIds[i][bt] = String(raw['id'] ?? '')
            if (raw['is_primary'] === true) setPrimaryIcpId(String(raw['id'] ?? ''))
            const strArr = (v: unknown): string[] => Array.isArray(v) ? (v as unknown[]).map(String) : []
            const objArr = (v: unknown): Objection[] =>
              Array.isArray(v)
                ? (v as Array<Record<string, unknown>>).map(o => ({
                    objection: typeof o['objection'] === 'string' ? o['objection'] : '',
                    overcomes: typeof o['overcomes'] === 'string' ? o['overcomes'] : '',
                  }))
                : []
            newForms[i][bt] = {
              buyer_type: bt,
              job_titles: strArr(raw['job_titles']),
              company_size_range: String(raw['company_size_range'] ?? ''),
              industry_verticals: strArr(raw['industry_verticals']),
              decision_making_power: String(raw['decision_making_power'] ?? ''),
              budget_range: String(raw['budget_range'] ?? ''),
              buying_motion: String(raw['buying_motion'] ?? ''),
              buying_urgency_trigger: String(raw['buying_urgency_trigger'] ?? ''),
              primary_challenges: strArr(raw['primary_challenges']),
              barriers_to_success: strArr(raw['barriers_to_success']),
              the_big_win: String(raw['the_big_win'] ?? ''),
              success_metrics: strArr(raw['success_metrics']),
              buying_triggers: strArr(raw['buying_triggers']),
              information_sources: strArr(raw['information_sources']),
              preferred_communication: String(raw['preferred_communication'] ?? ''),
              purchase_criteria: strArr(raw['purchase_criteria']),
              buyer_values: String(raw['buyer_values'] ?? ''),
              common_objections: objArr(raw['common_objections']),
              risk_sensitivities: String(raw['risk_sensitivities'] ?? ''),
              tech_stack: String(raw['tech_stack'] ?? ''),
            }
          }
          setIcpForms(newForms)
          setIcpDbIds(newIds)
          icpDbIdsRef.current = newIds
        }

      } catch { /* non-fatal */ } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // ── ICP save ──────────────────────────────────────────────────────────────

  async function doSaveIcp(i: number, bt: BuyerType) {
    const wsId = workspaceIdRef.current
    if (!wsId) return
    const form = icpFormsRef.current[i][bt]
    const seg = segmentsRef.current[i]
    const segIdx = i + 1

    setIcpSaveStates(prev => setAt(prev, i, { ...prev[i], [bt]: 'saving' }))
    try {
      const now = new Date().toISOString()
      const payload = {
        org_id: wsId,
        segment_index: segIdx,
        segment_name: seg?.name ?? `Segment ${segIdx}`,
        ...form,
        buyer_type: bt,
        updated_at: now,
      }
      const { data, error } = await supabase
        .from('icp_definition')
        .upsert(payload, { onConflict: 'org_id,segment_index,buyer_type' })
        .select('id')
        .single()
      if (error) throw error
      if (data) {
        const newId = String((data as Record<string, unknown>)['id'] ?? '')
        setIcpDbIds(prev => {
          const n = setAt(prev, i, { ...prev[i], [bt]: newId })
          icpDbIdsRef.current = n
          return n
        })
      }
      setIcpSaveStates(prev => setAt(prev, i, { ...prev[i], [bt]: 'saved' }))
      setTimeout(() => setIcpSaveStates(prev => setAt(prev, i, { ...prev[i], [bt]: 'idle' })), 2500)
    } catch {
      setIcpSaveStates(prev => setAt(prev, i, { ...prev[i], [bt]: 'error' }))
    }
  }

  function scheduleIcpSave(i: number, bt: BuyerType) {
    const key = `${i}-${bt}`
    const existing = saveTimers.current.get(key)
    if (existing) clearTimeout(existing)
    saveTimers.current.set(key, setTimeout(() => void doSaveIcp(i, bt), AUTOSAVE_MS))
  }

  function updateIcp(i: number, bt: BuyerType, patch: Partial<IcpFormData>) {
    setIcpForms(prev => setAt(prev, i, { ...prev[i], [bt]: { ...prev[i][bt], ...patch } }))
    scheduleIcpSave(i, bt)
  }

  // ── Primary ICP ───────────────────────────────────────────────────────────

  /**
   * Mark one profile as the primary ICP.
   *
   * A partial unique index allows only one primary per organisation, so the
   * previous one has to be cleared before the new one is set. Doing it in the
   * other order fails on the constraint.
   */
  async function setPrimary(dbId: string) {
    const wsId = workspaceIdRef.current
    if (!wsId || !dbId || primarySaving) return

    setPrimarySaving(true)
    const previous = primaryIcpId
    setPrimaryIcpId(dbId) // optimistic, reverted below if the write fails
    try {
      if (previous && previous !== dbId) {
        const { error } = await supabase
          .from('icp_definition')
          .update({ is_primary: false })
          .eq('id', previous)
        if (error) throw error
      }
      const { error } = await supabase
        .from('icp_definition')
        .update({ is_primary: true })
        .eq('id', dbId)
      if (error) throw error
    } catch {
      setPrimaryIcpId(previous)
    } finally {
      setPrimarySaving(false)
    }
  }

  // ── Copilot ICP ───────────────────────────────────────────────────────────

  async function runCopilot(i: number) {
    const wsId = workspaceIdRef.current
    if (!wsId) return
    setCopilotLoading(prev => setAt(prev, i, true))
    setCopilotErrors(prev => setAt(prev, i, null))
    setCopilotPreviews(prev => setAt(prev, i, null))

    try {
      // Gather context
      const { data: profileRows } = await supabase.from('step_output').select('step_id, content').eq('workspace_id', wsId).in('step_id', ['1', '2', '3']).order('version', { ascending: false })
      const companyLines: string[] = []
      for (const raw of (profileRows ?? []) as Array<Record<string, unknown>>) {
        const sid = String(raw['step_id'] ?? '')
        const c = raw['content'] as Record<string, unknown> | null
        const text = c?.['text'] ? String(c['text']) : JSON.stringify(c ?? {})
        companyLines.push(`Step ${sid}: ${text}`)
      }

      const { data: dcpRow } = await supabase.from('dcp_analysis').select('stage_summaries').eq('org_id', wsId).eq('status', 'approved').maybeSingle()
      let dcpContext = ''
      if (dcpRow) {
        const sums = (dcpRow as Record<string, unknown>)['stage_summaries']
        if (Array.isArray(sums)) {
          dcpContext = (sums as Array<Record<string, unknown>>)
            .map(s => `Stage ${s['stage_number']} (${s['stage_name']}): ${s['summary']}`)
            .join('\n\n')
        }
      }

      const { data: journeyRows } = await supabase.from('step_output').select('step_id, content').eq('workspace_id', wsId).in('step_id', ['4', '5', '6', '7', '8']).order('version', { ascending: false })
      const journeyLines: string[] = []
      for (const raw of (journeyRows ?? []) as Array<Record<string, unknown>>) {
        const sid = String(raw['step_id'] ?? '')
        const c = raw['content'] as Record<string, unknown> | null
        const text = c?.['text'] ? String(c['text']) : JSON.stringify(c ?? {})
        journeyLines.push(`Step ${sid}: ${text}`)
      }

      const seg = segmentsRef.current[i]
      const res = await fetch('/api/copilot/icp-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentName: seg.name,
          segmentIndex: i + 1,
          workspaceId: wsId,
          preferredModel,
          companyContext: companyLines.join('\n\n'),
          dcpContext,
          journeyContext: journeyLines.join('\n\n'),
          buyerType: activeBuyerType[i],
        }),
      })

      if (!res.ok) {
        if (res.status === 422) {
          const body = await res.json().catch(() => ({})) as { error?: string; raw?: string }
          console.error('ICP raw response:', body.raw)
        }
        setCopilotErrors(prev => setAt(prev, i, copilotErrorMessage(res.status)))
        return
      }

      const data = await res.json() as Record<string, unknown>
      setCopilotPreviews(prev => setAt(prev, i, sanitizeIcp(data)))
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      setCopilotErrors(prev => setAt(prev, i, msg.includes('timeout') || msg.includes('aborted')
        ? 'The request took too long. Try again.'
        : copilotErrorMessage(0)))
    } finally {
      setCopilotLoading(prev => setAt(prev, i, false))
    }
  }

  function applyCopilotPreview(i: number) {
    const preview = copilotPreviews[i]
    if (!preview) return
    const bt = activeBuyerType[i]
    setIcpForms(prev => {
      const updated = setAt(prev, i, { ...prev[i], [bt]: { ...prev[i][bt], ...preview, buyer_type: bt } })
      icpFormsRef.current = updated
      return updated
    })
    setCopilotPreviews(prev => setAt(prev, i, null))
    scheduleIcpSave(i, bt)
    // Also set copilot_generated flag on the DB record (non-blocking)
    const dbId = icpDbIdsRef.current[i][bt]
    if (dbId) {
      void supabase.from('icp_definition').update({ copilot_generated: true }).eq('id', dbId).then(() => null)
    }
  }

  // ── ICP form render ───────────────────────────────────────────────────────

  function renderIcpForm(i: number) {
    const bt = activeBuyerType[i]
    const form = icpForms[i][bt]
    const u = (patch: Partial<IcpFormData>) => updateIcp(i, bt, patch)

    const field = (label: string, children: React.ReactNode) => (
      <div>
        <label style={LABEL_ST}>{label}</label>
        {children}
      </div>
    )

    const dbId = icpDbIds[i][bt]
    const isPrimary = Boolean(dbId) && dbId === primaryIcpId

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Primary marker. Only offered once the profile has been saved, because
            there is no row to mark until then. */}
        {dbId && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            padding: '14px 18px', borderRadius: '10px',
            backgroundColor: isPrimary ? 'rgba(232,82,10,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isPrimary ? 'rgba(232,82,10,0.45)' : 'rgba(255,255,255,0.1)'}`,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: isPrimary ? '#E8520A' : 'rgba(255,255,255,0.85)' }}>
                {isPrimary ? 'Primary ICP' : 'Not your primary ICP'}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
                {isPrimary
                  ? 'Lead generation will prioritise this profile, and sales should start here.'
                  : 'Mark the profile you most want lead generation to prioritise. Only one can be primary.'}
              </p>
            </div>
            {!isPrimary && (
              <button
                onClick={() => void setPrimary(dbId)}
                disabled={primarySaving}
                style={{
                  flexShrink: 0, minHeight: '38px', padding: '0 16px', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600, cursor: primarySaving ? 'not-allowed' : 'pointer',
                  backgroundColor: 'rgba(232,82,10,0.15)', color: '#E8520A',
                  border: '1px solid rgba(232,82,10,0.35)',
                }}
              >
                Set as primary
              </button>
            )}
          </div>
        )}

        {/* Section 1: Professional Identity & Firmographics */}
        <div style={CARD}>
          <p style={{ ...LABEL_ST, color: '#0EA5E9', marginBottom: '14px' }}>Professional Identity & Firmographics</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              {field('Buyer Type', (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['economic_buyer', 'champion'] as BuyerType[]).map(opt => (
                    <button key={opt} onClick={() => setActiveBuyerType(prev => setAt(prev, i, opt))}
                      style={{ flex: 1, minHeight: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        backgroundColor: bt === opt ? '#0EA5E9' : 'rgba(255,255,255,0.05)',
                        color: bt === opt ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                        borderColor: bt === opt ? '#0EA5E9' : 'rgba(255,255,255,0.15)' }}>
                      {opt === 'economic_buyer' ? 'Economic Buyer' : 'Champion'}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              {field('Job Titles', <TagInput tags={form.job_titles} onChange={v => u({ job_titles: v })} placeholder="e.g. VP of Sales — press Enter" />)}
            </div>
            {field('Company Size Range', <input style={INPUT_ST} type="text" value={form.company_size_range} placeholder="e.g. 50–500 employees" onChange={e => u({ company_size_range: e.target.value })} />)}
            {field('Budget Range', <input style={INPUT_ST} type="text" value={form.budget_range} placeholder="e.g. $50k–$250k annually" onChange={e => u({ budget_range: e.target.value })} />)}
            <div style={{ gridColumn: 'span 2' }}>
              {field('Industry Verticals', <TagInput tags={form.industry_verticals} onChange={v => u({ industry_verticals: v })} placeholder="e.g. SaaS — press Enter" />)}
            </div>
            {field('Decision Making Power', <textarea style={TEXTAREA_ST} value={form.decision_making_power} placeholder="Describe their authority and budget control…" onChange={e => u({ decision_making_power: e.target.value })} />)}
            {field('Buying Motion', <textarea style={TEXTAREA_ST} value={form.buying_motion} placeholder="How do they typically buy?" onChange={e => u({ buying_motion: e.target.value })} />)}
            <div style={{ gridColumn: 'span 2' }}>
              {field('Buying Urgency Trigger', <textarea style={TEXTAREA_ST} value={form.buying_urgency_trigger} placeholder="What event causes them to start looking now?" onChange={e => u({ buying_urgency_trigger: e.target.value })} />)}
            </div>
          </div>
        </div>

        {/* Section 2: Pain & Gain */}
        <div style={CARD}>
          <p style={{ ...LABEL_ST, color: '#0EA5E9', marginBottom: '14px' }}>Pain & Gain</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {field('Primary Challenges', <ListInput values={form.primary_challenges} onChange={v => u({ primary_challenges: v })} placeholder="Describe a challenge…" />)}
            {field('Barriers to Success', <ListInput values={form.barriers_to_success} onChange={v => u({ barriers_to_success: v })} placeholder="Describe a barrier…" />)}
            {field('The Big Win', <textarea style={TEXTAREA_ST} value={form.the_big_win} placeholder="The single transformational outcome they want…" onChange={e => u({ the_big_win: e.target.value })} />)}
            {field('Success Metrics', <ListInput values={form.success_metrics} onChange={v => u({ success_metrics: v })} placeholder="e.g. 30% reduction in churn" />)}
          </div>
        </div>

        {/* Section 3: Behavioral Triggers & Information Habits */}
        <div style={CARD}>
          <p style={{ ...LABEL_ST, color: '#0EA5E9', marginBottom: '14px' }}>Behavioral Triggers & Information Habits</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {field('Buying Triggers', <ListInput values={form.buying_triggers} onChange={v => u({ buying_triggers: v })} placeholder="e.g. Board pressure to show ROI" />)}
            {field('Information Sources', <ListInput values={form.information_sources} onChange={v => u({ information_sources: v })} maxItems={6} placeholder="e.g. G2, LinkedIn, peer referrals" />)}
            {field('Preferred Communication', <textarea style={TEXTAREA_ST} value={form.preferred_communication} placeholder="Preferred channels and outreach cadence…" onChange={e => u({ preferred_communication: e.target.value })} />)}
            {field('Purchase Criteria', <ListInput values={form.purchase_criteria} onChange={v => u({ purchase_criteria: v })} placeholder="e.g. ROI within 6 months" />)}
          </div>
        </div>

        {/* Section 4: Psychographics & Objections */}
        <div style={CARD}>
          <p style={{ ...LABEL_ST, color: '#0EA5E9', marginBottom: '14px' }}>Psychographics & Objections</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {field('Values', <textarea style={TEXTAREA_ST} value={form.buyer_values} placeholder="What do they value culturally and professionally?" onChange={e => u({ buyer_values: e.target.value })} />)}
            {field('Common Objections', <ObjectionsInput objections={form.common_objections} onChange={v => u({ common_objections: v })} />)}
            {field('Risk Sensitivities', <textarea style={TEXTAREA_ST} value={form.risk_sensitivities} placeholder="What risks concern them most?" onChange={e => u({ risk_sensitivities: e.target.value })} />)}
            {field('Tech Stack & Integration Expectations', <textarea style={TEXTAREA_ST} value={form.tech_stack} placeholder="Typical tools and integration expectations…" onChange={e => u({ tech_stack: e.target.value })} />)}
          </div>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>ICP Calibrator</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: '6px 0 0', maxWidth: '640px', lineHeight: '1.55' }}>
            Three steps: capture your day-one beliefs about your best customers, tag the buyer responses that come
            back, then calibrate your ideal customer profiles against that evidence and mark one as primary.
          </p>
        </div>
        <Link
          href="/dashboard/target-markets/report"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '40px', padding: '0 18px',
            borderRadius: '8px', border: '1px solid rgba(232,82,10,0.5)', backgroundColor: '#E8520A',
            color: '#FFFFFF', fontSize: '13px', fontWeight: 600, textDecoration: 'none', flexShrink: 0,
          }}
        >
          <FileText size={15} /> Generate Report
        </Link>
      </header>

      <div style={{ backgroundColor: '#0A1628', borderBottom: '1px solid rgba(255,255,255,0.1)' }} />

      {/* Content */}
      <div style={{ flex: 1, padding: '28px 32px', maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '36px' }}>

        {/* ── Step 1: Baseline Profiles (open from day one, never gated) ───────── */}
        <section>
          <StepHeading
            n={1}
            title="Baseline Profiles"
            subtitle="Capture who you believe your best customers are today. This is the “before” the calibration compares real buyer evidence against."
          />
          {workspaceId ? (
            <BaselineProfiles orgId={workspaceId} segments={baselineSegments} />
          ) : (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Loading your workspace…</p>
          )}
        </section>

        {/* ── Step 2: Tag responses (status panel, not a form) ─────────────────── */}
        <section>
          <StepHeading
            n={2}
            title="Tag responses"
            subtitle="Tag each current-customer response by best-customer category in the Response Manager. That is what turns raw responses into calibration evidence."
          />
          <div style={{
            ...CARD,
            display: 'flex', alignItems: 'flex-start', gap: '14px',
          }}>
            <div style={{
              flexShrink: 0, width: '38px', height: '38px', borderRadius: '9px',
              backgroundColor: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MessageSquare size={18} style={{ color: '#0EA5E9' }} />
            </div>
            <div style={{ flex: 1 }}>
              {responseCount === null ? (
                <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Checking for responses…</p>
              ) : responseCount > 0 ? (
                <>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                    {responseCount} {responseCount === 1 ? 'response' : 'responses'} collected
                  </p>
                  <p style={{ margin: '4px 0 12px', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.55' }}>
                    Open the Response Manager to tag current-customer responses by category. Survey-link responses can only be tagged there.
                  </p>
                  <Link href="/dashboard/intelligence/responses?tab=view" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '38px', padding: '0 16px',
                    borderRadius: '8px', backgroundColor: '#E8520A', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                  }}>
                    Open Response Manager <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>No responses yet</p>
                  <p style={{ margin: '4px 0 12px', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.55' }}>
                    You have no buyer responses to tag yet. Build and share a survey to start collecting them, then come back to tag by category.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <Link href="/dashboard/intelligence/survey-builder" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '38px', padding: '0 16px',
                      borderRadius: '8px', backgroundColor: '#E8520A', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                    }}>
                      Open Survey Builder <ArrowRight size={14} />
                    </Link>
                    <Link href="/dashboard/intelligence/responses?tab=manual" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '38px', padding: '0 16px',
                      borderRadius: '8px', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.75)',
                      border: '1px solid rgba(255,255,255,0.15)', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                    }}>
                      Enter a response manually
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Step 3: Calibrated ICPs (gated on Gate 1 / DCP approval) ─────────── */}
        <section>
          <StepHeading
            n={3}
            title="Calibrated ICPs"
            subtitle="Build and calibrate your ideal customer profiles against what buyers actually said, then mark one as primary so lead generation knows where to start."
            locked={gate1Approved === false}
          />
          {gate1Approved === false ? (
            <div style={{ ...CARD, display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                flexShrink: 0, width: '44px', height: '44px', borderRadius: '50%',
                backgroundColor: 'rgba(232,82,10,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Lock size={20} color="#E8520A" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
                  Complete the Decision Clarity Process first
                </p>
                <p style={{ margin: '6px 0 12px', fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>
                  Receive Gate 1 approval before building your ICPs. Building them after buyer research keeps your profiles grounded in how buyers actually decide, not how you assume they do. Steps 1 and 2 above stay open in the meantime.
                </p>
                <Link href="/dashboard/intelligence" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '40px', padding: '0 18px',
                  borderRadius: '8px', backgroundColor: '#E8520A', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                }}>
                  Go to Intelligence <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
          <div id="target-markets-segments" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {missingEndemicSteps.length > 0 && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#FEF3C7',
                borderRadius: '8px',
                border: '1px solid #FCD34D',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}>
                <AlertTriangle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400E', margin: '0 0 2px' }}>
                    For the most grounded ICP, complete Endemic Problems first
                  </p>
                  <p style={{ fontSize: '12px', color: '#78350F', margin: 0 }}>
                    {missingEndemicSteps.length === 1 ? 'Step ' : 'Steps '}
                    {missingEndemicSteps.map((sid, idx) => (
                      <span key={sid}>
                        <Link
                          href={`/dashboard/journeys/step/${sid}`}
                          style={{ color: '#78350F', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          Step {sid}
                        </Link>
                        {idx < missingEndemicSteps.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                    {missingEndemicSteps.length === 1 ? " doesn't" : " don't"} have content yet — your ICP will be thinner without {missingEndemicSteps.length === 1 ? 'it' : 'them'}.
                  </p>
                </div>
              </div>
            )}
            {segments.map((seg, i) => (
              <div key={i} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#0F2140' }}>
                {/* Accordion header */}
                <button
                  onClick={() => setOpenAccordions(prev => setAt(prev, i, !prev[i]))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', minHeight: '56px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {openAccordions[i] ? <ChevronDown size={18} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} /> : <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />}
                    <div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>{seg.name}</span>
                      {seg.description && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '2px 0 0', fontWeight: 400 }}>{seg.description.slice(0, 100)}{seg.description.length > 100 ? '…' : ''}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <SaveIndicator state={icpSaveStates[i][activeBuyerType[i]]} />
                    <button
                      onClick={e => { e.stopPropagation(); void runCopilot(i) }}
                      disabled={copilotLoading[i]}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', minHeight: '36px',
                        backgroundColor: copilotLoading[i] ? 'rgba(255,255,255,0.1)' : '#E8520A', color: copilotLoading[i] ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                        border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                        cursor: copilotLoading[i] ? 'not-allowed' : 'pointer' }}>
                      {copilotLoading[i] ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                      {copilotLoading[i] ? 'Generating…' : 'Generate with Copilot'}
                    </button>
                  </div>
                </button>

                {/* Accordion body */}
                {openAccordions[i] && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* Copilot error */}
                    {copilotErrors[i] && (
                      <div style={{ margin: '16px 0', padding: '12px 16px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px' }}>
                        <p style={{ fontSize: '13px', color: '#FCA5A5', margin: '0 0 6px' }}>{copilotErrors[i]}</p>
                        <a href="https://status.anthropic.com" target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '12px', color: '#FCA5A5', textDecoration: 'underline' }}>
                          Check AI Status ↗
                        </a>
                      </div>
                    )}
                    {/* Copilot preview */}
                    {copilotPreviews[i] && (
                      <IcpPreviewPanel
                        preview={copilotPreviews[i]!}
                        onApply={() => applyCopilotPreview(i)}
                        onDiscard={() => setCopilotPreviews(prev => setAt(prev, i, null))}
                      />
                    )}
                    <div style={{ marginTop: '16px' }}>
                      {renderIcpForm(i)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </section>

      </div>
    </div>
  )
}
