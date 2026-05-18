'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertTriangle, Lock, ChevronRight, Clock, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { calculateDecayedConfidence } from '@/lib/context/confidenceDecay'
import ConfidenceBar from '@/components/copilot/ConfidenceBar'

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = 'approved' | 'pending_approval' | 'draft' | 'not_started'
type DepHealth = 'healthy' | 'warning' | 'locked'
type GateState = 'locked' | 'pending' | 'approved'

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

// ── Dep health icon ───────────────────────────────────────────────────────────

function DepHealthIcon({ health }: { health: DepHealth }) {
  if (health === 'healthy') {
    return <CheckCircle2 size={15} style={{ color: '#16A34A', flexShrink: 0 }} />
  }
  if (health === 'warning') {
    return <AlertTriangle size={15} style={{ color: '#DC2626', flexShrink: 0 }} />
  }
  return <Lock size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; color: string; bg: string }> = {
    approved:         { label: 'Approved',    color: '#15803D', bg: '#DCFCE7' },
    pending_approval: { label: 'In Review',   color: '#92400E', bg: '#FEF3C7' },
    draft:            { label: 'Draft',       color: '#1D4ED8', bg: '#DBEAFE' },
    not_started:      { label: 'Not Started', color: '#6B7280', bg: '#F3F4F6' },
  }
  const { label, color, bg } = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: '999px',
      backgroundColor: bg, color, fontSize: '11px', fontWeight: 700,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

// ── Gate banner ───────────────────────────────────────────────────────────────

function GateBanner({ label, state }: { label: string; state: GateState }) {
  const map: Record<GateState, { bg: string; border: string; color: string; icon: React.ReactNode; desc: string }> = {
    approved: {
      bg: '#F0FDF4', border: '#86EFAC', color: '#15803D',
      icon: <CheckCircle2 size={16} />,
      desc: 'All steps reviewed and approved. The next section is unlocked.',
    },
    pending: {
      bg: '#FFFBEB', border: '#FCD34D', color: '#92400E',
      icon: <Clock size={16} />,
      desc: 'Submitted for review. An Approver must sign off before the next section unlocks.',
    },
    locked: {
      bg: '#F9FAFB', border: '#E5E7EB', color: '#6B7280',
      icon: <Lock size={16} />,
      desc: 'Complete and approve all steps in this section to unlock the gate review.',
    },
  }
  const { bg, border, color, icon, desc } = map[state]
  return (
    <div style={{
      margin: '10px 0 4px',
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

// ── Start Here Banner ─────────────────────────────────────────────────────────

function StartHereCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', flex: 1, minWidth: '180px' }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        padding: '20px',
        height: '100%',
        boxSizing: 'border-box',
      }}>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D', margin: '0 0 6px' }}>
          {title}
        </p>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: '1.55' }}>
          {desc}
        </p>
      </div>
    </Link>
  )
}

function StartHereBanner() {
  return (
    <div style={{
      backgroundColor: '#0A1628',
      borderRadius: '14px',
      padding: '32px',
      marginBottom: '32px',
    }}>
      <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>
        Welcome to your C3 Method Journey
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '0 0 28px', lineHeight: '1.6' }}>
        Complete these sections in order to build your strategic messaging framework
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <StartHereCard
          href="/dashboard/company-profile"
          title="Company Foundation"
          desc="Start with your company profile and buying center"
        />
        <ArrowRight size={20} style={{ color: '#E8520A', flexShrink: 0 }} />
        <StartHereCard
          href="/dashboard/intelligence"
          title="Intelligence"
          desc="Run your Decision Clarity Process survey"
        />
        <ArrowRight size={20} style={{ color: '#E8520A', flexShrink: 0 }} />
        <StartHereCard
          href="/dashboard/journeys/step/1"
          title="Begin Journey"
          desc="Start Step 1 of your C3 Method journey"
        />
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
  const [decayMap, setDecayMap] = useState<Map<string, number | null>>(new Map())

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

        // Parse step definitions
        const parsedSteps: StepDef[] = ((defsRes.data ?? []) as Array<Record<string, unknown>>).map(r => ({
          id: String(r['id'] ?? ''),
          title: String(r['title'] ?? ''),
          description: String(r['description'] ?? ''),
          phase: Number(r['phase'] ?? 0),
        }))
        setSteps(parsedSteps)

        // Build depsMap: step_id → prerequisite_step_ids[]
        const rawDeps = (depsRes.data ?? []) as StepDep[]
        const dm = new Map<string, string[]>()
        for (const dep of rawDeps) {
          const arr = dm.get(dep.step_id) ?? []
          arr.push(dep.prerequisite_step_id)
          dm.set(dep.step_id, arr)
        }
        setDepsMap(dm)

        // Build outputMap: step_id → StepOutputRow (latest version = first since ordered DESC)
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

        // Compute confidence decay for approved/draft steps
        const decayDm = new Map<string, number | null>()
        for (const [sid, row] of om.entries()) {
          if (row.status !== 'approved' && row.status !== 'draft') continue
          const decayed = calculateDecayedConfidence({
            status: row.status,
            original_confidence: row.original_confidence,
            last_reviewed_at: row.last_reviewed_at,
            created_at: row.created_at,
          })
          decayDm.set(sid, decayed)

          // Fire-and-forget decay log when score has changed — non-fatal
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
        setDecayMap(decayDm)

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
      <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  // Group steps by phase, sorted numerically within each phase
  const stepsByPhase = new Map<number, StepDef[]>()
  for (const step of steps) {
    const arr = stepsByPhase.get(step.phase) ?? []
    arr.push(step)
    stepsByPhase.set(step.phase, arr)
  }

  const totalSteps = steps.length
  const totalApproved = steps.filter(s => outputMap.get(s.id)?.status === 'approved').length
  const hasAnyProgress = outputMap.size > 0

  return (
    <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Journeys</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
              Complete all 38 C3 Method steps to build your go-to-market operating system.
            </p>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
            {totalApproved} / {totalSteps} steps approved
          </p>
        </div>
      </header>

      <div style={{ padding: '24px 32px', maxWidth: '900px' }}>

        {/* Empty state — shown only when no steps have been started */}
        {!hasAnyProgress && <StartHereBanner />}

        {/* Step list — shown only when any step has been started */}
        {hasAnyProgress && PHASES.map(({ phase, section }) => {
          const phaseSteps = (stepsByPhase.get(phase) ?? [])
            .sort((a, b) => numericId(a.id) - numericId(b.id))
          if (phaseSteps.length === 0) return null

          const approvedCount = phaseSteps.filter(s => outputMap.get(s.id)?.status === 'approved').length
          const progressPct = (approvedCount / phaseSteps.length) * 100
          const gate = GATES.find(g => g.afterPhase === phase)

          return (
            <div key={phase} style={{ marginBottom: '28px' }}>

              {/* Phase header */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: '#E8520A',
                    textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0,
                  }}>
                    Stage {phase}
                  </span>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D', margin: 0, flex: 1 }}>
                    {section}
                  </h2>
                  <span style={{ fontSize: '12px', color: '#6B7280', flexShrink: 0 }}>
                    {approvedCount} of {phaseSteps.length} approved
                  </span>
                </div>
                <div style={{ height: '4px', backgroundColor: '#E5E7EB', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${progressPct}%`,
                    backgroundColor: progressPct === 100 ? '#16A34A' : '#E8520A',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>

              {/* Step rows */}
              <div style={{
                backgroundColor: '#FFFFFF', borderRadius: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden',
              }}>
                {phaseSteps.map((step, idx) => {
                  const outputRow = outputMap.get(step.id)
                  const status = outputRow?.status ?? 'not_started'
                  const health = getDepHealth(step.id, depsMap, outputMap)
                  const isContinue = step.id === continueStepId
                  const decayedConfidence = decayMap.get(step.id) ?? null

                  return (
                    <button
                      key={step.id}
                      onClick={() => router.push(`/dashboard/journeys/step/${step.id}`)}
                      style={{
                        width: '100%', minHeight: '60px',
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 16px',
                        backgroundColor: isContinue ? 'rgba(232,82,10,0.04)' : 'transparent',
                        border: 'none',
                        borderBottom: idx < phaseSteps.length - 1 ? '1px solid #F3F4F6' : 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <DepHealthIcon health={health} />

                      <span style={{
                        fontSize: '12px', fontWeight: 700, color: '#9CA3AF',
                        minWidth: '28px', flexShrink: 0, textAlign: 'right',
                      }}>
                        {step.id}
                      </span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: '14px', fontWeight: 600, color: '#0D0D0D',
                          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {step.title}
                        </p>
                        {step.description && (
                          <p style={{
                            fontSize: '12px', color: '#6B7280',
                            margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {step.description}
                          </p>
                        )}
                      </div>

                      <StatusBadge status={status} />

                      {/* Confidence decay — only for steps with an output record */}
                      {outputRow !== undefined && decayedConfidence !== null && (
                        <div style={{ width: '170px', flexShrink: 0 }}>
                          <ConfidenceBar score={decayedConfidence} />
                        </div>
                      )}

                      {isContinue && (
                        <span style={{
                          minHeight: '32px', padding: '0 12px',
                          display: 'inline-flex', alignItems: 'center',
                          backgroundColor: '#E8520A', color: '#FFFFFF',
                          borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          Continue
                        </span>
                      )}

                      <ChevronRight size={15} style={{ color: '#D1D5DB', flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>

              {/* Gate banner after this phase */}
              {gate && (
                <GateBanner label={gate.label} state={getGateState(gate.gateStepId, outputMap)} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
