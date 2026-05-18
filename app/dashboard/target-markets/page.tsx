'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Wand2, ChevronDown, ChevronRight, Plus, X, AlertTriangle, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type BuyerType = 'economic_buyer' | 'champion'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type ActiveTab = 'markets' | 'offers'

interface Segment {
  index: number
  name: string
  description: string
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

interface OfferData {
  localKey: string
  id: string | null
  icpId: string
  offer_name: string
  key_outcome: string
  price_range: string
  primary_differentiator: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_MS = 800

const CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '10px',
  border: '1px solid #E5E7EB',
  padding: '20px',
}

const LABEL_ST: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '6px',
}

const INPUT_ST: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#0D0D0D',
  backgroundColor: '#FFFFFF',
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

function defaultIcp(): IcpFormData {
  return {
    buyer_type: 'economic_buyer',
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
    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6B7280' }}>
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
      padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '8px',
      backgroundColor: '#FFFFFF', minHeight: '44px',
    }}>
      {tags.map((tag, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 10px', backgroundColor: 'rgba(232,82,10,0.1)',
          color: '#E8520A', borderRadius: '999px', fontSize: '13px', fontWeight: 500,
        }}>
          {tag}
          <button onClick={() => onChange(tags.filter((_, ti) => ti !== i))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E8520A', padding: '0 0 0 2px', lineHeight: 1 }}>
            ×
          </button>
        </span>
      ))}
      {tags.length < maxItems && (
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{ flex: 1, minWidth: '120px', border: 'none', outline: 'none', fontSize: '14px', color: '#0D0D0D', backgroundColor: 'transparent' }} />
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
            backgroundColor: 'transparent', color: '#374151', border: '1px dashed #D1D5DB',
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
            backgroundColor: 'transparent', color: '#374151', border: '1px dashed #D1D5DB',
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
            style={{ minHeight: '36px', padding: '0 16px', backgroundColor: 'transparent', color: '#6B7280',
              border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Discard
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
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
  const [tab, setTab] = useState<ActiveTab>('markets')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [preferredModel, setPreferredModel] = useState('claude-sonnet-4-5')
  const [loading, setLoading] = useState(true)

  // Segments (from Step 2)
  const [segments, setSegments] = useState<Segment[]>([
    { index: 1, name: 'Segment 1', description: '' },
    { index: 2, name: 'Segment 2', description: '' },
    { index: 3, name: 'Segment 3', description: '' },
  ])

  // ICP forms (index 0, 1, 2 = segments 1, 2, 3)
  const [icpForms, setIcpForms] = useState<IcpFormData[]>([defaultIcp(), defaultIcp(), defaultIcp()])
  const [icpDbIds, setIcpDbIds] = useState<(string | null)[]>([null, null, null])
  const [icpSaveStates, setIcpSaveStates] = useState<SaveState[]>(['idle', 'idle', 'idle'])
  const [openAccordions, setOpenAccordions] = useState<boolean[]>([true, false, false])

  // Copilot per segment
  const [copilotLoading, setCopilotLoading] = useState<boolean[]>([false, false, false])
  const [copilotPreviews, setCopilotPreviews] = useState<(IcpFormData | null)[]>([null, null, null])
  const [copilotErrors, setCopilotErrors] = useState<(string | null)[]>([null, null, null])

  // Offers
  const [offers, setOffers] = useState<OfferData[]>([])
  const [offerSaveStates, setOfferSaveStates] = useState<Record<string, SaveState>>({})

  // Refs
  const icpFormsRef = useRef<IcpFormData[]>([defaultIcp(), defaultIcp(), defaultIcp()])
  const segmentsRef = useRef<Segment[]>(segments)
  const icpDbIdsRef = useRef<(string | null)[]>([null, null, null])
  const workspaceIdRef = useRef<string | null>(null)
  const saveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const offerSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const offersRef = useRef<OfferData[]>([])

  // Keep refs current
  icpFormsRef.current = icpForms
  segmentsRef.current = segments
  icpDbIdsRef.current = icpDbIds
  workspaceIdRef.current = workspaceId
  offersRef.current = offers

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
            const loaded = (rawSegs as Array<Record<string, unknown>>).slice(0, 3).map((s, i) => ({
              index: i + 1,
              name: typeof s['name'] === 'string' && s['name'].trim() ? s['name'] : `Segment ${i + 1}`,
              description: typeof s['description'] === 'string' ? s['description'] : '',
            }))
            // Fill to 3 if fewer defined
            while (loaded.length < 3) {
              loaded.push({ index: loaded.length + 1, name: `Segment ${loaded.length + 1}`, description: '' })
            }
            setSegments(loaded)
          }
        }

        // Existing ICP records
        const { data: icpRows } = await supabase
          .from('icp_definition')
          .select('*')
          .eq('org_id', wsId)
          .order('segment_index')
        if (icpRows) {
          const newForms = [defaultIcp(), defaultIcp(), defaultIcp()]
          const newIds: (string | null)[] = [null, null, null]
          for (const raw of icpRows as Array<Record<string, unknown>>) {
            const si = Number(raw['segment_index'] ?? 0)
            if (si < 1 || si > 3) continue
            const i = si - 1
            newIds[i] = String(raw['id'] ?? '')
            const strArr = (v: unknown): string[] => Array.isArray(v) ? (v as unknown[]).map(String) : []
            const objArr = (v: unknown): Objection[] =>
              Array.isArray(v)
                ? (v as Array<Record<string, unknown>>).map(o => ({
                    objection: typeof o['objection'] === 'string' ? o['objection'] : '',
                    overcomes: typeof o['overcomes'] === 'string' ? o['overcomes'] : '',
                  }))
                : []
            newForms[i] = {
              buyer_type: raw['buyer_type'] === 'champion' ? 'champion' : 'economic_buyer',
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

        // Existing offers
        const { data: offerRows } = await supabase
          .from('offer_definition')
          .select('*')
          .eq('org_id', wsId)
          .order('created_at')
        if (offerRows) {
          const loaded: OfferData[] = (offerRows as Array<Record<string, unknown>>).map(r => ({
            localKey: String(r['id'] ?? ''),
            id: String(r['id'] ?? ''),
            icpId: String(r['icp_id'] ?? ''),
            offer_name: String(r['offer_name'] ?? ''),
            key_outcome: String(r['key_outcome'] ?? ''),
            price_range: String(r['price_range'] ?? ''),
            primary_differentiator: String(r['primary_differentiator'] ?? ''),
          }))
          setOffers(loaded)
        }
      } catch { /* non-fatal */ } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // ── ICP save ──────────────────────────────────────────────────────────────

  async function doSaveIcp(i: number) {
    const wsId = workspaceIdRef.current
    if (!wsId) return
    const form = icpFormsRef.current[i]
    const seg = segmentsRef.current[i]
    const segIdx = i + 1

    setIcpSaveStates(prev => setAt(prev, i, 'saving'))
    try {
      const now = new Date().toISOString()
      const payload = {
        org_id: wsId,
        segment_index: segIdx,
        segment_name: seg?.name ?? `Segment ${segIdx}`,
        ...form,
        updated_at: now,
      }
      const { data, error } = await supabase
        .from('icp_definition')
        .upsert(payload, { onConflict: 'org_id,segment_index' })
        .select('id')
        .single()
      if (error) throw error
      if (data) {
        const newId = String((data as Record<string, unknown>)['id'] ?? '')
        setIcpDbIds(prev => { const n = setAt(prev, i, newId); icpDbIdsRef.current = n; return n })
      }
      setIcpSaveStates(prev => setAt(prev, i, 'saved'))
      setTimeout(() => setIcpSaveStates(prev => setAt(prev, i, 'idle')), 2500)
    } catch {
      setIcpSaveStates(prev => setAt(prev, i, 'error'))
    }
  }

  function scheduleIcpSave(i: number) {
    const existing = saveTimers.current.get(i)
    if (existing) clearTimeout(existing)
    saveTimers.current.set(i, setTimeout(() => void doSaveIcp(i), AUTOSAVE_MS))
  }

  function updateIcp(i: number, patch: Partial<IcpFormData>) {
    setIcpForms(prev => setAt(prev, i, { ...prev[i], ...patch }))
    scheduleIcpSave(i)
  }

  // ── Offer save ────────────────────────────────────────────────────────────

  async function doSaveOffer(localKey: string) {
    const wsId = workspaceIdRef.current
    if (!wsId) return
    const offer = offersRef.current.find(o => o.localKey === localKey)
    if (!offer) return

    setOfferSaveStates(prev => ({ ...prev, [localKey]: 'saving' }))
    try {
      const now = new Date().toISOString()
      if (offer.id) {
        const { error } = await supabase
          .from('offer_definition')
          .update({ offer_name: offer.offer_name, key_outcome: offer.key_outcome, price_range: offer.price_range, primary_differentiator: offer.primary_differentiator, updated_at: now })
          .eq('id', offer.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('offer_definition')
          .insert({ org_id: wsId, icp_id: offer.icpId, offer_name: offer.offer_name, key_outcome: offer.key_outcome, price_range: offer.price_range, primary_differentiator: offer.primary_differentiator, created_at: now, updated_at: now })
          .select('id')
          .single()
        if (error) throw error
        if (data) {
          const newId = String((data as Record<string, unknown>)['id'] ?? '')
          setOffers(prev => prev.map(o => o.localKey === localKey ? { ...o, id: newId } : o))
        }
      }
      setOfferSaveStates(prev => ({ ...prev, [localKey]: 'saved' }))
      setTimeout(() => setOfferSaveStates(prev => ({ ...prev, [localKey]: 'idle' })), 2500)
    } catch {
      setOfferSaveStates(prev => ({ ...prev, [localKey]: 'error' }))
    }
  }

  function scheduleOfferSave(localKey: string) {
    const existing = offerSaveTimers.current.get(localKey)
    if (existing) clearTimeout(existing)
    offerSaveTimers.current.set(localKey, setTimeout(() => void doSaveOffer(localKey), AUTOSAVE_MS))
  }

  function updateOffer(localKey: string, patch: Partial<OfferData>) {
    setOffers(prev => prev.map(o => o.localKey === localKey ? { ...o, ...patch } : o))
    scheduleOfferSave(localKey)
  }

  async function handleAddOffer(i: number) {
    let icpId = icpDbIdsRef.current[i]
    if (!icpId) {
      // Save ICP immediately to get an id
      await doSaveIcp(i)
      icpId = icpDbIdsRef.current[i]
      if (!icpId) return
    }
    const localKey = `new-${Date.now()}-${i}`
    const newOffer: OfferData = { localKey, id: null, icpId, offer_name: '', key_outcome: '', price_range: '', primary_differentiator: '' }
    setOffers(prev => [...prev, newOffer])
  }

  function handleDeleteOffer(localKey: string) {
    const offer = offersRef.current.find(o => o.localKey === localKey)
    if (!offer) return
    setOffers(prev => prev.filter(o => o.localKey !== localKey))
    if (offer.id) {
      void supabase.from('offer_definition').delete().eq('id', offer.id).then(() => null)
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
        }),
      })

      if (!res.ok || !res.body) {
        setCopilotErrors(prev => setAt(prev, i, copilotErrorMessage(res.status)))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }

      if (accumulated.includes('__STREAM_ERROR__')) {
        const m = accumulated.match(/__STREAM_ERROR__:(\w+)/)
        setCopilotErrors(prev => setAt(prev, i, copilotErrorMessage(m ? m[1] : 0)))
        return
      }

      try {
        let jsonText = accumulated.trim()
        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(jsonText) as Record<string, unknown>
        } catch {
          const match = jsonText.match(/\{[\s\S]*\}/)
          if (!match) throw new Error('no_json_block')
          parsed = JSON.parse(match[0]) as Record<string, unknown>
        }
        setCopilotPreviews(prev => setAt(prev, i, sanitizeIcp(parsed)))
      } catch {
        console.error('[icp-generate] parse failed. Raw response:', accumulated)
        setCopilotErrors(prev => setAt(prev, i, 'Could not parse the generated ICP. Please try again.'))
      }
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
    setIcpForms(prev => setAt(prev, i, { ...prev[i], ...preview }))
    setCopilotPreviews(prev => setAt(prev, i, null))
    // Mark copilot_generated and trigger save
    setIcpForms(prev => {
      const updated = setAt(prev, i, { ...prev[i], ...preview })
      icpFormsRef.current = updated
      return updated
    })
    scheduleIcpSave(i)
    // Also set copilot_generated flag on the DB record (non-blocking)
    const dbId = icpDbIdsRef.current[i]
    if (dbId) {
      void supabase.from('icp_definition').update({ copilot_generated: true }).eq('id', dbId).then(() => null)
    }
  }

  // ── ICP form render ───────────────────────────────────────────────────────

  function renderIcpForm(i: number) {
    const form = icpForms[i]
    const u = (patch: Partial<IcpFormData>) => updateIcp(i, patch)

    const field = (label: string, children: React.ReactNode) => (
      <div>
        <label style={LABEL_ST}>{label}</label>
        {children}
      </div>
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: Professional Identity & Firmographics */}
        <div style={CARD}>
          <p style={{ ...LABEL_ST, color: '#E8520A', marginBottom: '14px' }}>Professional Identity & Firmographics</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              {field('Buyer Type', (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['economic_buyer', 'champion'] as BuyerType[]).map(bt => (
                    <button key={bt} onClick={() => u({ buyer_type: bt })}
                      style={{ flex: 1, minHeight: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        backgroundColor: form.buyer_type === bt ? '#0A1628' : '#FFFFFF',
                        color: form.buyer_type === bt ? '#FFFFFF' : '#374151',
                        borderColor: form.buyer_type === bt ? '#0A1628' : '#D1D5DB' }}>
                      {bt === 'economic_buyer' ? 'Economic Buyer' : 'Champion'}
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
          <p style={{ ...LABEL_ST, color: '#E8520A', marginBottom: '14px' }}>Pain & Gain</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {field('Primary Challenges', <ListInput values={form.primary_challenges} onChange={v => u({ primary_challenges: v })} placeholder="Describe a challenge…" />)}
            {field('Barriers to Success', <ListInput values={form.barriers_to_success} onChange={v => u({ barriers_to_success: v })} placeholder="Describe a barrier…" />)}
            {field('The Big Win', <textarea style={TEXTAREA_ST} value={form.the_big_win} placeholder="The single transformational outcome they want…" onChange={e => u({ the_big_win: e.target.value })} />)}
            {field('Success Metrics', <ListInput values={form.success_metrics} onChange={v => u({ success_metrics: v })} placeholder="e.g. 30% reduction in churn" />)}
          </div>
        </div>

        {/* Section 3: Behavioral Triggers & Information Habits */}
        <div style={CARD}>
          <p style={{ ...LABEL_ST, color: '#E8520A', marginBottom: '14px' }}>Behavioral Triggers & Information Habits</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {field('Buying Triggers', <ListInput values={form.buying_triggers} onChange={v => u({ buying_triggers: v })} placeholder="e.g. Board pressure to show ROI" />)}
            {field('Information Sources', <ListInput values={form.information_sources} onChange={v => u({ information_sources: v })} maxItems={6} placeholder="e.g. G2, LinkedIn, peer referrals" />)}
            {field('Preferred Communication', <textarea style={TEXTAREA_ST} value={form.preferred_communication} placeholder="Preferred channels and outreach cadence…" onChange={e => u({ preferred_communication: e.target.value })} />)}
            {field('Purchase Criteria', <ListInput values={form.purchase_criteria} onChange={v => u({ purchase_criteria: v })} placeholder="e.g. ROI within 6 months" />)}
          </div>
        </div>

        {/* Section 4: Psychographics & Objections */}
        <div style={CARD}>
          <p style={{ ...LABEL_ST, color: '#E8520A', marginBottom: '14px' }}>Psychographics & Objections</p>
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

  // ── Offers tab render ─────────────────────────────────────────────────────

  function renderOffersTab() {
    const hasAnyIcp = icpDbIds.some(id => id !== null)

    if (!hasAnyIcp) {
      return (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <AlertTriangle size={28} style={{ color: '#D97706', margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#92400E', margin: '0 0 4px' }}>No ICPs saved yet</p>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Complete your Target Markets ICPs first — offers are linked to ICPs.</p>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {segments.map((seg, i) => {
          const icpId = icpDbIds[i]
          const segOffers = offers.filter(o => o.icpId === icpId)
          return (
            <div key={i} style={CARD}>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#0D0D0D', margin: '0 0 4px' }}>{seg.name}</p>
              {!icpId ? (
                <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '8px 0 0' }}>Save the ICP for this segment first to add offers.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                  {segOffers.map(offer => (
                    <div key={offer.localKey} style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '16px', backgroundColor: '#FAFAFA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <SaveIndicator state={offerSaveStates[offer.localKey] ?? 'idle'} />
                        <button onClick={() => handleDeleteOffer(offer.localKey)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
                          <X size={15} />
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={LABEL_ST}>Offer Name</label>
                          <input style={INPUT_ST} type="text" value={offer.offer_name} placeholder="Name this offer…"
                            onChange={e => updateOffer(offer.localKey, { offer_name: e.target.value })} />
                        </div>
                        <div>
                          <label style={LABEL_ST}>Price Range</label>
                          <input style={INPUT_ST} type="text" value={offer.price_range} placeholder="e.g. $2,500/month"
                            onChange={e => updateOffer(offer.localKey, { price_range: e.target.value })} />
                        </div>
                        <div>
                          <label style={LABEL_ST}>Key Outcome</label>
                          <textarea style={TEXTAREA_ST} value={offer.key_outcome} placeholder="Primary outcome delivered…"
                            onChange={e => updateOffer(offer.localKey, { key_outcome: e.target.value })} />
                        </div>
                        <div>
                          <label style={LABEL_ST}>Primary Differentiator</label>
                          <textarea style={TEXTAREA_ST} value={offer.primary_differentiator} placeholder="What makes this offer unique…"
                            onChange={e => updateOffer(offer.localKey, { primary_differentiator: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {segOffers.length < 3 && (
                    <button onClick={() => void handleAddOffer(i)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', minHeight: '44px',
                        backgroundColor: 'transparent', color: '#0A1628', border: '2px dashed #D1D5DB',
                        borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                      <Plus size={16} /> Add Offer
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Target Markets &amp; Offers</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: '6px 0 0' }}>
          Define your ideal customer profiles and aligned offers per market segment.
        </p>
      </header>

      {/* Tabs */}
      <div style={{ backgroundColor: '#0A1628', paddingLeft: '32px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', gap: '0' }}>
          {(['markets', 'offers'] as ActiveTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '12px 20px', minHeight: '44px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                color: tab === t ? '#E8520A' : 'rgba(255,255,255,0.5)',
                borderBottom: tab === t ? '2px solid #E8520A' : '2px solid transparent' }}>
              {t === 'markets' ? 'Target Markets' : 'Offers'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '28px 32px', maxWidth: '960px' }}>
        {tab === 'markets' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {segments.map((seg, i) => (
              <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                {/* Accordion header */}
                <button
                  onClick={() => setOpenAccordions(prev => setAt(prev, i, !prev[i]))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', minHeight: '56px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {openAccordions[i] ? <ChevronDown size={18} style={{ color: '#6B7280', flexShrink: 0 }} /> : <ChevronRight size={18} style={{ color: '#6B7280', flexShrink: 0 }} />}
                    <div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D' }}>{seg.name}</span>
                      {seg.description && <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0', fontWeight: 400 }}>{seg.description.slice(0, 100)}{seg.description.length > 100 ? '…' : ''}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <SaveIndicator state={icpSaveStates[i]} />
                    <button
                      onClick={e => { e.stopPropagation(); void runCopilot(i) }}
                      disabled={copilotLoading[i]}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px', minHeight: '36px',
                        backgroundColor: copilotLoading[i] ? '#F3F4F6' : '#E8520A', color: copilotLoading[i] ? '#9CA3AF' : '#FFFFFF',
                        border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                        cursor: copilotLoading[i] ? 'not-allowed' : 'pointer' }}>
                      {copilotLoading[i] ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                      {copilotLoading[i] ? 'Generating…' : 'Generate with Copilot'}
                    </button>
                  </div>
                </button>

                {/* Accordion body */}
                {openAccordions[i] && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid #F3F4F6' }}>
                    {/* Copilot error */}
                    {copilotErrors[i] && (
                      <div style={{ margin: '16px 0', padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px' }}>
                        <p style={{ fontSize: '13px', color: '#991B1B', margin: '0 0 6px' }}>{copilotErrors[i]}</p>
                        <a href="https://status.anthropic.com" target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '12px', color: '#991B1B', textDecoration: 'underline' }}>
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
        ) : (
          renderOffersTab()
        )}
      </div>
    </div>
  )
}
