'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, Play, ExternalLink, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = 'not_started' | 'draft' | 'approved'
type ApprovalState = 'idle' | 'approving' | 'success' | 'error'

interface Phase1Step {
  badge: string
  title: string
  description: string
  href: string
  stepStatus: StepStatus
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  padding: '28px 32px',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Phase1Row({ step }: { step: Phase1Step }) {
  const isApproved = step.stepStatus === 'approved'
  const isDraft = step.stepStatus === 'draft'

  return (
    <Link href={step.href} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        padding: '14px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
      }}>
        {/* Badge */}
        <div style={{
          flexShrink: 0,
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: isApproved ? 'rgba(232,82,10,0.15)' : '#E8520A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: isApproved ? 'rgba(255,255,255,0.5)' : '#FFFFFF',
            letterSpacing: '-0.02em',
          }}>
            {step.badge}
          </span>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
          <p style={{
            fontSize: '14px',
            fontWeight: 600,
            color: isApproved ? 'rgba(255,255,255,0.5)' : '#FFFFFF',
            margin: '0 0 3px',
            textDecoration: isApproved ? 'line-through' : 'none',
          }}>
            {step.title}
          </p>
          <p style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.35)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            {step.description}
          </p>
        </div>

        {/* Status circle: grey = not started, orange = draft, green = approved */}
        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
          {isApproved ? (
            <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
          ) : isDraft ? (
            <Circle size={20} style={{ color: '#E8520A' }} />
          ) : (
            <Circle size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
          )}
        </div>
      </div>
    </Link>
  )
}

function AdminCheckRow({
  label,
  href,
  checked,
  onChange,
}: {
  label: string
  href?: string
  checked?: boolean
  onChange?: () => void
}) {
  const checkboxEl = (
    <span
      onClick={onChange ? e => { e.preventDefault(); e.stopPropagation(); onChange() } : undefined}
      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', cursor: onChange ? 'pointer' : 'default' }}
    >
      {checked ? (
        <CheckCircle2 size={18} style={{ color: '#16A34A' }} />
      ) : (
        <div style={{
          width: '18px',
          height: '18px',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.2)',
        }} />
      )}
    </span>
  )

  const inner = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {checkboxEl}
      <span style={{
        fontSize: '14px',
        color: checked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)',
        flex: 1,
        textDecoration: checked ? 'line-through' : 'none',
      }}>
        {label}
      </span>
      {href && (
        <ExternalLink size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
      )}
    </div>
  )

  if (href) return <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link>
  return inner
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [phase1Steps, setPhase1Steps] = useState<Phase1Step[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [approvalState, setApprovalState] = useState<ApprovalState>('idle')
  const [hasWebsite, setHasWebsite] = useState(false)
  const [adminChecks, setAdminChecks] = useState({
    teamInvited: false,
    modelSet: false,
    notificationsSet: false,
  })

  useEffect(() => {
    setAdminChecks({
      teamInvited: localStorage.getItem('onboarding_teamInvited') === 'true',
      modelSet: localStorage.getItem('onboarding_modelSet') === 'true',
      notificationsSet: localStorage.getItem('onboarding_notificationsSet') === 'true',
    })

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users').select('org_id').eq('id', user.id).single()
        if (!userRow) return
        const wsId = (userRow as Record<string, unknown>)['org_id'] as string
        setOrgId(wsId)

        const [outputsRes, orgRes] = await Promise.all([
          supabase
            .from('step_output')
            .select('step_id,status')
            .eq('workspace_id', wsId)
            .in('step_id', ['1', '2', '3', '3.5']),
          supabase
            .from('organizations')
            .select('website')
            .eq('id', wsId)
            .single(),
        ])

        if (orgRes.data) {
          const website = String((orgRes.data as Record<string, unknown>)['website'] ?? '')
          setHasWebsite(website.trim().length > 0)
        }

        const outputs = (outputsRes.data ?? []) as { step_id: string; status: string }[]
        const outputMap = new Map(outputs.map(o => [o.step_id, o.status]))

        const getStatus = (id: string): StepStatus => {
          if (!outputMap.has(id)) return 'not_started'
          return outputMap.get(id) === 'approved' ? 'approved' : 'draft'
        }

        setPhase1Steps([
          {
            badge: '1',
            title: 'Step 1 — Product / Service Profile',
            description: 'Describe what you sell, your primary use case, and key industries served',
            href: '/dashboard/journeys/step/1',
            stepStatus: getStatus('1'),
          },
          {
            badge: '2',
            title: 'Step 2 — Top 3 Target Market Segments',
            description: 'Name and describe the three segments you sell into most effectively',
            href: '/dashboard/journeys/step/2',
            stepStatus: getStatus('2'),
          },
          {
            badge: '3',
            title: 'Step 3 — Key Decision Makers',
            description: 'Map the buying roles, influence levels, and primary concerns per segment',
            href: '/dashboard/journeys/step/3',
            stepStatus: getStatus('3'),
          },
          {
            badge: '3.5',
            title: 'Step 3.5 — The Yes Criteria',
            description: 'Identify the ultimate decision maker and what will make them say yes',
            href: '/dashboard/journeys/step/3.5',
            stepStatus: getStatus('3.5'),
          },
        ])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  async function approvePhase1() {
    if (!orgId) return
    setApprovalState('approving')
    try {
      for (const stepId of ['1', '2', '3', '3.5']) {
        const { error } = await supabase
          .from('step_output')
          .update({ status: 'approved' })
          .eq('workspace_id', orgId)
          .eq('step_id', stepId)
        if (error) throw error
      }
      setPhase1Steps(prev => prev.map(s => ({ ...s, stepStatus: 'approved' as StepStatus })))
      setApprovalState('success')
    } catch {
      setApprovalState('error')
    }
  }

  function toggleAdminCheck(key: keyof typeof adminChecks) {
    setAdminChecks(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(`onboarding_${key}`, String(next[key]))
      return next
    })
  }

  // ── Skeleton ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A1628', padding: '48px 32px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[4, 4].map((rows, i) => (
            <div key={i} style={CARD}>
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

  // ── Derived state ─────────────────────────────────────────────────────────────

  const allPhase1Complete = phase1Steps.every(s => s.stepStatus === 'approved')
  const allPhase1HaveContent = phase1Steps.length === 4 && phase1Steps.every(s => s.stepStatus !== 'not_started')
  const showSuccessState = allPhase1Complete || approvalState === 'success'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1628', padding: '48px 32px 64px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Headline */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: '0 0 10px',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}>
            Welcome to Assembly AI
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.55)',
            margin: 0,
            lineHeight: 1.6,
          }}>
            Let&apos;s build your go-to-market strategy, step by step.
          </p>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          {allPhase1Complete ? (
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
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Section 1 — Intro Video Placeholder */}
          <div style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '56.25%',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#0A1628',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '24px',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#E8520A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Play size={28} fill="#FFFFFF" style={{ color: '#FFFFFF', marginLeft: '3px' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  margin: '0 0 8px',
                }}>
                  Watch: Getting Started with Assembly AI
                </p>
                <p style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.45)',
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  Learn how to complete your setup and get the most out of the C3 Method. Video coming soon.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2 — Phase 1 Checklist */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h2 style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#FFFFFF',
                margin: 0,
              }}>
                Phase 1 — Company Foundation
              </h2>
              {allPhase1Complete && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(22,163,74,0.15)',
                  border: '1px solid rgba(22,163,74,0.3)',
                  borderRadius: '20px',
                  padding: '4px 10px',
                }}>
                  <CheckCircle2 size={11} style={{ color: '#16A34A' }} />
                  <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>Complete</span>
                </div>
              )}
            </div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Complete these four steps to establish your company foundation before building your strategy.
            </p>
            {phase1Steps.map((step, i) => (
              <Phase1Row key={i} step={step} />
            ))}
          </div>

          {/* Phase 1 Approval Button / Success State */}
          {showSuccessState ? (
            <div style={{
              width: '100%',
              minHeight: '60px',
              borderRadius: '10px',
              border: '1px solid rgba(22,163,74,0.3)',
              backgroundColor: 'rgba(22,163,74,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '16px 24px',
              boxSizing: 'border-box',
              flexWrap: 'wrap',
            }}>
              <CheckCircle2 size={22} style={{ color: '#16A34A', flexShrink: 0 }} />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#16A34A' }}>
                Phase 1 Complete
              </span>
              <Link
                href="/dashboard/intelligence"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: '44px',
                  padding: '0 20px',
                  borderRadius: '8px',
                  backgroundColor: '#E8520A',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Go to Intelligence
              </Link>
            </div>
          ) : (
            <>
              <button
                onClick={allPhase1HaveContent && approvalState !== 'approving' ? approvePhase1 : undefined}
                disabled={!allPhase1HaveContent || approvalState === 'approving'}
                title={!allPhase1HaveContent ? 'Complete all steps before approving Phase 1' : undefined}
                style={{
                  width: '100%',
                  minHeight: '54px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: allPhase1HaveContent ? '#E8520A' : 'rgba(255,255,255,0.1)',
                  color: allPhase1HaveContent ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: allPhase1HaveContent && approvalState !== 'approving' ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}
              >
                {approvalState === 'approving' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Approving Phase 1…
                  </>
                ) : (
                  'Complete Phase 1'
                )}
              </button>
              {approvalState === 'error' && (
                <p style={{ fontSize: '13px', color: '#FCA5A5', margin: '-8px 0 0' }}>
                  Something went wrong. Please try again.
                </p>
              )}
            </>
          )}

          {/* Section 3 — Workspace Setup */}
          <div style={CARD}>
            <h2 style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#FFFFFF',
              margin: '0 0 4px',
            }}>
              Workspace Setup
            </h2>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Configure your workspace before getting started.
            </p>
            <AdminCheckRow
              label="Company name and website added"
              href="/dashboard/administration"
              checked={hasWebsite}
            />
            <AdminCheckRow
              label="Team members invited"
              href="/dashboard/administration"
              checked={adminChecks.teamInvited}
              onChange={() => toggleAdminCheck('teamInvited')}
            />
            <AdminCheckRow
              label="AI model preferences set"
              href="/dashboard/administration"
              checked={adminChecks.modelSet}
              onChange={() => toggleAdminCheck('modelSet')}
            />
            <AdminCheckRow
              label="Notification preferences configured"
              checked={adminChecks.notificationsSet}
              onChange={() => toggleAdminCheck('notificationsSet')}
            />
          </div>

          {/* Section 4 — Intelligence Callout */}
          <div style={{
            borderLeft: '4px solid #E8520A',
            backgroundColor: '#0F2140',
            borderRadius: '0 12px 12px 0',
            padding: '20px 24px',
            border: '1px solid rgba(255,255,255,0.1)',
            borderLeftColor: '#E8520A',
            borderLeftWidth: '4px',
          }}>
            <p style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#E8520A',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              margin: '0 0 8px',
            }}>
              Before You Begin Phase 2
            </p>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.75)',
              lineHeight: '1.6',
              margin: '0 0 16px',
            }}>
              Intelligence Gathering is a critical step between Phase 1 and Phase 2. Before building your Company Formulas, you must complete the Decision Clarity Process — a structured survey that reveals exactly how your buyers make decisions. Gate 1 approval requires a completed DCP Map.
            </p>
            <Link
              href="/dashboard/intelligence"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '8px',
                backgroundColor: '#E8520A',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go to Intelligence
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
