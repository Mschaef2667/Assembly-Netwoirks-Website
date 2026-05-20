'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, CheckCircle2, AlertTriangle, Lock, ChevronRight,
  Clock, ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { calculateDecayedConfidence } from '@/lib/context/confidenceDecay'

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = 'approved' | 'pending_approval' | 'draft' | 'not_started'
type DepHealth = 'healthy' | 'warning' | 'locked'
type GateState = 'locked' | 'pending' | 'approved'
type SectionStatus = 'complete' | 'in_progress' | 'not_started'

interface StepDef {
  id: string
  title: string
  description: string
  phase: number
}

interface StepDep {
  step_id: string
  prerequisite_step_id: string
}

interface StepOutputRow {
  status: StepStatus
  original_confidence: number | null
  last_reviewed_at: string | null
  created_at: string
}

type RenderItem =
  | { kind: 'phase'; phase: number; section: string }
  | { kind: 'gate'; afterPhase: number; label: string; gateStepId: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASES: { phase: number; section: string }[] = [
  { phase: 1, section: 'Company Foundation' },
  { phase: 2, section: 'Endemic Problems' },
  { phase: 3, section: 'Company Formulas' },
  { phase: 4, section: 'Competitive Environments' },
  { phase: 5, section: 'Strategic Messages' },
  { phase: 6, section: 'Action Plan' },
]

const GATES: { afterPhase: number; label: string; gateStepId: string }[] = [
  { afterPhase: 3, label: 'Gate 2 — Company Formulas Review', gateStepId: '16' },
  { afterPhase: 5, label: 'Gate 3 — Strategic Messages Review', gateStepId: '30' },
  { afterPhase: 6, label: 'Gate 4 — Action Plan Review', gateStepId: '38' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function numericId(id: string): number {
  return parseFloat(id)
}

function getDepHealth(
  stepId: string,
  depsMap: Map<string, string[]>,
  outputMap: Map<string, StepOutputRow>,
): DepHealth {
  const prereqs = depsMap.get(stepId) ?? []
  if (prereqs.length === 0) return 'healthy'
  const approvedCount = prereqs.filter(pid => outputMap.get(pid)?.status === 'approved').length
  if (approvedCount === prereqs.length) return 'healthy'
  if (approvedCount === 0) return 'locked'
  return 'warning'
}

function getGateState(gateStepId: string, outputMap: Map<string, StepOutputRow>): GateState {
  const status = outputMap.get(gateStepId)?.status
  if (status === 'approved') return 'approved'
  if (status === 'pending_approval') return 'pending'
  return 'locked'
}

function getContinueStepId(
  steps: StepDef[],
  depsMap: Map<string, string[]>,
  outputMap: Map<string, StepOutputRow>,
): string | null {
  const sorted = [...steps].sort((a, b) => numericId(a.id) - numericId(b.id))
  for (const step of sorted) {
    if ((outputMap.get(step.id)?.status ?? 'not_started') === 'approved') continue
    if (getDepHealth(step.id, depsMap, outputMap) === 'healthy') return step.id
  }
  return null
}

function getSectionStatus(phaseSteps: StepDef[], outputMap: Map<string, StepOutputRow>): SectionStatus {
  const total = phaseSteps.length
  if (total === 0) return 'not_started'
  const approved = phaseSteps.filter(s => outputMap.get(s.id)?.status === 'approved').length
  const started = phaseSteps.filter(s => outputMap.has(s.id)).length
  if (approved === total) return 'complete'
  if (started > 0) return 'in_progress'
  return 'not_started'
}

function getNextStepInPhase(phaseSteps: StepDef[], outputMap: Map<string, StepOutputRow>): StepDef | null {
  const sorted = [...phaseSteps].sort((a, b) => numericId(a.id) - numericId(b.id))
  for (const step of sorted) {
    if ((outputMap.get(step.id)?.status ?? 'not_started') !== 'approved') return step
  }
  return null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DepHealthIcon({ health }: { health: DepHealth }) {
  if (health === 'healthy') return <CheckCircle2 size={14} style={{ color: '#16A34A', flexShrink: 0 }} />
  if (health === 'warning') return <AlertTriangle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
  return <Lock size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
}

function StatusBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; color: string; bg: string }> = {
    approved:         { label: 'Approved',    color: '#FFFFFF',              bg: '#0EA5E9'              },
    pending_approval: { label: 'In Review',   color: '#FFFFFF',              bg: '#E8520A'              },
    draft:            { label: 'Draft',       color: '#0EA5E9',              bg: 'rgba(14,165,233,0.2)' },
    not_started:      { label: 'Not Started', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.1)' },
  }
  const { label, color, bg } = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '999px',
      backgroundColor: bg, color, fontSize: '10px', fontWeight: 700,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

function SectionStatusBadge({ status }: { status: SectionStatus }) {
  const map: Record<SectionStatus, { label: string; color: string; bg: string }> = {
    complete:    { label: 'Complete',    color: '#FFFFFF',              bg: '#0EA5E9'              },
    in_progress: { label: 'In Progress', color: '#0EA5E9',              bg: 'rgba(14,165,233,0.2)' },
    not_started: { label: 'Not Started', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.1)' },
  }
  const { label, color, bg } = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '999px',
      backgroundColor: bg, color, fontSize: '10px', fontWeight: 700,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

function GateBanner({ label, state }: { label: string; state: GateState }) {
  const map: Record<GateState, { bg: string; border: string; color: string; icon: React.ReactNode; desc: string }> = {
    approved: {
      bg: 'rgba(14,165,233,0.08)', border: '#0EA5E9', color: '#0EA5E9',
      icon: <CheckCircle2 size={16} />,
      desc: 'All steps reviewed and approved. The next section is unlocked.',
    },
    pending: {
      bg: 'rgba(232,82,10,0.08)', border: '#E8520A', color: '#E8520A',
      icon: <Clock size={16} />,
      desc: 'Submitted for review. An Approver must sign off before the next section unlocks.',
    },
    locked: {
      bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)',
      icon: <Lock size={16} />,
      desc: 'Complete and approve all steps in this section to unlock the gate review.',
    },
  }
  const { bg, border, color, icon, desc } = map[state]
  return (
    <div style={{
      padding: '14px 18px',
      backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '10px',
      display: 'flex', gap: '12px', alignItems: 'flex-start',
    }}>
      <span style={{ color, flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 700, color, margin: '0 0 2px' }}>{label}</p>
        <p style={{ fontSize: '12px', color, margin: 0, opacity: 0.8 }}>{desc}</p>
      </div>
    </div>
  )
}

function StartHereCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', flex: 1, minWidth: '180px' }}>
      <div style={{ backgroundColor: '#0F2140', borderRadius: '10px', padding: '20px', height: '100%', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,0.1)' }}>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px' }}>{title}</p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: '1.55' }}>{desc}</p>
      </div>
    </Link>
  )
}

function StartHereBanner() {
  return (
    <div style={{ backgroundColor: '#0A1628', borderRadius: '14px', padding: '32px', marginBottom: '32px' }}>
      <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>
        Welcome to your C3 Method Journey
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '0 0 28px', lineHeight: '1.6' }}>
        Complete these sections in order to build your strategic messaging framework
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <StartHereCard href="/dashboard/company-profile" title="Company Foundation" desc="Start with your company profile and buying center" />
        <ArrowRight size={20} style={{ color: '#E8520A', flexShrink: 0 }} />
        <StartHereCard href="/dashboard/intelligence" title="Intelligence" desc="Run your Decision Clarity Process survey" />
        <ArrowRight size={20} style={{ color: '#E8520A', flexShrink: 0 }} />
        <StartHereCard href="/dashboard/journeys/step/1" title="Begin Journey" desc="Start Step 1 of your C3 Method journey" />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JourneysPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<StepDef[]>([])
  const [outputMap, setOutputMap] = useState<Map<string, StepOutputRow>>(new Map())
  const [depsMap, setDepsMap] = useState<Map<string, string[]>>(new Map())
  const [continueStepId, setContinueStepId] = useState<string | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]))

  function togglePhase(phase: number) {
    setExpandedPhases(prev => {
      const s = new Set(prev)
      if (s.has(phase)) s.delete(phase); else s.add(phase)
      return s
    })
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users').select('org_id').eq('id', user.id).single()
        if (!userRow) return
        const wsId = (userRow as Record<string, unknown>)['org_id'] as string

        const [defsRes, depsRes, outputsRes] = await Promise.all([
          supabase.from('step_definition').select('id, title, description, phase'),
          supabase.from('step_dependency').select('step_id, prerequisite_step_id'),
          supabase
            .from('step_output')
            .select('step_id, status, version, original_confidence, last_reviewed_at, created_at')
            .eq('workspace_id', wsId)
            .order('version', { ascending: false }),
        ])

        const parsedSteps: StepDef[] = ((defsRes.data ?? []) as Array<Record<string, unknown>>).map(r => ({
          id: String(r['id'] ?? ''),
          title: String(r['title'] ?? ''),
          description: String(r['description'] ?? ''),
          phase: Number(r['phase'] ?? 0),
        }))
        setSteps(parsedSteps)

        const rawDeps = (depsRes.data ?? []) as StepDep[]
        const dm = new Map<string, string[]>()
        for (const dep of rawDeps) {
          const arr = dm.get(dep.step_id) ?? []
          arr.push(dep.prerequisite_step_id)
          dm.set(dep.step_id, arr)
        }
        setDepsMap(dm)

        const om = new Map<string, StepOutputRow>()
        for (const row of ((outputsRes.data ?? []) as Array<Record<string, unknown>>)) {
          const sid = String(row['step_id'] ?? '')
          if (!om.has(sid)) {
            om.set(sid, {
              status: (row['status'] as StepStatus) ?? 'not_started',
              original_confidence: typeof row['original_confidence'] === 'number' ? row['original_confidence'] : null,
              last_reviewed_at: typeof row['last_reviewed_at'] === 'string' ? row['last_reviewed_at'] : null,
              created_at: String(row['created_at'] ?? new Date().toISOString()),
            })
          }
        }
        setOutputMap(om)

        // Compute and log confidence decay — fire-and-forget, non-blocking
        for (const [sid, row] of om.entries()) {
          if (row.status !== 'approved' && row.status !== 'draft') continue
          const decayed = calculateDecayedConfidence({
            status: row.status,
            original_confidence: row.original_confidence,
            last_reviewed_at: row.last_reviewed_at,
            created_at: row.created_at,
          })
          if (decayed !== null && decayed !== row.original_confidence) {
            const refDate = row.last_reviewed_at ?? row.created_at
            const decayDays = Math.max(0, Math.floor(
              (Date.now() - Date.parse(refDate)) / (1000 * 60 * 60 * 24),
            ))
            supabase.from('confidence_decay_log').insert({
              workspace_id: wsId,
              step_id: sid,
              original_confidence: row.original_confidence,
              decayed_confidence: decayed,
              decay_days: decayDays,
              logged_at: new Date().toISOString(),
            }).then(() => {}, () => {})
          }
        }

        setContinueStepId(getContinueStepId(parsedSteps, dm, om))
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  const stepsByPhase = new Map<number, StepDef[]>()
  for (const step of steps) {
    const arr = stepsByPhase.get(step.phase) ?? []
    arr.push(step)
    stepsByPhase.set(step.phase, arr)
  }

  const phaseSteps = steps.filter(s => s.phase >= 1 && s.phase <= 6)
  const totalSteps = phaseSteps.length
  const totalApproved = phaseSteps.filter(s => outputMap.get(s.id)?.status === 'approved').length
  const hasAnyProgress = outputMap.size > 0

  const renderList: RenderItem[] = []
  for (const { phase, section } of PHASES) {
    renderList.push({ kind: 'phase', phase, section })
    const gate = GATES.find(g => g.afterPhase === phase)
    if (gate) renderList.push({ kind: 'gate', afterPhase: phase, label: gate.label, gateStepId: gate.gateStepId })
  }

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Journeys</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
              Complete all 38 C3 Method steps to build your go-to-market operating system.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
              {totalApproved} / {totalSteps} steps approved
            </p>
            <Link
              id="journey-report-btn"
              href="/dashboard/journeys/report"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '44px',
                padding: '0 18px',
                backgroundColor: '#E8520A',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Generate Report
            </Link>
          </div>
        </div>
        <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${totalSteps > 0 ? (totalApproved / totalSteps) * 100 : 0}%`,
            backgroundColor: '#0EA5E9',
            borderRadius: '999px',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </header>

      <div style={{ padding: '24px 32px' }}>

        {!hasAnyProgress && <StartHereBanner />}

        {hasAnyProgress && (
          <div id="journey-sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', alignItems: 'start' }}>
            {renderList.map((item) => {
              if (item.kind === 'gate') {
                return (
                  <div key={`gate-${item.afterPhase}`} style={{ gridColumn: '1 / -1' }}>
                    <GateBanner label={item.label} state={getGateState(item.gateStepId, outputMap)} />
                  </div>
                )
              }

              const phaseSteps = (stepsByPhase.get(item.phase) ?? [])
                .sort((a, b) => numericId(a.id) - numericId(b.id))
              if (phaseSteps.length === 0) return null

              const approvedCount = phaseSteps.filter(s => outputMap.get(s.id)?.status === 'approved').length
              const progressPct = (approvedCount / phaseSteps.length) * 100
              const secStatus = getSectionStatus(phaseSteps, outputMap)
              const nextInPhase = getNextStepInPhase(phaseSteps, outputMap)
              const isExpanded = expandedPhases.has(item.phase)

              return (
                <div key={`phase-${item.phase}`} style={{
                  backgroundColor: '#0F2140',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}>
                  {/* Navy card header — click to expand/collapse */}
                  <button
                    onClick={() => togglePhase(item.phase)}
                    style={{
                      width: '100%', border: 'none', cursor: 'pointer',
                      backgroundColor: '#0A1628', padding: '16px 20px',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        backgroundColor: '#0EA5E9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 700 }}>{item.phase}</span>
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <p style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 700, margin: 0 }}>{item.section}</p>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: '2px 0 0' }}>
                          {approvedCount} of {phaseSteps.length} approved
                        </p>
                      </div>
                      <SectionStatusBadge status={secStatus} />
                      {isExpanded
                        ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                        : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />}
                    </div>
                    <div style={{ marginTop: '10px', height: '3px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${progressPct}%`,
                        backgroundColor: progressPct === 100 ? '#16A34A' : '#0EA5E9',
                        borderRadius: '999px', transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div>
                      {phaseSteps.map((step, idx) => {
                        const outputRow = outputMap.get(step.id)
                        const status = outputRow?.status ?? 'not_started'
                        const health = getDepHealth(step.id, depsMap, outputMap)
                        const isContinue = step.id === continueStepId

                        return (
                          <button
                            key={step.id}
                            onClick={() => router.push(`/dashboard/journeys/step/${step.id}`)}
                            style={{
                              width: '100%', minHeight: '52px',
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '8px 16px',
                              backgroundColor: isContinue ? 'rgba(14,165,233,0.08)' : 'transparent',
                              border: 'none',
                              borderBottom: idx < phaseSteps.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                              cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            <DepHealthIcon health={health} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', minWidth: '22px', flexShrink: 0, textAlign: 'right' }}>
                              {step.id}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {step.title}
                              </p>
                            </div>
                            <StatusBadge status={status} />
                            {isContinue && (
                              <span style={{
                                minHeight: '28px', padding: '0 10px',
                                display: 'inline-flex', alignItems: 'center',
                                backgroundColor: '#E8520A', color: '#FFFFFF',
                                borderRadius: '5px', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                              }}>
                                Continue
                              </span>
                            )}
                            <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                          </button>
                        )
                      })}

                      {nextInPhase && (
                        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                          <Link
                            href={`/dashboard/journeys/step/${nextInPhase.id}`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '6px 14px', minHeight: '36px',
                              backgroundColor: '#E8520A', color: '#FFFFFF',
                              borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                              textDecoration: 'none',
                            }}
                          >
                            <ChevronRight size={13} />
                            {`Continue: ${nextInPhase.title.length > 28 ? nextInPhase.title.slice(0, 28) + '…' : nextInPhase.title}`}
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
