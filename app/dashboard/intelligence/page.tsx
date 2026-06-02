'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ClipboardList, Upload, Map, CheckCircle2, Circle, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type GateStatus = 'locked' | 'pending' | 'approved'

interface PhaseStatus {
  surveyBuilt: boolean
  surveyInProgress: boolean
  responsesImported: boolean
  dcpMapGenerated: boolean
  dcpMapInProgress: boolean
  gate1Status: GateStatus
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

// ── Gate badge ────────────────────────────────────────────────────────────────

function GateBadge({ status }: { status: GateStatus }) {
  if (status === 'approved') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '999px',
      backgroundColor: '#DCFCE7', color: '#16A34A', fontSize: '13px', fontWeight: 700,
    }}>
      <CheckCircle2 size={14} /> Gate 1 Approved
    </span>
  )
  if (status === 'pending') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '999px',
      backgroundColor: '#FEF3C7', color: '#D97706', fontSize: '13px', fontWeight: 700,
    }}>
      <Circle size={14} /> Gate 1 Pending Approval
    </span>
  )
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '999px',
      backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 700,
    }}>
      <Lock size={14} /> Gate 1 Locked
    </span>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDot({ done, inProgress = false }: { done: boolean; inProgress?: boolean }) {
  const bg = done ? '#16A34A' : inProgress ? '#E8520A' : 'rgba(255,255,255,0.15)'
  return (
    <div style={{
      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
      backgroundColor: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {done && <CheckCircle2 size={12} color="#FFFFFF" />}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasMeaningfulSurveyContent(content: Record<string, unknown>): boolean {
  const questions = content['questions']
  if (Array.isArray(questions) && questions.length > 0) return true
  // Handle survey builder's Record<number, Question[]> stored as object
  if (questions && typeof questions === 'object' && !Array.isArray(questions)) {
    const vals = Object.values(questions as Record<string, unknown>)
    if (vals.some(v => Array.isArray(v) && (v as unknown[]).length > 0)) return true
  }
  for (let i = 1; i <= 7; i++) {
    const stage = content[`stage_${i}`]
    if (Array.isArray(stage) && stage.length > 0) return true
  }
  return false
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [status, setStatus] = useState<PhaseStatus>({
    surveyBuilt: false,
    surveyInProgress: false,
    responsesImported: false,
    dcpMapGenerated: false,
    dcpMapInProgress: false,
    gate1Status: 'locked',
  })
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

        const [surveyRes, responsesRes, dcpRes] = await Promise.all([
          supabase.from('step_output').select('id, content, status').eq('workspace_id', orgId).like('step_id', 'survey-builder%').limit(1),
          supabase.from('dcp_imports').select('id').eq('org_id', orgId).limit(1),
          supabase.from('dcp_analysis').select('status').eq('org_id', orgId).maybeSingle(),
        ])

        const dcpRow = dcpRes.data as Record<string, unknown> | null
        const dcpStatus = dcpRow ? String(dcpRow['status'] ?? 'draft') : null

        const surveyRow = surveyRes.data && surveyRes.data.length > 0
          ? (surveyRes.data[0] as Record<string, unknown>)
          : null
        const surveyContent = surveyRow ? (surveyRow['content'] as Record<string, unknown> | null) : null
        const surveyRowStatus = surveyRow ? String(surveyRow['status'] ?? 'draft') : null
        const surveyBuilt = surveyRowStatus === 'approved'
        const surveyInProgress = !surveyBuilt && !!(surveyContent && hasMeaningfulSurveyContent(surveyContent))

        setStatus({
          surveyBuilt,
          surveyInProgress,
          responsesImported: !!(responsesRes.data && responsesRes.data.length > 0),
          dcpMapGenerated: dcpStatus === 'approved',
          dcpMapInProgress: dcpStatus === 'draft' || dcpStatus === 'pending_approval',
          gate1Status: dcpStatus === 'approved' ? 'approved'
            : dcpStatus === 'pending_approval' ? 'pending'
            : 'locked',
        })
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const cards = [
    {
      icon: ClipboardList,
      title: 'Survey Builder',
      description: 'Generate tailored DCP questions for four buyer audiences using Copilot. Export as Google Forms-ready CSV.',
      href: '/dashboard/intelligence/survey-builder',
      done: status.surveyBuilt,
      inProgress: status.surveyInProgress,
      step: 1,
      domId: 'intelligence-survey',
    },
    {
      icon: Upload,
      title: 'Response Manager',
      description: 'Collect responses via shareable survey links, manual entry, or CSV upload. View and manage all responses before generating your DCP Map.',
      href: '/dashboard/intelligence/responses',
      done: status.responsesImported,
      inProgress: false,
      step: 2,
      domId: undefined,
    },
    {
      icon: Map,
      title: 'Decision Clarity Profile',
      description: 'Copilot analyzes responses across all 7 stages and generates your Decision Clarity Profile. Submit for Gate 1 approval to unlock Phase 2.',
      href: '/dashboard/intelligence/dcp-map',
      done: status.dcpMapGenerated,
      inProgress: status.dcpMapInProgress,
      step: 3,
      domId: 'intelligence-dcp',
    },
  ]

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Intelligence
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          Phase 1 — Decision Intelligence. Complete all three steps to unlock Phase 2.
        </p>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: '960px' }}>

        {/* Phase 2 reminder banner */}
        <div style={{
          borderLeft: '4px solid #E8520A',
          backgroundColor: '#0F2140',
          borderRadius: '0 8px 8px 0',
          padding: '14px 18px',
          marginBottom: '24px',
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeftColor: '#E8520A',
          borderLeftWidth: '4px',
        }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.55', margin: 0 }}>
            Complete all three steps below and submit your DCP Map for Gate 1 approval before moving to Phase 2.
          </p>
        </div>

        {/* Gate 1 status banner */}
        <div style={{ marginBottom: '28px' }}>
          {loading ? null : <GateBadge status={status.gate1Status} />}
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {cards.map(({ icon: Icon, title, description, href, done, inProgress, step, domId }) => (
            <div
              key={href}
              id={domId}
              style={CARD}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  backgroundColor: done ? 'rgba(22,163,74,0.2)' : inProgress ? 'rgba(232,82,10,0.15)' : 'rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={20} color={done ? '#16A34A' : inProgress ? '#E8520A' : '#0EA5E9'} />
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Step {step}
                  </p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{title}</p>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.55', margin: 0 }}>
                {description}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
                <StepDot done={done} inProgress={inProgress} />
                <span style={{ fontSize: '12px', color: done ? '#16A34A' : inProgress ? '#E8520A' : 'rgba(255,255,255,0.4)' }}>
                  {done ? 'Complete' : inProgress ? 'In Progress' : 'Not started'}
                </span>
              </div>

              <Link
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: '44px', borderRadius: '8px',
                  backgroundColor: '#E8520A', color: '#FFFFFF',
                  fontSize: '14px', fontWeight: 600, textDecoration: 'none',
                }}
              >
                {done ? 'Review' : inProgress ? 'Continue' : 'Start'}
              </Link>
            </div>
          ))}
        </div>

        {/* Phase 2 lock notice */}
        {status.gate1Status !== 'approved' && (
          <div style={{
            marginTop: '28px', padding: '16px 20px',
            backgroundColor: '#0F2140', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <Lock size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Phase 2 (C3 Processing — Steps 4–38) is locked until Gate 1 is approved by an Approver or Admin.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
