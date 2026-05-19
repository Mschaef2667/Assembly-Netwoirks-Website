'use client'

import { useState, useEffect } from 'react'
import { Lock, CheckCircle, Clock, Activity } from 'lucide-react'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1628' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Workspace Dashboard</h1>
      </header>

      <div style={{ padding: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>

          {/* TTFAJ Tracker */}
          <div style={WIDGET}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Clock size={18} style={{ color: '#0EA5E9' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)' }}>
                TTFAJ Tracker
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }}>Time to Activation</p>
            <div style={{ fontFamily: 'monospace', fontSize: '36px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.05em' }}>
              {formatDuration(elapsed)}
            </div>
            <div style={{
              marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '4px 12px', borderRadius: '999px',
              backgroundColor: 'rgba(232,82,10,0.2)', color: '#E8520A',
              fontSize: '13px', fontWeight: 600,
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#E8520A' }} />
              Onboarding in Progress
            </div>
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
