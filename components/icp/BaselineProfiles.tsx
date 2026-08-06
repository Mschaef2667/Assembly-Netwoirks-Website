'use client'

/**
 * Step 1 of the ICP Calibrator: Baseline Profiles.
 *
 * Captures what the client believed on day one — who their best customers are,
 * before any buyer research comes back. Calibration (Step 3) is a comparison, so
 * this is the "before" that later evidence is measured against. Without it the
 * module can only assert it calibrated something.
 *
 * The four categories come from lib/icp/customer-categories.ts (single source of
 * truth). One profile is expected per category, up to three allowed. Whether a
 * profile is a real current customer or an aspirational ideal is an explicit
 * per-profile toggle, because evidence that contradicts an *ideal* is a market
 * signal, not a correction.
 *
 * Self-contained: owns its own load/save against icp_baseline_profile.
 */

import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Trash2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { CUSTOMER_CATEGORIES } from '@/lib/icp/customer-categories'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProfileType = 'current' | 'ideal'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SegmentOption {
  index: number
  name: string
  industry?: string
  companySize?: string
  geography?: string
  annualRevenue?: string
  decisionMakers?: { role: string; influence: string; risk: string }[]
}

interface BaselineRow {
  /** Stable local key, present before the row has a DB id. */
  key: string
  /** DB id once persisted, null while still a draft. */
  id: string | null
  category: string
  profile_type: ProfileType
  customer_name: string
  contact_name: string
  contact_title: string
  segment_index: number | null
  segment_name: string
  industry: string
  company_size: string
  why_fits: string
  additional_context: string
}

interface BaselineProfilesProps {
  orgId: string
  segments: SegmentOption[]
}

const MAX_PER_CATEGORY = 3
const AUTOSAVE_MS = 800

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '18px',
}

const LABEL_ST: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
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
  minHeight: '68px',
  resize: 'vertical',
  lineHeight: '1.6',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `k_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function emptyRow(category: string): BaselineRow {
  return {
    key: newKey(),
    id: null,
    category,
    profile_type: 'current',
    customer_name: '',
    contact_name: '',
    contact_title: '',
    segment_index: null,
    segment_name: '',
    industry: '',
    company_size: '',
    why_fits: '',
    additional_context: '',
  }
}

function rowFromDb(raw: Record<string, unknown>): BaselineRow {
  const s = (v: unknown): string => (typeof v === 'string' ? v : '')
  const segIdx = raw['segment_index']
  return {
    key: newKey(),
    id: raw['id'] ? String(raw['id']) : null,
    category: s(raw['category']),
    profile_type: raw['profile_type'] === 'ideal' ? 'ideal' : 'current',
    customer_name: s(raw['customer_name']),
    contact_name: s(raw['contact_name']),
    contact_title: s(raw['contact_title']),
    segment_index: typeof segIdx === 'number' ? segIdx : segIdx != null ? Number(segIdx) || null : null,
    segment_name: s(raw['segment_name']),
    industry: s(raw['industry']),
    company_size: s(raw['company_size']),
    why_fits: s(raw['why_fits']),
    additional_context: s(raw['additional_context']),
  }
}

// ── Save indicator ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
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
  if (state === 'error') return <span style={{ fontSize: '12px', color: '#EF4444' }}>Save failed</span>
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BaselineProfiles({ orgId, segments }: BaselineProfilesProps) {
  const [rows, setRows] = useState<BaselineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)

  const rowsRef = useRef<BaselineRow[]>([])
  const orgIdRef = useRef<string>(orgId)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // The debounced autosave reads these at fire time, so keep them current. Done
  // in an effect rather than during render to satisfy react-hooks/refs.
  useEffect(() => {
    rowsRef.current = rows
    orgIdRef.current = orgId
  })

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await supabase
          .from('icp_baseline_profile')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: true })
        if (cancelled) return
        const loaded = ((data ?? []) as Array<Record<string, unknown>>).map(rowFromDb)
        setRows(loaded)
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [orgId])

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function doSave(key: string) {
    const row = rowsRef.current.find(r => r.key === key)
    const wsId = orgIdRef.current
    if (!row || !wsId) return
    // Nothing worth persisting yet — a category and at least a name.
    if (!row.customer_name.trim() && !row.id) return

    setSaveStates(prev => ({ ...prev, [key]: 'saving' }))
    const payload = {
      org_id: wsId,
      category: row.category,
      profile_type: row.profile_type,
      customer_name: row.customer_name.trim() || null,
      contact_name: row.contact_name.trim() || null,
      contact_title: row.contact_title.trim() || null,
      segment_index: row.segment_index,
      segment_name: row.segment_name.trim() || null,
      industry: row.industry.trim() || null,
      company_size: row.company_size.trim() || null,
      why_fits: row.why_fits.trim() || null,
      additional_context: row.additional_context.trim() || null,
      updated_at: new Date().toISOString(),
    }
    try {
      if (row.id) {
        const { error } = await supabase.from('icp_baseline_profile').update(payload).eq('id', row.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('icp_baseline_profile')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        const newId = data ? String((data as Record<string, unknown>)['id'] ?? '') : ''
        if (newId) {
          setRows(prev => prev.map(r => (r.key === key ? { ...r, id: newId } : r)))
        }
      }
      setSaveStates(prev => ({ ...prev, [key]: 'saved' }))
      setTimeout(() => setSaveStates(prev => (prev[key] === 'saved' ? { ...prev, [key]: 'idle' } : prev)), 2200)
    } catch {
      setSaveStates(prev => ({ ...prev, [key]: 'error' }))
    }
  }

  function scheduleSave(key: string) {
    const existing = saveTimers.current.get(key)
    if (existing) clearTimeout(existing)
    saveTimers.current.set(key, setTimeout(() => void doSave(key), AUTOSAVE_MS))
  }

  function patchRow(key: string, patch: Partial<BaselineRow>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))
    scheduleSave(key)
  }

  function onSegmentChange(key: string, value: string) {
    const idx = value ? Number(value) : null
    const seg = idx != null ? segments.find(s => s.index === idx) : undefined
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r
      return {
        ...r,
        segment_index: idx,
        segment_name: seg?.name ?? '',
        // Prefill firmographics from the segment only where the profile is blank,
        // so a manual override is never clobbered.
        industry: r.industry.trim() ? r.industry : (seg?.industry ?? ''),
        company_size: r.company_size.trim() ? r.company_size : (seg?.companySize ?? ''),
      }
    }))
    scheduleSave(key)
  }

  function addRow(category: string) {
    const row = emptyRow(category)
    setRows(prev => [...prev, row])
  }

  async function removeRow(key: string) {
    const row = rowsRef.current.find(r => r.key === key)
    setConfirmDeleteKey(null)
    const timer = saveTimers.current.get(key)
    if (timer) { clearTimeout(timer); saveTimers.current.delete(key) }
    setRows(prev => prev.filter(r => r.key !== key))
    if (row?.id) {
      try {
        await supabase.from('icp_baseline_profile').delete().eq('id', row.id)
      } catch {
        // non-fatal; the row is already gone from the UI
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'rgba(255,255,255,0.35)' }} />
      </div>
    )
  }

  const completeCount = CUSTOMER_CATEGORIES.filter(c => rows.some(r => r.category === c.value)).length
  const totalCategories = CUSTOMER_CATEGORIES.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6', margin: 0 }}>
        Before any buyer research comes back, capture who you believe your best customers are today. Later
        steps compare real evidence against these day-one profiles, so this is the &ldquo;before&rdquo; picture
        the calibration is measured against. Name at least one customer per category; add up to three.
      </p>

      {/* Progress: one profile per category is the bar to clear. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          fontSize: '13px', fontWeight: 700,
          color: completeCount === totalCategories ? '#16A34A' : '#E8520A',
        }}>
          {completeCount} of {totalCategories} complete
        </span>
        <div style={{ flex: 1, maxWidth: '260px', height: '6px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{
            width: `${(completeCount / totalCategories) * 100}%`, height: '100%',
            backgroundColor: completeCount === totalCategories ? '#16A34A' : '#E8520A',
            transition: 'width 0.2s ease',
          }} />
        </div>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          {completeCount === totalCategories ? 'Every category has a profile' : 'One profile per category'}
        </span>
      </div>

      {CUSTOMER_CATEGORIES.map(cat => {
        const catRows = rows.filter(r => r.category === cat.value)
        return (
          <div key={cat.value} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Category heading */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>{cat.label}</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginLeft: '10px' }}>{cat.hint}</span>
              </div>
              {catRows.length === 0 && (
                <span style={{ fontSize: '12px', color: '#E8520A', fontWeight: 600, flexShrink: 0 }}>Add at least one</span>
              )}
            </div>

            {catRows.map(row => (
              <div key={row.key} style={CARD}>
                {/* Row header: current/ideal toggle, save state, remove */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(['current', 'ideal'] as ProfileType[]).map(pt => (
                      <button
                        key={pt}
                        onClick={() => patchRow(row.key, { profile_type: pt })}
                        style={{
                          minHeight: '32px', padding: '0 14px', borderRadius: '999px', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 600, border: '1px solid',
                          backgroundColor: row.profile_type === pt ? (pt === 'ideal' ? 'rgba(14,165,233,0.15)' : 'rgba(22,163,74,0.15)') : 'rgba(255,255,255,0.04)',
                          color: row.profile_type === pt ? (pt === 'ideal' ? '#0EA5E9' : '#16A34A') : 'rgba(255,255,255,0.55)',
                          borderColor: row.profile_type === pt ? (pt === 'ideal' ? 'rgba(14,165,233,0.4)' : 'rgba(22,163,74,0.4)') : 'rgba(255,255,255,0.12)',
                        }}
                      >
                        {pt === 'current' ? 'Customer we have' : 'Customer we want'}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <SaveIndicator state={saveStates[row.key] ?? 'idle'} />
                    {confirmDeleteKey === row.key ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => void removeRow(row.key)}
                          style={{ minHeight: '30px', padding: '0 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                            backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}>
                          Remove
                        </button>
                        <button onClick={() => setConfirmDeleteKey(null)}
                          style={{ minHeight: '30px', padding: '0 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                            backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDeleteKey(row.key)} aria-label="Remove profile"
                        style={{ minHeight: '30px', minWidth: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={LABEL_ST}>{row.profile_type === 'ideal' ? 'Profile description' : 'Customer name'}</label>
                    <input style={INPUT_ST} type="text" value={row.customer_name}
                      placeholder={row.profile_type === 'ideal' ? 'e.g. Post-Series A vertical SaaS, first marketing hire' : 'e.g. Northgate Analytics'}
                      onChange={e => patchRow(row.key, { customer_name: e.target.value })} />
                  </div>
                  <div>
                    <label style={LABEL_ST}>Contact name</label>
                    <input style={INPUT_ST} type="text" value={row.contact_name} placeholder="e.g. Dana Whitfield"
                      onChange={e => patchRow(row.key, { contact_name: e.target.value })} />
                  </div>
                  <div>
                    <label style={LABEL_ST}>Contact title</label>
                    <input style={INPUT_ST} type="text" value={row.contact_title} placeholder="e.g. VP Marketing"
                      onChange={e => patchRow(row.key, { contact_title: e.target.value })} />
                  </div>
                  <div>
                    <label style={LABEL_ST}>Target market</label>
                    <select style={{ ...INPUT_ST, appearance: 'none' }} value={row.segment_index != null ? String(row.segment_index) : ''}
                      onChange={e => onSegmentChange(row.key, e.target.value)}>
                      <option value="">— No target market —</option>
                      {segments.map(s => (
                        <option key={s.index} value={String(s.index)}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL_ST}>Industry</label>
                    <input style={INPUT_ST} type="text" value={row.industry} placeholder="e.g. Professional Services"
                      onChange={e => patchRow(row.key, { industry: e.target.value })} />
                  </div>
                  <div>
                    <label style={LABEL_ST}>Company size</label>
                    <input style={INPUT_ST} type="text" value={row.company_size} placeholder="e.g. 11-50 employees"
                      onChange={e => patchRow(row.key, { company_size: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={LABEL_ST}>Why they belong in this category</label>
                    <textarea style={TEXTAREA_ST} value={row.why_fits}
                      placeholder="What makes them your most profitable / loyal / influential / highest-growth customer?"
                      onChange={e => patchRow(row.key, { why_fits: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={LABEL_ST}>Additional context <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                    <textarea style={TEXTAREA_ST} value={row.additional_context}
                      placeholder="Anything else worth remembering about this customer…"
                      onChange={e => patchRow(row.key, { additional_context: e.target.value })} />
                  </div>
                  {(() => {
                    const seg = row.segment_index != null ? segments.find(s => s.index === row.segment_index) : undefined
                    if (!seg) return null
                    const dms = seg.decisionMakers ?? []
                    const hasContext = !!(seg.geography || seg.annualRevenue || dms.length > 0)
                    if (!hasContext) return null
                    return (
                      <div style={{ gridColumn: 'span 2', padding: '12px 14px', backgroundColor: 'rgba(232,82,10,0.06)',
                        border: '1px solid rgba(232,82,10,0.25)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          color: '#E8520A', marginBottom: '8px' }}>
                          What we already know about {seg.name}
                        </div>
                        {(seg.geography || seg.annualRevenue) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: dms.length > 0 ? '10px' : 0 }}>
                            {seg.geography && (
                              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', padding: '3px 10px',
                                backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.45)' }}>Geography:</span> {seg.geography}
                              </span>
                            )}
                            {seg.annualRevenue && (
                              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', padding: '3px 10px',
                                backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.45)' }}>Annual revenue:</span> {seg.annualRevenue}
                              </span>
                            )}
                          </div>
                        )}
                        {dms.length > 0 && (
                          <div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>Decision makers</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {dms.map((dm, di) => (
                                <div key={di} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                                  <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{dm.role}</span>
                                  {dm.influence && <span> · {dm.influence} influence</span>}
                                  {dm.risk && <span> · {dm.risk} risk</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            ))}

            {catRows.length < MAX_PER_CATEGORY && (
              <button onClick={() => addRow(cat.value)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', minHeight: '38px', alignSelf: 'flex-start',
                  backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px dashed rgba(255,255,255,0.2)',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={14} /> Add {cat.label.toLowerCase()} {catRows.length === 0 ? 'customer' : 'profile'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
