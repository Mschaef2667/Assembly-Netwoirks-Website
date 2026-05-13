'use client'

import type { CSSProperties } from 'react'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type { StepOutput, StepOutputInsert, StepOutputUpdate, StepStatus, AssemblyUser } from '@/lib/supabase/client'
import { captureEvent } from '@/lib/posthog'

// ── Types ────────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type InfluenceLevel = 'High' | 'Medium' | 'Low'
type DecisionStyle = 'Consensus' | 'Champion-led' | 'Committee'
type SalesCycle = '1-3 months' | '3-6 months' | '3-9 months' | '6-12 months' | '12+ months'
type ACVRange = '$1k-$10k' | '$10k-$100k' | '$100k-$500k' | '$500k+'

interface Segment {
  id: string
  name: string
  description: string
}

interface BuyingRole {
  id: string
  title: string
  influence: InfluenceLevel
  primaryConcern: string
}

interface Step1Data {
  whatDoYouSell: string
}

interface BuyingCenterData {
  stakeholderMin: number
  stakeholderMax: number
  decisionStyle: DecisionStyle
  salesCycle: SalesCycle
  acvRange: ACVRange
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DECISION_STYLES: DecisionStyle[] = ['Consensus', 'Champion-led', 'Committee']
const SALES_CYCLES: SalesCycle[] = ['1-3 months', '3-6 months', '3-9 months', '6-12 months', '12+ months']
const ACV_RANGES: ACVRange[] = ['$1k-$10k', '$10k-$100k', '$100k-$500k', '$500k+']

const STEP_LABELS = [
  'Product / Service Profile',
  'Target Market Segments',
  'Key Decision Makers',
  'Buying Center Evaluation',
]

// Maps accordion step number → step_id value written to step_output
const STEP_IDS: Record<number, string> = { 1: '1', 2: '2', 3: '3', 4: '3.5' }

// ── Style constants ────────────────────────────────────────────────────────────

const INPUT: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#0D0D0D',
  backgroundColor: '#FFFFFF',
  width: '100%',
  minHeight: '44px',
  boxSizing: 'border-box',
  outline: 'none',
}

const LABEL: CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#0D0D0D',
  marginBottom: '6px',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

function makeRole(): BuyingRole {
  return { id: uid(), title: '', influence: 'High', primaryConcern: '' }
}

function makeSegment(): Segment {
  return { id: uid(), name: '', description: '' }
}

// ── Save indicator ─────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
        <Loader2 size={12} className="animate-spin" /> Saving…
      </span>
    )
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: '#16A34A' }}>
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#16A34A' }} />
        Saved
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: '#EF4444' }}>
      <AlertCircle size={12} /> Save failed
    </span>
  )
}

// ── Step 1 ─────────────────────────────────────────────────────────────────────

interface Step1FormProps {
  data: Step1Data
  onChange: (d: Step1Data) => void
  onBlur: () => void
}

function Step1Form({ data, onChange, onBlur }: Step1FormProps) {
  return (
    <div>
      <label style={LABEL}>What do you sell?</label>
      <textarea
        value={data.whatDoYouSell}
        onChange={e => onChange({ whatDoYouSell: e.target.value })}
        onBlur={onBlur}
        rows={4}
        placeholder="Describe your product or service in 3–5 sentences…"
        style={{ ...INPUT, minHeight: '110px', resize: 'vertical' }}
      />
    </div>
  )
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

interface Step2FormProps {
  segments: Segment[]
  onChange: (s: Segment[]) => void
  onBlur: () => void
}

function Step2Form({ segments, onChange, onBlur }: Step2FormProps) {
  function update(id: string, field: 'name' | 'description', value: string) {
    onChange(segments.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: '#6B7280' }}>
        Add up to 5 segments. At least 1 required to continue.
      </p>
      {segments.map((seg, i) => (
        <div key={seg.id} className="rounded-lg p-4 space-y-3" style={{ border: '1px solid #E5E7EB' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: '#0D0D0D' }}>Segment {i + 1}</span>
            {segments.length > 1 && (
              <button
                onClick={() => onChange(segments.filter(s => s.id !== seg.id))}
                aria-label="Remove segment"
                style={{
                  minHeight: '44px', minWidth: '44px', border: 'none',
                  background: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={15} color="#EF4444" />
              </button>
            )}
          </div>
          <div>
            <label style={LABEL}>Segment name</label>
            <input
              type="text"
              value={seg.name}
              onChange={e => update(seg.id, 'name', e.target.value)}
              onBlur={onBlur}
              placeholder="e.g. Mid-market SaaS companies"
              style={INPUT}
            />
          </div>
          <div>
            <label style={LABEL}>Description</label>
            <input
              type="text"
              value={seg.description}
              onChange={e => update(seg.id, 'description', e.target.value)}
              onBlur={onBlur}
              placeholder="Brief description of this segment"
              style={INPUT}
            />
          </div>
        </div>
      ))}
      {segments.length < 5 && (
        <button
          onClick={() => onChange([...segments, makeSegment()])}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', minHeight: '44px', padding: '0 16px',
            border: '1.5px dashed #D1D5DB', borderRadius: '8px',
            backgroundColor: 'transparent', color: '#6B7280', fontSize: '14px', cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Add segment
        </button>
      )}
    </div>
  )
}

// ── Step 3 ─────────────────────────────────────────────────────────────────────

interface Step3FormProps {
  activeSegments: Segment[]
  roles: Record<string, BuyingRole[]>
  onChange: (r: Record<string, BuyingRole[]>) => void
  onBlur: () => void
}

function Step3Form({ activeSegments, roles, onChange, onBlur }: Step3FormProps) {
  if (activeSegments.length === 0) {
    return (
      <p className="text-sm" style={{ color: '#6B7280' }}>
        No segments defined. Go back to Step 2 and add at least one.
      </p>
    )
  }

  function patchRole(segId: string, roleId: string, patch: Partial<BuyingRole>) {
    const list = roles[segId] ?? []
    onChange({ ...roles, [segId]: list.map(r => r.id === roleId ? { ...r, ...patch } : r) })
  }

  return (
    <div className="space-y-6">
      {activeSegments.map(seg => {
        const segRoles = roles[seg.id] ?? []
        return (
          <div key={seg.id}>
            <h3
              className="text-sm font-semibold mb-3 pb-2"
              style={{ color: '#0A1628', borderBottom: '1px solid #E5E7EB' }}
            >
              {seg.name}
            </h3>
            <div className="space-y-3">
              {segRoles.map((role, ri) => (
                <div key={role.id} className="rounded-lg p-4" style={{ border: '1px solid #E5E7EB' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Role {ri + 1}</span>
                    {segRoles.length > 1 && (
                      <button
                        onClick={() =>
                          onChange({ ...roles, [seg.id]: segRoles.filter(r => r.id !== role.id) })
                        }
                        aria-label="Remove role"
                        style={{
                          minHeight: '44px', minWidth: '44px', border: 'none',
                          background: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label style={LABEL}>Title</label>
                      <input
                        type="text"
                        value={role.title}
                        onChange={e => patchRole(seg.id, role.id, { title: e.target.value })}
                        onBlur={onBlur}
                        placeholder="e.g. VP Sales"
                        style={INPUT}
                      />
                    </div>
                    <div>
                      <label style={LABEL}>Influence level</label>
                      <select
                        value={role.influence}
                        onChange={e => {
                          patchRole(seg.id, role.id, { influence: e.target.value as InfluenceLevel })
                          onBlur()
                        }}
                        style={INPUT}
                      >
                        {(['High', 'Medium', 'Low'] as const).map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={LABEL}>Primary concern</label>
                      <input
                        type="text"
                        value={role.primaryConcern}
                        onChange={e => patchRole(seg.id, role.id, { primaryConcern: e.target.value })}
                        onBlur={onBlur}
                        placeholder="e.g. Revenue risk"
                        style={INPUT}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => onChange({ ...roles, [seg.id]: [...segRoles, makeRole()] })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', minHeight: '44px', padding: '0 16px',
                  border: '1.5px dashed #D1D5DB', borderRadius: '8px',
                  backgroundColor: 'transparent', color: '#6B7280', fontSize: '13px', cursor: 'pointer',
                }}
              >
                <Plus size={15} /> Add role for {seg.name}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Step 3.5 ───────────────────────────────────────────────────────────────────

interface Step4FormProps {
  data: BuyingCenterData
  onChange: (d: BuyingCenterData) => void
  onBlur: () => void
}

function Step4Form({ data, onChange, onBlur }: Step4FormProps) {
  return (
    <div className="space-y-6">
      <div>
        <label style={LABEL}>
          Stakeholder count:{' '}
          <span style={{ color: '#E8520A' }}>{data.stakeholderMin}–{data.stakeholderMax}</span>
        </label>
        <div className="space-y-2 mt-3">
          {(['Min', 'Max'] as const).map(type => {
            const isMin = type === 'Min'
            const value = isMin ? data.stakeholderMin : data.stakeholderMax
            return (
              <div key={type} className="flex items-center gap-3">
                <span className="text-xs w-7 text-right" style={{ color: '#6B7280' }}>{type}</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={value}
                  onChange={e => {
                    const val = Number(e.target.value)
                    if (isMin) {
                      onChange({ ...data, stakeholderMin: Math.min(val, data.stakeholderMax - 1) })
                    } else {
                      onChange({ ...data, stakeholderMax: Math.max(val, data.stakeholderMin + 1) })
                    }
                  }}
                  onBlur={onBlur}
                  className="flex-1"
                  style={{ accentColor: '#0A1628' }}
                />
                <span className="text-sm font-semibold w-5" style={{ color: '#0D0D0D' }}>{value}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label style={LABEL}>Decision style</label>
        <select
          value={data.decisionStyle}
          onChange={e => { onChange({ ...data, decisionStyle: e.target.value as DecisionStyle }); onBlur() }}
          style={INPUT}
        >
          {DECISION_STYLES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        <label style={LABEL}>Sales cycle length</label>
        <select
          value={data.salesCycle}
          onChange={e => { onChange({ ...data, salesCycle: e.target.value as SalesCycle }); onBlur() }}
          style={INPUT}
        >
          {SALES_CYCLES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label style={LABEL}>ACV range</label>
        <select
          value={data.acvRange}
          onChange={e => { onChange({ ...data, acvRange: e.target.value as ACVRange }); onBlur() }}
          style={INPUT}
        >
          {ACV_RANGES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CompanyProfilePage() {
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const [step1, setStep1] = useState<Step1Data>({ whatDoYouSell: '' })
  const [segments, setSegments] = useState<Segment[]>([
    makeSegment(), makeSegment(), makeSegment(),
  ])
  const [roles, setRoles] = useState<Record<string, BuyingRole[]>>({})
  const [buyingCenter, setBuyingCenter] = useState<BuyingCenterData>({
    stakeholderMin: 6,
    stakeholderMax: 10,
    decisionStyle: 'Consensus',
    salesCycle: '3-9 months',
    acvRange: '$10k-$100k',
  })

  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({
    1: 'idle', 2: 'idle', 3: 'idle', 4: 'idle',
  })

  // Maps step_id → existing step_output row id (for updates vs inserts)
  const recordIds = useRef<Record<string, string>>({})
  const timers = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({})

  // saveRef pattern: re-assigned each render so the debounced callback always
  // closes over the latest state without needing deps on triggerSave.
  const saveRef = useRef<((step: number, firePostHog: boolean) => Promise<void>) | null>(null)

  saveRef.current = async (step: number, firePostHog: boolean): Promise<void> => {
    const wsId = workspaceId
    console.log(`[save] step=${step} wsId=${wsId}`)
    if (!wsId) {
      console.warn('[save] aborting — workspaceId is null (auth or users-table lookup failed during init)')
      setSaveStates(prev => ({ ...prev, [step]: 'error' }))
      return
    }

    const stepId = STEP_IDS[step]
    const now = new Date().toISOString()

    let content: Record<string, unknown>
    if (step === 1) content = { whatDoYouSell: step1.whatDoYouSell }
    else if (step === 2) content = { segments }
    else if (step === 3) content = { roles }
    else content = { buyingCenter }

    setSaveStates(prev => ({ ...prev, [step]: 'saving' }))

    const existingId = recordIds.current[stepId]
    let hadError = false

    try {
      if (existingId) {
        console.log(`[save] UPDATE step_output id=${existingId}`)
        const { error } = await supabase
          .from('step_output')
          .update({ content, last_saved_at: now, last_updated_at: now } satisfies StepOutputUpdate)
          .eq('id', existingId)
        console.log('[save] UPDATE result =>', { error })
        hadError = !!error
      } else {
        console.log(`[save] INSERT step_output workspace_id=${wsId} step_id=${stepId}`)
        const { data: inserted, error } = await supabase
          .from('step_output')
          .insert({
            workspace_id: wsId,
            step_id: stepId,
            version: 1,
            status: 'draft' as StepStatus,
            content,
            copilot_assisted: false,
            last_saved_at: now,
            last_updated_at: now,
          } satisfies StepOutputInsert)
          .select('id')
          .single()

        console.log('[save] INSERT result =>', { inserted, error })
        hadError = !!error
        if (!error && inserted) {
          recordIds.current[stepId] = (inserted as { id: string }).id
        }
      }
    } catch (caughtErr) {
      console.error('[save] caught exception =>', caughtErr)
      hadError = true
    }

    if (hadError) {
      setSaveStates(prev => ({ ...prev, [step]: 'error' }))
      return
    }

    setSaveStates(prev => ({ ...prev, [step]: 'saved' }))
    setTimeout(() => setSaveStates(prev => ({ ...prev, [step]: 'idle' })), 3000)

    if (firePostHog) {
      captureEvent('onboarding.step_completed', {
        workspace_id: wsId,
        step_id: stepId,
        timestamp: now,
      })
    }
  }

  // Debounced auto-save: fires 600ms after last blur on each step
  const triggerSave = useCallback((step: number) => {
    clearTimeout(timers.current[step])
    setSaveStates(prev => ({ ...prev, [step]: 'saving' }))
    timers.current[step] = setTimeout(() => {
      void saveRef.current?.(step, false)
    }, 600)
  }, [])

  // On mount: resolve workspace from auth session, then pre-populate any
  // existing step_output drafts for this workspace.
  useEffect(() => {
    async function init() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        console.log('[init] auth.getUser =>', { user, authError })
        if (!user) return

        const { data: userRow, error: userLookupError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        const userData = userRow as AssemblyUser | null
        console.log('[init] users table lookup =>', { userData, userLookupError })
        if (!userData) return

        const wsId = userData.org_id
        console.log('[init] org_id =>', wsId)
        setWorkspaceId(wsId)

        const { data: rawOutputs } = await supabase
          .from('step_output')
          .select('*')
          .eq('workspace_id', wsId)
          .in('step_id', ['1', '2', '3', '3.5'])
          .order('version', { ascending: false })

        const outputs = rawOutputs as StepOutput[] | null
        if (!outputs?.length) return

        // Keep only the highest version per step_id
        const latest: Partial<Record<string, StepOutput>> = {}
        for (const row of outputs) {
          if (!latest[row.step_id]) {
            latest[row.step_id] = row
            recordIds.current[row.step_id] = row.id
          }
        }

        const s1 = latest['1']
        if (s1) {
          const c = s1.content as { whatDoYouSell?: string }
          setStep1({ whatDoYouSell: c.whatDoYouSell ?? '' })
        }

        const s2 = latest['2']
        if (s2) {
          const c = s2.content as { segments?: Segment[] }
          if (c.segments?.length) setSegments(c.segments)
        }

        const s3 = latest['3']
        if (s3) {
          const c = s3.content as { roles?: Record<string, BuyingRole[]> }
          if (c.roles) setRoles(c.roles)
        }

        const s35 = latest['3.5']
        if (s35) {
          const c = s35.content as { buyingCenter?: BuyingCenterData }
          if (c.buyingCenter) setBuyingCenter(c.buyingCenter)
        }
      } catch (initErr) {
        console.error('[init] unexpected error =>', initErr)
      } finally {
        setIsInitializing(false)
      }
    }
    void init()
  }, []) // supabase is a stable module-level singleton

  function canAdvance(): boolean {
    if (currentStep === 1) return step1.whatDoYouSell.trim().length > 0
    if (currentStep === 2) return segments.some(s => s.name.trim().length > 0)
    if (currentStep === 3) {
      const active = segments.filter(s => s.name.trim())
      return active.length > 0 && active.every(s => (roles[s.id] ?? []).some(r => r.title.trim()))
    }
    return true
  }

  function handleAdvance() {
    if (!canAdvance()) return

    const now = new Date().toISOString()
    const stepId = STEP_IDS[currentStep]

    // Fire PostHog synchronously on button click (not debounced)
    if (workspaceId) {
      captureEvent('onboarding.step_completed', {
        workspace_id: workspaceId,
        step_id: stepId,
        timestamp: now,
      })
      if (currentStep === 4) {
        captureEvent('journey.ttfaj_started', {
          workspace_id: workspaceId,
          timestamp: now,
        })
      }
    }

    // Debounced Supabase write (non-blocking)
    triggerSave(currentStep)

    if (currentStep >= 4) {
      router.push('/dashboard')
      return
    }

    const next = currentStep + 1
    if (next === 3) {
      setRoles(prev => {
        const updated = { ...prev }
        for (const seg of segments.filter(s => s.name.trim())) {
          if (!updated[seg.id]?.length) updated[seg.id] = [makeRole()]
        }
        return updated
      })
    }
    setCurrentStep(next)
  }

  const activeSegments = segments.filter(s => s.name.trim())

  // Loading skeleton while resolving auth + existing data
  if (isInitializing) {
    return (
      <div style={{ backgroundColor: '#F8F6F1' }} className="min-h-screen">
        <header style={{ backgroundColor: '#0A1628', paddingTop: '24px' }} className="px-8 py-6">
          <h1 className="text-white text-2xl font-semibold">Company Profile</h1>
        </header>
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin" style={{ color: '#6B7280' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F8F6F1' }} className="min-h-screen">
      {/* Header */}
      <header style={{ backgroundColor: '#0A1628', paddingTop: '24px' }} className="px-8 py-6">
        <h1 className="text-white text-2xl font-semibold">Company Profile</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
          No Copilot during setup — these are your raw inputs.
        </p>
      </header>

      <div className="px-8 py-8" style={{ maxWidth: '768px' }}>
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm font-semibold" style={{ color: '#0D0D0D' }}>
              Step {currentStep} of 4
            </span>
            <span className="text-sm" style={{ color: '#6B7280' }}>
              {STEP_LABELS[currentStep - 1]}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E7EB' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / 4) * 100}%`, backgroundColor: '#0A1628' }}
            />
          </div>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {([1, 2, 3, 4] as const).map(n => {
            const isActive = currentStep === n
            const isPast = currentStep > n
            const isFuture = currentStep < n

            return (
              <div
                key={n}
                className="rounded-xl overflow-hidden"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
              >
                {/* Step header */}
                <button
                  onClick={() => { if (isPast) setCurrentStep(n) }}
                  disabled={isFuture}
                  style={{
                    minHeight: '56px',
                    width: '100%',
                    padding: '0 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isActive ? '#0A1628' : '#FFFFFF',
                    border: 'none',
                    cursor: isPast ? 'pointer' : isFuture ? 'not-allowed' : 'default',
                    textAlign: 'left',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-bold"
                      style={{
                        width: '26px',
                        height: '26px',
                        backgroundColor: isActive ? '#E8520A' : isPast ? '#22C55E' : '#E5E7EB',
                        color: isActive || isPast ? '#FFFFFF' : '#6B7280',
                        fontSize: n === 4 ? '9px' : '12px',
                      }}
                    >
                      {isPast ? '✓' : n === 4 ? '3.5' : n}
                    </span>
                    <span
                      className="font-semibold text-sm"
                      style={{ color: isActive ? '#FFFFFF' : isFuture ? '#9CA3AF' : '#0D0D0D' }}
                    >
                      {STEP_LABELS[n - 1]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <SaveIndicator state={saveStates[n]} />
                    <ChevronDown
                      size={16}
                      color={isActive ? '#FFFFFF' : '#9CA3AF'}
                      style={{
                        transform: isActive ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </div>
                </button>

                {/* Step body */}
                {isActive && (
                  <div className="p-6 border-t" style={{ backgroundColor: '#FFFFFF', borderColor: '#F3F4F6' }}>
                    {n === 1 && (
                      <Step1Form
                        data={step1}
                        onChange={setStep1}
                        onBlur={() => triggerSave(1)}
                      />
                    )}
                    {n === 2 && (
                      <Step2Form
                        segments={segments}
                        onChange={setSegments}
                        onBlur={() => triggerSave(2)}
                      />
                    )}
                    {n === 3 && (
                      <Step3Form
                        activeSegments={activeSegments}
                        roles={roles}
                        onChange={setRoles}
                        onBlur={() => triggerSave(3)}
                      />
                    )}
                    {n === 4 && (
                      <Step4Form
                        data={buyingCenter}
                        onChange={setBuyingCenter}
                        onBlur={() => triggerSave(4)}
                      />
                    )}

                    <div className="flex items-center gap-4 mt-6">
                      <button
                        onClick={handleAdvance}
                        disabled={!canAdvance()}
                        style={{
                          minHeight: '44px',
                          padding: '0 28px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: canAdvance() ? '#E8520A' : '#E5E7EB',
                          color: canAdvance() ? '#FFFFFF' : '#9CA3AF',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: canAdvance() ? 'pointer' : 'not-allowed',
                          transition: 'opacity 0.15s',
                        }}
                      >
                        {currentStep === 4 ? 'Complete Profile →' : 'Save and Continue →'}
                      </button>
                      {!canAdvance() && currentStep !== 4 && (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>
                          {currentStep === 1 && 'Fill in "What do you sell?" to continue'}
                          {currentStep === 2 && 'Add at least one segment name to continue'}
                          {currentStep === 3 && 'Add at least one titled role per segment to continue'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
