'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Master Control Panel — account detail (read-only).
// Reads the account detail payload from /api/admin/accounts/[orgId]/detail
// (super-admin gated) and renders 5 sections: Journey, Gates, Performance,
// Reports, Login activity. Also exposes the shared suspend/reactivate control
// so an admin can act from the detail page too.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Loader2, ArrowLeft, ShieldCheck, PauseCircle, PlayCircle,
  Activity, ShieldAlert, Gauge, FileText, LogIn, ExternalLink,
  CheckCircle2, Circle, XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type { AccountDetailResponse } from '@/app/api/admin/accounts/[orgId]/detail/route'

// ── Design tokens (match /admin/control) ────────────────────────────────────
const NAVY = '#0A1628'
const PANEL = '#0F2140'
const BORDER = 'rgba(255,255,255,0.1)'
const ORANGE = '#E8520A'

const card: CSSProperties = { backgroundColor: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }

// ── Helpers ─────────────────────────────────────────────────────────────────
function statusColor(status: string | null): { bg: string; fg: string } {
  switch (status) {
    case 'active':    return { bg: 'rgba(34,197,94,0.15)', fg: '#86EFAC' }
    case 'trial':     return { bg: 'rgba(14,165,233,0.15)', fg: '#7DD3FC' }
    case 'suspended': return { bg: 'rgba(239,68,68,0.15)', fg: '#FCA5A5' }
    case 'churned':   return { bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.5)' }
    default:          return { bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.6)' }
  }
}

function gateBadge(status: string | null): { fg: string; bg: string; label: string } {
  const s = status ?? 'not_started'
  if (s === 'approved' || s === 'gate1_approved' || s === 'gate2_approved' || s === 'complete') {
    return { fg: '#86EFAC', bg: 'rgba(34,197,94,0.15)', label: 'Approved' }
  }
  if (s === 'pending_approval' || s === 'gate1_pending' || s === 'gate2_pending' || s === 'in_progress') {
    return { fg: '#FDBA74', bg: 'rgba(232,82,10,0.18)', label: 'Pending' }
  }
  if (s === 'draft' || s === 'not_started') {
    return { fg: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.08)', label: s === 'draft' ? 'Draft' : 'Not started' }
  }
  return { fg: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.08)', label: s }
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d}d ago`
  const h = Math.floor(diff / 3600000)
  if (h > 0) return `${h}h ago`
  const m = Math.floor(diff / 60000)
  return m > 0 ? `${m}m ago` : 'Just now'
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AccountDetailPage() {
  const router = useRouter()
  const params = useParams<{ orgId: string }>()
  const orgId = String(params?.orgId ?? '')

  const [authChecking, setAuthChecking] = useState(true)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AccountDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Same super-admin guard as /admin/control.
  useEffect(() => {
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/auth/login'); return }
        const { data: row } = await supabase.from('users').select('is_super_admin').eq('id', user.id).maybeSingle()
        if (!row || !(row as { is_super_admin?: boolean }).is_super_admin) { router.replace('/dashboard'); return }
        setAuthChecking(false)
      } catch { router.replace('/dashboard') }
    }
    void check()
  }, [router])

  async function load() {
    if (!orgId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/accounts/${orgId}/detail`)
      if (res.status === 404) {
        setData(null)
        setError('not_found')
        return
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load account')
      const body = (await res.json()) as AccountDetailResponse
      setData(body)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load account') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (authChecking) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecking, orgId])

  async function handleStatusToggle() {
    if (!data) return
    const nextStatus = data.account.status === 'suspended' ? 'active' : 'suspended'
    if (nextStatus === 'suspended') {
      const ok = typeof window !== 'undefined' && window.confirm(
        `Suspend "${data.account.name}"?\n\nThey will remain in the database, but this marks the workspace as suspended.`,
      )
      if (!ok) return
    }
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/admin/accounts/${orgId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to update status')
      setData(prev => prev ? { ...prev, account: { ...prev.account, status: nextStatus } } : prev)
    } catch (e) {
      if (typeof window !== 'undefined') window.alert(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setStatusUpdating(false)
    }
  }

  // ── Render gates ────────────────────────────────────────────────────────────
  if (authChecking) return <FullPageSpinner />

  return (
    <div style={{ backgroundColor: NAVY, minHeight: '100vh', color: '#fff' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 32px 48px' }}>
        <Link href="/admin/control" style={{ color: '#93C5FD', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Back to Master Control Panel
        </Link>

        {loading ? (
          <div style={{ padding: 80, display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={26} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </div>
        ) : error === 'not_found' ? (
          <NotFound orgId={orgId} />
        ) : error ? (
          <div style={{ ...card, marginTop: 20, borderLeft: `3px solid #EF4444` }}>
            <p style={{ color: '#FCA5A5', margin: 0 }}>{error}</p>
          </div>
        ) : data ? (
          <AccountDetail data={data} statusUpdating={statusUpdating} onStatusToggle={handleStatusToggle} />
        ) : null}
      </div>
    </div>
  )
}

function FullPageSpinner() {
  return (
    <div style={{ backgroundColor: NAVY, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
    </div>
  )
}

function NotFound({ orgId }: { orgId: string }) {
  return (
    <div style={{ ...card, marginTop: 20, borderLeft: `3px solid #FDBA74` }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Account not found</h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, margin: 0 }}>
        No workspace exists for id <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>{orgId}</code>.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail body — header + 5 sections
// ─────────────────────────────────────────────────────────────────────────────
function AccountDetail({
  data, statusUpdating, onStatusToggle,
}: {
  data: AccountDetailResponse
  statusUpdating: boolean
  onStatusToggle: () => void | Promise<void>
}) {
  const { account, journey, gates, performance, reports, login_activity } = data
  const sc = statusColor(account.status)
  const isSuspended = account.status === 'suspended'
  const journeyPct = journey.total > 0 ? Math.round((journey.approved / journey.total) * 100) : 0

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 14, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ShieldCheck size={22} style={{ color: ORANGE }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{account.name}</h1>
          <span style={{ backgroundColor: sc.bg, color: sc.fg, borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
            {account.status ?? '—'}
          </span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '6px 0 0' }}>
          {account.industry ? `${account.industry} · ` : ''}
          <span style={{ opacity: 0.7 }}>{account.slug}</span>
          {account.website && <> · <a href={account.website} target="_blank" rel="noreferrer" style={{ color: '#7DD3FC', textDecoration: 'none' }}>website <ExternalLink size={11} style={{ verticalAlign: 'middle' }} /></a></>}
        </p>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onStatusToggle}
            disabled={statusUpdating}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)',
              color: isSuspended ? '#86EFAC' : '#FDBA74',
              border: `1px solid ${isSuspended ? 'rgba(34,197,94,0.35)' : 'rgba(232,82,10,0.35)'}`,
              borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700,
              cursor: statusUpdating ? 'not-allowed' : 'pointer',
              opacity: statusUpdating ? 0.6 : 1,
            }}
          >
            {statusUpdating
              ? <><Loader2 size={14} className="animate-spin" /> Updating…</>
              : isSuspended
                ? <><PlayCircle size={14} /> Reactivate account</>
                : <><PauseCircle size={14} /> Suspend account</>}
          </button>
        </div>
      </div>

      {/* ── 1. Journey Status ──────────────────────────────────────────────── */}
      <SectionCard title="Journey status" icon={<Activity size={16} style={{ color: '#7DD3FC' }} />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${journeyPct}%`, height: 8, background: ORANGE }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {journey.approved}/{journey.total} · {journeyPct}%
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '10px 0 0' }}>
          Approved canonical journey steps (1–38, excluding 3.5). Matches the client&apos;s own dashboard math.
        </p>
      </SectionCard>

      {/* ── 2. Gate Status ─────────────────────────────────────────────────── */}
      <SectionCard title="Gate status" icon={<ShieldAlert size={16} style={{ color: '#F0ABFC' }} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
          <GateBox
            n={1} label="DCP approval" formal
            status={gates.gate1.status}
            timestamp={gates.gate1.approved_at ?? gates.gate1.submitted_at}
            timestampLabel={gates.gate1.approved_at ? 'Approved' : gates.gate1.submitted_at ? 'Submitted' : ''}
            note="Formal — from dcp_analysis"
          />
          <GateBox
            n={2} label="Company formulas" formal
            status={gates.gate2.status}
            timestamp={gates.gate2.approved_at ?? gates.gate2.submitted_at}
            timestampLabel={gates.gate2.approved_at ? 'Approved' : gates.gate2.submitted_at ? 'Submitted' : ''}
            note={gates.gate2.rejection_reason ? `Formal — c3_projects · Rejected: ${gates.gate2.rejection_reason}` : 'Formal — from c3_projects'}
          />
          <GateBox
            n={3} label="Competitive env." derived
            status={null}
            derivedCount={gates.gate3.approved_count}
            derivedTotal={gates.gate3.total}
            note="Progress-derived (no formal approval workflow)"
          />
          <GateBox
            n={4} label="Strategic messages" derived
            status={null}
            derivedCount={gates.gate4.approved_count}
            derivedTotal={gates.gate4.total}
            note="Progress-derived (no formal approval workflow)"
          />
        </div>
      </SectionCard>

      {/* ── 3. Performance Score ───────────────────────────────────────────── */}
      <SectionCard title="Performance score" icon={<Gauge size={16} style={{ color: '#FDBA74' }} />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <ScoreRing score={performance.total} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <ScoreBar label="Steps"       value={performance.stepPts}    max={40} color="#0EA5E9" />
            <ScoreBar label="ICP"          value={performance.icpPts}     max={20} color="#86EFAC" />
            <ScoreBar label="DCP"          value={performance.dcpPts}     max={20} color="#F0ABFC" />
            <ScoreBar label="Content quality" value={performance.qualityPts} max={20} color="#FDBA74" />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '10px 0 0' }}>
              Same 0–100 score the client sees on their own dashboard.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ── 4. Reports Generated ───────────────────────────────────────────── */}
      <SectionCard title="Reports generated" icon={<FileText size={16} style={{ color: '#86EFAC' }} />}>
        <ReportRow name="DCP Map"                  info={reports.dcp_map} />
        <ReportRow name="Insights Report"          info={reports.insights} />
        <ReportRow name="Engagement Plan"          info={reports.engagement_plan} />
        <ReportRow name="Future State Plan"        info={reports.future_state} />
        <ReportRow name="ICP Calibration Report"   info={reports.icp_calibration} />
      </SectionCard>

      {/* ── 5. Login Activity ──────────────────────────────────────────────── */}
      <SectionCard title="Login activity" icon={<LogIn size={16} style={{ color: '#7DD3FC' }} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          <MiniStat label="Total logins" value={String(login_activity.total_logins)} />
          <MiniStat label="Last 7 days"  value={String(login_activity.logins_last_7d)} />
          <MiniStat label="Last 30 days" value={String(login_activity.logins_last_30d)} />
          <MiniStat
            label="Last login"
            value={login_activity.last_login_at ? timeAgo(login_activity.last_login_at) : 'Never'}
            hint={login_activity.last_login_at ? fmtDate(login_activity.last_login_at) : ''}
          />
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '10px 0 0' }}>
          Login frequency (not time-in-app) — sourced from the login_events table.
        </p>
      </SectionCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ ...card, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {icon}
        <h3 style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.85)', margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function GateBox({
  n, label, status, derivedCount, derivedTotal, timestamp, timestampLabel, note, formal, derived,
}: {
  n: number; label: string; status: string | null;
  derivedCount?: number; derivedTotal?: number;
  timestamp?: string | null; timestampLabel?: string; note: string;
  formal?: boolean; derived?: boolean;
}) {
  const badge = gateBadge(status)
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Gate {n}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
        </div>
        {formal ? (
          <span style={{ backgroundColor: badge.bg, color: badge.fg, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
            {badge.label}
          </span>
        ) : derived ? (
          <span style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
            {derivedCount ?? 0}/{derivedTotal ?? 0} steps
          </span>
        ) : null}
      </div>
      {formal && timestamp ? (
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>
          {timestampLabel} {fmtDate(timestamp)}
        </div>
      ) : null}
      <div style={{ marginTop: 8, fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{note}</div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
      <svg width="128" height="128" viewBox="0 0 128 128" style={{ display: 'block' }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke={ORANGE} strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Score</div>
      </div>
    </div>
  )
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>{value}/{max}</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: 5, background: color }} />
      </div>
    </div>
  )
}

function ReportRow({ name, info }: { name: string; info: { generated: boolean; generated_at: string | null } }) {
  const generated = info.generated
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${BORDER}` }}>
      {generated
        ? <CheckCircle2 size={16} style={{ color: '#86EFAC', flexShrink: 0 }} />
        : <Circle size={16} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{name}</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>
          {generated
            ? <>Generated {fmtDate(info.generated_at)}</>
            : <span style={{ color: 'rgba(255,255,255,0.4)' }}>Not generated</span>}
        </div>
      </div>
      {generated ? null : <XCircle size={13} style={{ color: 'rgba(255,255,255,0.25)' }} />}
    </div>
  )
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}
