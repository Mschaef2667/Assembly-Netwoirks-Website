'use client'

import { useState, useEffect } from 'react'
import { Lock, CheckCircle, Activity, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface JourneyStats {
  startDate: Date | null
  daysActive: number
  stepsWorkedOn: number
  pacePerWeek: number | null
  projectedCompletion: Date | null
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" aria-label={`${percent}% complete`}>
      <circle cx="30" cy="30" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <circle
        cx="30" cy="30" r={radius} fill="none"
        stroke="#E8520A" strokeWidth="4"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 30 30)"
      />
      <text x="30" y="35" textAnchor="middle" fontSize="12" fill="#FFFFFF" fontWeight="600">
        {percent}%
      </text>
    </svg>
  )
}

const GATES = [1, 2, 3, 4] as const
const PHASES = ['Phase 1', 'Phase 2', 'Phase 3'] as const

const WIDGET: React.CSSProperties = {
  borderRadius: '12px',
  padding: '24px',
  backgroundColor: '#0F2140',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  borderRight: '1px solid rgba(255,255,255,0.1)',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  borderLeft: '3px solid #0EA5E9',
}

export default function DashboardPage() {
  const [journeyStats, setJourneyStats] = useState<JourneyStats | null>(null)

  useEffect(() => {
    async function loadJourney() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: userRow } = await supabase
          .from('users').select('org_id').eq('id', user.id).single()
        if (!userRow) return
        const orgId = (userRow as Record<string, unknown>)['org_id'] as string

        const { data: rows } = await supabase
          .from('step_output')
          .select('step_id, created_at')
          .eq('workspace_id', orgId)
          .order('created_at', { ascending: true })

        if (!rows || rows.length === 0) {
          setJourneyStats({ startDate: null, daysActive: 0, stepsWorkedOn: 0, pacePerWeek: null, projectedCompletion: null })
          return
        }

        const typed = rows as Array<{ step_id: string; created_at: string }>
        const stepIds = new Set(typed.map(r => r.step_id))
        const stepsWorkedOn = stepIds.size
        const startDate = new Date(typed[0].created_at)
        const now = new Date()
        const daysActive = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / 86_400_000))
        const weeksActive = daysActive / 7
        const pacePerWeek = stepsWorkedOn / weeksActive
        const stepsRemaining = 38 - stepsWorkedOn
        let projectedCompletion: Date | null = null
        if (stepsRemaining <= 0) {
          projectedCompletion = now
        } else if (pacePerWeek > 0) {
          projectedCompletion = new Date(now.getTime() + (stepsRemaining / pacePerWeek) * 7 * 86_400_000)
        }
        setJourneyStats({ startDate, daysActive, stepsWorkedOn, pacePerWeek, projectedCompletion })
      } catch {
        // non-fatal
      }
    }
    void loadJourney()
  }, [])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1628' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Workspace Dashboard</h1>
      </header>

      <div style={{ padding: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>

          {/* Journey Overview */}
          <div style={WIDGET}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <TrendingUp size={18} style={{ color: '#0EA5E9' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)' }}>
                Journey Overview
              </span>
            </div>
            {!journeyStats || journeyStats.startDate === null ? (
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', margin: 0, paddingTop: '8px' }}>
                Start your journey to see progress
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Started</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                    {fmtDate(journeyStats.startDate)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Days active</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                    {journeyStats.daysActive}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Steps completed</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                    {journeyStats.stepsWorkedOn} / 38
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Current pace</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0EA5E9' }}>
                    {journeyStats.pacePerWeek !== null
                      ? `${journeyStats.pacePerWeek.toFixed(1)} steps / week`
                      : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Projected completion</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: journeyStats.stepsWorkedOn >= 38 ? '#16A34A' : '#FFFFFF' }}>
                    {journeyStats.stepsWorkedOn >= 38
                      ? 'Complete!'
                      : journeyStats.projectedCompletion
                        ? fmtDate(journeyStats.projectedCompletion)
                        : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Gate Status */}
          <div style={WIDGET}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Lock size={18} style={{ color: '#0EA5E9' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)' }}>
                Gate Status
              </span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {GATES.map(gate => (
                <li key={gate} style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Lock size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Gate {gate}</span>
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Locked</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Step Completion */}
          <div style={WIDGET}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Activity size={18} style={{ color: '#0EA5E9' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)' }}>
                Step Completion
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '16px 0' }}>
              {PHASES.map(phase => (
                <div key={phase} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <ProgressRing percent={0} />
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>{phase}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dependency Health */}
          <div style={WIDGET}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CheckCircle size={18} style={{ color: '#0EA5E9' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)' }}>
                Dependency Health
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: '12px' }}>
              <CheckCircle size={40} color="#22C55E" />
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>No flags</p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: 0 }}>
                All dependencies healthy. No upstream changes detected.
              </p>
            </div>
          </div>

          {/* Copilot Activity — full width */}
          <div style={{ ...WIDGET, gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Activity size={18} style={{ color: '#0EA5E9' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)' }}>
                Copilot Activity
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: '12px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={22} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>No Copilot runs yet</p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                Copilot activity will appear here after your first run.
              </p>
            </div>
          </div>

        </div>

        {/* Primary CTA */}
        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
          <button style={{
            backgroundColor: '#E8520A', color: '#FFFFFF',
            border: 'none', borderRadius: '8px',
            fontSize: '15px', fontWeight: 600,
            minHeight: '44px', minWidth: '44px', padding: '0 32px',
            cursor: 'pointer',
          }}>
            Start Phase 1
          </button>
        </div>
      </div>
    </div>
  )
}
