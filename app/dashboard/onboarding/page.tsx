'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Circle, Lock, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckItem {
  badge: string
  title: string
  description: string
  complete: boolean
  isGate?: boolean
}

interface PhaseData {
  number: number
  name: string
  unlockNote: string
  locked: boolean
  items: CheckItem[]
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PHASE_CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  padding: '28px 32px',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckRow({ item }: { item: CheckItem }) {
  const isComplete = item.complete

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
      padding: '14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Badge */}
      <div style={{
        flexShrink: 0,
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        backgroundColor: item.isGate
          ? (isComplete ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.06)')
          : (isComplete ? 'rgba(232,82,10,0.15)' : '#E8520A'),
        border: item.isGate
          ? (isComplete ? '1px solid rgba(14,165,233,0.4)' : '1px solid rgba(255,255,255,0.1)')
          : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {item.isGate ? (
          <ShieldCheck
            size={16}
            style={{ color: isComplete ? '#0EA5E9' : 'rgba(255,255,255,0.35)' }}
          />
        ) : (
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: isComplete ? 'rgba(255,255,255,0.5)' : '#FFFFFF',
            letterSpacing: '-0.02em',
          }}>
            {item.badge}
          </span>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
        <p style={{
          fontSize: '14px',
          fontWeight: 600,
          color: isComplete ? 'rgba(255,255,255,0.5)' : '#FFFFFF',
          margin: '0 0 3px',
          textDecoration: isComplete ? 'line-through' : 'none',
        }}>
          {item.title}
        </p>
        <p style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.35)',
          margin: 0,
          lineHeight: 1.5,
        }}>
          {item.description}
        </p>
      </div>

      {/* Status icon */}
      <div style={{ flexShrink: 0, paddingTop: '2px' }}>
        {isComplete ? (
          <CheckCircle2 size={20} style={{ color: '#0EA5E9' }} />
        ) : (
          <Circle size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
        )}
      </div>
    </div>
  )
}

function PhaseCard({ phase }: { phase: PhaseData }) {
  const allComplete = phase.items.every(i => i.complete)

  return (
    <div style={{ ...PHASE_CARD, position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              backgroundColor: phase.locked
                ? 'rgba(255,255,255,0.08)'
                : (allComplete ? 'rgba(22,163,74,0.2)' : 'rgba(232,82,10,0.15)'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {phase.locked ? (
                <Lock size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
              ) : allComplete ? (
                <CheckCircle2 size={13} style={{ color: '#16A34A' }} />
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#E8520A' }}>
                  {phase.number}
                </span>
              )}
            </div>
            <h3 style={{
              fontSize: '15px',
              fontWeight: 700,
              color: phase.locked ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
              margin: 0,
            }}>
              Phase {phase.number} — {phase.name}
            </h3>
          </div>
          <p style={{
            fontSize: '12px',
            color: phase.locked ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)',
            margin: 0,
          }}>
            {phase.unlockNote}
          </p>
        </div>

        {phase.locked && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '4px 10px',
            flexShrink: 0,
          }}>
            <Lock size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              Locked
            </span>
          </div>
        )}

        {allComplete && !phase.locked && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(22,163,74,0.15)',
            border: '1px solid rgba(22,163,74,0.3)',
            borderRadius: '20px',
            padding: '4px 10px',
            flexShrink: 0,
          }}>
            <CheckCircle2 size={11} style={{ color: '#16A34A' }} />
            <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
              Complete
            </span>
          </div>
        )}
      </div>

      {/* Items */}
      <div style={{ opacity: phase.locked ? 0.35 : 1, pointerEvents: phase.locked ? 'none' : 'auto' }}>
        {phase.items.map((item, i) => (
          <CheckRow key={i} item={item} />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [phases, setPhases] = useState<PhaseData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users').select('org_id').eq('id', user.id).single()
        if (!userRow) return
        const orgId = (userRow as Record<string, unknown>)['org_id'] as string

        const [outputsRes, defsRes, surveyRes, dcpRes] = await Promise.all([
          supabase.from('step_output').select('step_id,status').eq('workspace_id', orgId),
          supabase.from('step_definition').select('id,section'),
          supabase.from('workspace_survey').select('id').eq('org_id', orgId).maybeSingle(),
          supabase.from('dcp_analysis').select('status').eq('org_id', orgId).maybeSingle(),
        ])

        const outputs = (outputsRes.data ?? []) as { step_id: string; status: string }[]
        const defs = (defsRes.data ?? []) as { id: string; section: string }[]

        // Latest status per step (keep most recent output entry)
        const outputMap = new Map<string, string>()
        for (const o of outputs) {
          outputMap.set(o.step_id, o.status)
        }

        const approvedSet = new Set(
          outputs.filter(o => o.status === 'approved').map(o => o.step_id)
        )

        const endemicIds = defs
          .filter(d => d.section === 'Endemic Problems')
          .map(d => d.id)

        const hasSurvey = surveyRes.data !== null
        const dcpStatus = (dcpRes.data as { status?: string } | null)?.status ?? ''

        // ── Phase 1: Decision Intelligence ──────────────────────────────────

        const p1gate1 = dcpStatus === 'approved'
        const phase1: PhaseData = {
          number: 1,
          name: 'Decision Intelligence',
          unlockNote: 'Complete this phase to unlock everything else',
          locked: false,
          items: [
            {
              badge: '1',
              title: 'Complete your Company Profile',
              description: 'Set up your workspace with your product, market segments, and decision makers',
              complete: ['1', '2', '3'].every(id => outputMap.has(id)),
            },
            {
              badge: '2',
              title: 'Define your Product or Service',
              description: 'Describe what you sell, your primary use case, and key industries served',
              complete: outputMap.has('1'),
            },
            {
              badge: '3',
              title: 'Build your Decision Clarity Process Survey',
              description: 'Select questions that reveal how your buyers make decisions',
              complete: hasSurvey,
            },
            {
              badge: '4',
              title: 'Identify your Three Endemic Problems',
              description: 'Document the core pain points that drive your buyers to seek solutions',
              complete: endemicIds.some(id => outputMap.has(id)),
            },
            {
              badge: 'G1',
              title: 'Gate 1: Submit DCP Map for approval',
              description: 'Submit your Decision Clarity Profile to unlock Phase 2',
              complete: p1gate1,
              isGate: true,
            },
          ],
        }

        // ── Phase 2: Company Formulas ────────────────────────────────────────

        const GATE2_STEPS = ['10', '11', '12', '13', '14', '15', '16']
        const p2gate2 = GATE2_STEPS.every(id => approvedSet.has(id))
        const phase2: PhaseData = {
          number: 2,
          name: 'Company Formulas',
          unlockNote: 'Unlocks after Gate 1 — Decision Clarity Profile approved',
          locked: !p1gate1,
          items: [
            {
              badge: '5–10',
              title: 'Define your ICP, Offers, and Buying Center',
              description: 'Identify your ideal customer profiles, align your offers, and map buying roles',
              complete: ['5', '6', '7', '8', '9', '10'].some(id => outputMap.has(id)),
            },
            {
              badge: '11–16',
              title: 'Build CVPs, KSPs, and Key Formulas',
              description: 'Develop your core value propositions, key selling points, and critical success formulas',
              complete: ['11', '12', '13', '14', '15', '16'].some(id => outputMap.has(id)),
            },
            {
              badge: 'G2',
              title: 'Gate 2: Submit Company Formulas for approval',
              description: 'Approve your Company Formulas to unlock Phase 3',
              complete: p2gate2,
              isGate: true,
            },
          ],
        }

        // ── Phase 3: Competitive and Strategic ──────────────────────────────

        const phase3: PhaseData = {
          number: 3,
          name: 'Competitive & Strategic',
          unlockNote: 'Unlocks after Gate 2 — Company Formulas approved',
          locked: !p2gate2,
          items: [
            {
              badge: '17–26',
              title: 'Competitive analysis and strategic messages',
              description: 'Map competitive environments, identify opportunities, and build your strategic messaging',
              complete: ['17', '18', '19', '20', '21', '22', '23', '24', '25', '26'].some(
                id => outputMap.has(id)
              ),
            },
            {
              badge: '27–38',
              title: 'Strategic Plan and final approvals',
              description: 'Build your message blend, action plan, and deal scorecard',
              complete: ['27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38'].some(
                id => outputMap.has(id)
              ),
            },
            {
              badge: 'G3–4',
              title: 'Gate 3 and 4: Final approvals',
              description: 'Approve Strategic Messages and Strategic Plan to complete your C3 Method',
              complete: approvedSet.has('30') && approvedSet.has('38'),
              isGate: true,
            },
          ],
        }

        setPhases([phase1, phase2, phase3])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // ── Skeleton ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A1628', padding: '48px 32px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[5, 3, 3].map((rows, i) => (
            <div key={i} style={PHASE_CARD}>
              {Array.from({ length: rows + 1 }).map((_, j) => (
                <div key={j} style={{
                  height: '14px', borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  marginBottom: '16px',
                  width: j === 0 ? '40%' : `${55 + (j * 9) % 35}%`,
                }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const allPhasesComplete = phases.every(p => p.items.every(i => i.complete))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1628', padding: '48px 32px 64px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Logo */}
        <div style={{ marginBottom: '40px' }}>
          <Image
            src="/images/logo.png"
            alt="Assembly AI"
            width={160}
            height={40}
            style={{ maxHeight: '40px', width: 'auto' }}
            priority
          />
        </div>

        {/* Headline */}
        <div style={{ marginBottom: '48px' }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: '0 0 12px',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}>
            Welcome to Assembly AI
          </h1>
          <p style={{
            fontSize: '17px',
            color: 'rgba(255,255,255,0.55)',
            margin: 0,
            lineHeight: 1.6,
          }}>
            Let&apos;s build your go-to-market strategy, step by step.
          </p>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
          {allPhasesComplete ? (
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '52px',
                padding: '0 32px',
                borderRadius: '10px',
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 700,
              }}
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/dashboard/journeys/step/1"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '52px',
                padding: '0 32px',
                borderRadius: '10px',
                backgroundColor: '#E8520A',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 700,
              }}
            >
              Start with Step 1
            </Link>
          )}
          <Link
            href="/dashboard"
            style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.35)',
              textDecoration: 'none',
            }}
          >
            Skip to dashboard
          </Link>
        </div>

        {/* Phase cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
          {phases.map(phase => (
            <PhaseCard key={phase.number} phase={phase} />
          ))}
        </div>
      </div>
    </div>
  )
}
