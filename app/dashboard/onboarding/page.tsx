'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, Play, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = 'not_started' | 'draft' | 'approved'

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
    <Link
      href={step.href}
      style={{ textDecoration: 'none' }}
    >
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

        {/* Status icon */}
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

function AdminCheckRow({ label, href }: { label: string; href?: string }) {
  const content = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{
        width: '18px',
        height: '18px',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.2)',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: '14px',
        color: 'rgba(255,255,255,0.7)',
        flex: 1,
      }}>
        {label}
      </span>
      {href && (
        <ExternalLink size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none' }}>
        {content}
      </Link>
    )
  }
  return content
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [phase1Steps, setPhase1Steps] = useState<Phase1Step[]>([])
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

        const { data: outputsData } = await supabase
          .from('step_output')
          .select('step_id,status')
          .eq('workspace_id', orgId)
          .in('step_id', ['1', '2', '3', '3.5'])

        const outputs = (outputsData ?? []) as { step_id: string; status: string }[]
        const outputMap = new Map(outputs.map(o => [o.step_id, o.status]))

        const getStepStatus = (id: string): StepStatus => {
          if (!outputMap.has(id)) return 'not_started'
          return outputMap.get(id) === 'approved' ? 'approved' : 'draft'
        }

        setPhase1Steps([
          {
            badge: '1',
            title: 'Step 1 — Product / Service Profile',
            description: 'Describe what you sell, your primary use case, and key industries served',
            href: '/dashboard/journeys/step/1',
            stepStatus: getStepStatus('1'),
          },
          {
            badge: '2',
            title: 'Step 2 — Top 3 Target Market Segments',
            description: 'Name and describe the three segments you sell into most effectively',
            href: '/dashboard/journeys/step/2',
            stepStatus: getStepStatus('2'),
          },
          {
            badge: '3',
            title: 'Step 3 — Key Decision Makers',
            description: 'Map the buying roles, influence levels, and primary concerns per segment',
            href: '/dashboard/journeys/step/3',
            stepStatus: getStepStatus('3'),
          },
          {
            badge: '3.5',
            title: 'Step 3.5 — The Yes Criteria',
            description: 'Identify the ultimate decision maker and what will make them say yes',
            href: '/dashboard/journeys/step/3.5',
            stepStatus: getStepStatus('3.5'),
          },
        ])
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

  // ── Render ────────────────────────────────────────────────────────────────────

  const allPhase1Complete = phase1Steps.every(s => s.stepStatus === 'approved')

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

          {/* Section 3 — Administration Setup Checklist */}
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
            />
            <AdminCheckRow label="Team members invited" href="/dashboard/administration" />
            <AdminCheckRow label="AI model preferences set" href="/dashboard/administration" />
            <AdminCheckRow label="Notification preferences configured" />
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
