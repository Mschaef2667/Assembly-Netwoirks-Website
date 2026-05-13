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
      <circle cx="30" cy="30" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="4" />
      <circle
        cx="30"
        cy="30"
        r={radius}
        fill="none"
        stroke="#E8520A"
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
      />
      <text x="30" y="35" textAnchor="middle" fontSize="12" fill="#0D0D0D" fontWeight="600">
        {percent}%
      </text>
    </svg>
  )
}

const GATES = [1, 2, 3, 4, 5] as const
const PHASES = ['Phase 1', 'Phase 2', 'Phase 3'] as const

export default function DashboardPage() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F6F1' }}>
      {/* Page header */}
      <header className="px-8 py-6" style={{ backgroundColor: '#0A1628', paddingTop: '24px' }}>
        <h1 className="text-white text-2xl font-semibold">Workspace Dashboard</h1>
      </header>

      <div className="p-8">
        {/* Widget grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* TTFAJ Tracker */}
          <div
            className="rounded-xl p-6 bg-white"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} style={{ color: '#6B7280' }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                TTFAJ Tracker
              </h2>
            </div>
            <p className="text-sm mb-3" style={{ color: '#6B7280' }}>Time to Activation</p>
            <div className="font-mono text-4xl font-bold" style={{ color: '#0D0D0D' }}>
              {formatDuration(elapsed)}
            </div>
            <div
              className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: '#FEF3EE', color: '#E8520A' }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#E8520A' }} />
              Onboarding in Progress
            </div>
          </div>

          {/* Gate Status */}
          <div
            className="rounded-xl p-6 bg-white"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Lock size={18} style={{ color: '#6B7280' }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                Gate Status
              </h2>
            </div>
            <ul className="space-y-3">
              {GATES.map(gate => (
                <li key={gate} className="flex items-center gap-3" style={{ minHeight: '44px' }}>
                  <div
                    className="flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: '#F3F4F6',
                    }}
                  >
                    <Lock size={14} style={{ color: '#6B7280' }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium" style={{ color: '#0D0D0D' }}>
                      Gate {gate}
                    </span>
                    <span className="ml-2 text-xs" style={{ color: '#6B7280' }}>
                      Locked
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Step Completion */}
          <div
            className="rounded-xl p-6 bg-white"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} style={{ color: '#6B7280' }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                Step Completion
              </h2>
            </div>
            <div className="flex items-center justify-around py-4">
              {PHASES.map(phase => (
                <div key={phase} className="flex flex-col items-center gap-3">
                  <ProgressRing percent={0} />
                  <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
                    {phase}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dependency Health */}
          <div
            className="rounded-xl p-6 bg-white"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={18} style={{ color: '#6B7280' }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                Dependency Health
              </h2>
            </div>
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <CheckCircle size={40} color="#22C55E" />
              <p className="text-sm font-semibold" style={{ color: '#0D0D0D' }}>No flags</p>
              <p className="text-xs text-center" style={{ color: '#6B7280' }}>
                All dependencies healthy. No upstream changes detected.
              </p>
            </div>
          </div>

          {/* Copilot Activity — full width */}
          <div
            className="col-span-2 rounded-xl p-6 bg-white"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} style={{ color: '#6B7280' }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                Copilot Activity
              </h2>
            </div>
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: '48px', height: '48px', backgroundColor: '#F3F4F6' }}
              >
                <Activity size={22} style={{ color: '#6B7280' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: '#0D0D0D' }}>
                No Copilot runs yet
              </p>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                Copilot activity will appear here after your first run.
              </p>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mt-8 flex justify-center">
          <button
            className="rounded-lg text-white font-semibold text-base transition-opacity hover:opacity-90"
            style={{
              backgroundColor: '#E8520A',
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 2rem',
            }}
          >
            Start Phase 1
          </button>
        </div>
      </div>
    </div>
  )
}
