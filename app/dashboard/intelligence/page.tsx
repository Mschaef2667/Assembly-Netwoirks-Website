'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ClipboardList, Upload, Map, CheckCircle2, Circle, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type GateStatus = 'locked' | 'pending' | 'approved'

interface PhaseStatus {
  surveyBuilt: boolean
  responsesImported: boolean
  dcpMapGenerated: boolean
  gate1Status: GateStatus
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
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
      backgroundColor: '#F3F4F6', color: '#6B7280', fontSize: '13px', fontWeight: 700,
    }}>
      <Lock size={14} /> Gate 1 Locked
    </span>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDot({ done }: { done: boolean }) {
  return (
    <div style={{
      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
      backgroundColor: done ? '#16A34A' : '#E5E7EB',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {done && <CheckCircle2 size={12} color="#FFFFFF" />}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [status, setStatus] = useState<PhaseStatus>({
    surveyBuilt: false,
    responsesImported: false,
    dcpMapGenerated: false,
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
          supabase.from('workspace_survey').select('id').eq('org_id', orgId).maybeSingle(),
          supabase.from('dcp_imports').select('id').eq('org_id', orgId).limit(1),
          supabase.from('dcp_analysis').select('status').eq('org_id', orgId).maybeSingle(),
        ])

        const dcpRow = dcpRes.data as Record<string, unknown> | null
        const dcpStatus = dcpRow ? String(dcpRow['status'] ?? 'draft') : null

        setStatus({
          surveyBuilt: !!surveyRes.data,
          responsesImported: !!(responsesRes.data && responsesRes.data.length > 0),
          dcpMapGenerated: !!dcpRow,
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
      description: 'Select and customize DCP questions across 7 buying journey stages. Export as a Google Forms-ready CSV.',
      href: '/dashboard/intelligence/survey',
      done: status.surveyBuilt,
      step: 1,
    },
    {
      icon: Upload,
      title: 'Response Import',
      description: 'Import completed survey responses via Google Sheets URL or CSV upload. Responses fuel the DCP Map analysis.',
      href: '/dashboard/intelligence/responses',
      done: status.responsesImported,
      step: 2,
    },
    {
      icon: Map,
      title: 'DCP Map',
      description: 'Copilot analyzes responses across all 7 stages and generates your Decision Criteria Profile. Submit for Gate 1 approval to unlock Phase 2.',
      href: '/dashboard/intelligence/dcp-map',
      done: status.dcpMapGenerated,
      step: 3,
    },
  ]

  return (
    <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Intelligence
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          Phase 1 — Decision Intelligence. Complete all three steps to unlock Phase 2.
        </p>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: '960px' }}>

        {/* Gate 1 status banner */}
        <div style={{ marginBottom: '28px' }}>
          {loading ? null : <GateBadge status={status.gate1Status} />}
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {cards.map(({ icon: Icon, title, description, href, done, step }) => (
            <div key={href} style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  backgroundColor: done ? '#DCFCE7' : '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={20} color={done ? '#16A34A' : '#6B7280'} />
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Step {step}
                  </p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>{title}</p>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.55', margin: 0 }}>
                {description}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
                <StepDot done={done} />
                <span style={{ fontSize: '12px', color: done ? '#16A34A' : '#6B7280' }}>
                  {done ? 'Complete' : 'Not started'}
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
                {done ? 'Review' : 'Start'}
              </Link>
            </div>
          ))}
        </div>

        {/* Phase 2 lock notice */}
        {status.gate1Status !== 'approved' && (
          <div style={{
            marginTop: '28px', padding: '16px 20px',
            backgroundColor: '#FFFFFF', borderRadius: '10px',
            border: '1px solid #E5E7EB',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <Lock size={18} style={{ color: '#6B7280', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              Phase 2 (C3 Processing — Steps 4–38) is locked until Gate 1 is approved by an Approver or Admin.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
