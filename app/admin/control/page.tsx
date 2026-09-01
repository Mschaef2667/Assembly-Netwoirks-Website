'use client'

// ─────────────────────────────────────────────────────────────────────────────
// MASTER CONTROL PANEL — the real /admin/control page.
//
// Layout + design adopted from /admin/control/mockup.
//
// - Sections marked "PLACEHOLDER — sample data" are not yet wired to live data
//   (Dashboard, Account Activity, Users, Activity Summary, CRM, Usage).
// - The Accounts section is LIVE (fetches /api/admin/accounts, uses the real
//   SetupAccountModal to provision new client workspaces).
// - Super-admin auth guard is preserved unchanged — non-super-admins get
//   redirected before any UI renders.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, LayoutDashboard, Building2, Activity, Users, BarChart3, Inbox, Gauge,
  Plus, Copy, Check, ExternalLink, ArrowLeft, ShieldCheck, X, AlertCircle,
  TrendingUp, TrendingDown, Sparkles, FileText, MailQuestion, Download,
  PauseCircle, PlayCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type { AccountSummary, AccountsResponse } from '@/app/api/admin/accounts/route'

// ── Design tokens ────────────────────────────────────────────────────────────
const NAVY = '#0A1628'
const PANEL = '#0F2140'
const BORDER = 'rgba(255,255,255,0.1)'
const ORANGE = '#E8520A'

const card: CSSProperties = { backgroundColor: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }
const th: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textAlign: 'left', padding: '10px 12px', whiteSpace: 'nowrap' }
const td: CSSProperties = { fontSize: 13, color: '#fff', padding: '12px', borderTop: `1px solid ${BORDER}`, verticalAlign: 'top' }

// ── Section registry ─────────────────────────────────────────────────────────
type SectionKey = 'dashboard' | 'accounts' | 'activity-summary' | 'usage' | 'crm' | 'users'

const SECTIONS: { key: SectionKey; label: string; icon: typeof Building2 }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'accounts', label: 'Accounts', icon: Building2 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'activity-summary', label: 'Activity Summary', icon: BarChart3 },
  { key: 'crm', label: 'CRM', icon: Inbox },
  { key: 'usage', label: 'Usage', icon: Gauge },
]

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER sample data — used by the not-yet-wired sections.
// TODO: replace each section's data source with real queries as we wire it up.
// ─────────────────────────────────────────────────────────────────────────────

type HealthFlag = 'active' | 'slowing' | 'stalled'

interface SampleAccount {
  id: string
  name: string
  slug: string
  industry: string
  status: 'active' | 'trial' | 'suspended' | 'churned'
  plan: 'Starter' | 'Growth' | 'Market Leader' | 'Beta'
  users: number
  activeUsers: number
  stepsApproved: number
  stepsTotal: number
  lastActive: string
  lastActiveMinutes: number
  health: HealthFlag
  tokensThisMonth: number
}

const SAMPLE_ACCOUNTS: SampleAccount[] = [
  { id: 'a1', name: 'Assembly Networks',              slug: 'assembly-networks',              industry: 'Consulting',      status: 'active', plan: 'Market Leader', users: 4, activeUsers: 4, stepsApproved: 32, stepsTotal: 38, lastActive: '2h ago',  lastActiveMinutes: 120,   health: 'active',  tokensThisMonth: 812_400 },
  { id: 'a2', name: 'River Valley Architects',        slug: 'river-valley-architects',        industry: 'Architecture',    status: 'trial',  plan: 'Beta',          users: 3, activeUsers: 3, stepsApproved: 18, stepsTotal: 38, lastActive: '1d ago',  lastActiveMinutes: 1440,  health: 'active',  tokensThisMonth: 412_800 },
  { id: 'a3', name: 'Apex Solutions',                 slug: 'apex-solutions',                 industry: 'B2B SaaS',        status: 'active', plan: 'Growth',        users: 5, activeUsers: 4, stepsApproved: 24, stepsTotal: 38, lastActive: '3d ago',  lastActiveMinutes: 4320,  health: 'slowing', tokensThisMonth: 305_600 },
  { id: 'a4', name: 'BluePeak Advisory',              slug: 'bluepeak-advisory',              industry: 'Financial Svcs',  status: 'trial',  plan: 'Beta',          users: 2, activeUsers: 2, stepsApproved: 14, stepsTotal: 38, lastActive: '5h ago',  lastActiveMinutes: 300,   health: 'active',  tokensThisMonth: 220_150 },
  { id: 'a5', name: 'Northgate Partners',             slug: 'northgate-partners',             industry: 'Prof. Services',  status: 'active', plan: 'Growth',        users: 6, activeUsers: 5, stepsApproved: 38, stepsTotal: 38, lastActive: '12h ago', lastActiveMinutes: 720,   health: 'active',  tokensThisMonth: 588_900 },
  { id: 'a6', name: 'Silverline Studios',             slug: 'silverline-studios',             industry: 'Creative Agency', status: 'trial',  plan: 'Starter',       users: 2, activeUsers: 1, stepsApproved: 2,  stepsTotal: 38, lastActive: '9d ago',  lastActiveMinutes: 12960, health: 'slowing', tokensThisMonth: 62_300 },
  { id: 'a7', name: 'Front Range Marketing Coll.',    slug: 'front-range-marketing-collective', industry: 'Marketing',     status: 'trial',  plan: 'Starter',       users: 1, activeUsers: 0, stepsApproved: 6,  stepsTotal: 38, lastActive: '21d ago', lastActiveMinutes: 30240, health: 'stalled', tokensThisMonth: 4_100 },
]

interface SampleUser {
  id: string
  name: string
  email: string
  org: string
  role: 'super_admin' | 'org_admin' | 'ceo' | 'coo' | 'marketing_leadership' | 'sales_leadership' | 'cs_leadership' | 'sales_rep' | 'surveyor'
  isSuperAdmin: boolean
  isActive: boolean
  lastLogin: string
}

const SAMPLE_USERS: SampleUser[] = [
  { id: 'u1', name: 'Michael Schaefer', email: 'mschaef@gmail.com',      org: 'Assembly Networks',       role: 'super_admin', isSuperAdmin: true,  isActive: true,  lastLogin: '2h ago' },
  { id: 'u2', name: 'Lin Zhang',        email: 'lin@assemblynetworks.co', org: 'Assembly Networks',       role: 'coo',         isSuperAdmin: false, isActive: true,  lastLogin: '11h ago' },
  { id: 'u3', name: 'Sarah Chen',       email: 'sarah@rivervalley.com',   org: 'River Valley Architects', role: 'org_admin',   isSuperAdmin: false, isActive: true,  lastLogin: '1d ago' },
  { id: 'u4', name: 'David Park',       email: 'david@apexsolutions.io',  org: 'Apex Solutions',          role: 'ceo',         isSuperAdmin: false, isActive: true,  lastLogin: '3d ago' },
  { id: 'u5', name: 'Alex Rivera',      email: 'alex@bluepeak.com',       org: 'BluePeak Advisory',       role: 'org_admin',   isSuperAdmin: false, isActive: true,  lastLogin: '5h ago' },
  { id: 'u6', name: 'Jenna Ortiz',      email: 'jenna@northgate.co',      org: 'Northgate Partners',      role: 'org_admin',   isSuperAdmin: false, isActive: true,  lastLogin: '12h ago' },
  { id: 'u7', name: 'Tom Miller',       email: 'tom@silverline.studio',   org: 'Silverline Studios',      role: 'sales_rep',   isSuperAdmin: false, isActive: true,  lastLogin: '9d ago' },
  { id: 'u8', name: 'Emma Watson',      email: 'emma@frontrangemc.com',   org: 'Front Range Marketing Coll.', role: 'org_admin', isSuperAdmin: false, isActive: false, lastLogin: '21d ago' },
  { id: 'u9', name: 'Priya Nair',       email: 'priya@apexsolutions.io',  org: 'Apex Solutions',          role: 'marketing_leadership', isSuperAdmin: false, isActive: true, lastLogin: '4d ago' },
]

interface CrmItem {
  id: string
  source: 'Demo' | 'Whitepaper' | 'Contact' | 'GTM Assessment'
  name: string
  company: string
  email: string
  date: string
  status: 'new' | 'contacted' | 'qualified' | 'drafted' | 'sent' | 'closed'
}

const SAMPLE_CRM: CrmItem[] = [
  { id: 'c1', source: 'GTM Assessment', name: 'Rachel Kim',      company: 'Kim Ventures',     email: 'rachel@kimventures.io',    date: 'Today',      status: 'new' },
  { id: 'c2', source: 'Demo',           name: 'Mark Weaver',     company: 'Weaver & Co',      email: 'mark@weaverco.com',        date: 'Today',      status: 'new' },
  { id: 'c3', source: 'Whitepaper',     name: 'Priya Nair',      company: 'Apex Solutions',   email: 'priya@apexsolutions.io',   date: 'Yesterday',  status: 'contacted' },
  { id: 'c4', source: 'GTM Assessment', name: 'Owen Bradford',   company: 'Bradford Group',   email: 'owen@bradfordgroup.com',   date: '2d ago',     status: 'drafted' },
  { id: 'c5', source: 'Contact',        name: 'Sofia Alvarez',   company: 'Alvarez Media',    email: 'sofia@alvarezmedia.co',    date: '3d ago',     status: 'qualified' },
  { id: 'c6', source: 'Whitepaper',     name: 'Ben Hollis',      company: 'Hollis Advisors',  email: 'ben@hollisadvisors.com',   date: '4d ago',     status: 'contacted' },
  { id: 'c7', source: 'Demo',           name: 'Dana Yoo',        company: 'YooLabs',          email: 'dana@yoolabs.ai',          date: '5d ago',     status: 'qualified' },
  { id: 'c8', source: 'GTM Assessment', name: 'Chris Patel',     company: 'Patel Ventures',   email: 'chris@patelventures.co',   date: '1w ago',     status: 'sent' },
]

const SAMPLE_USAGE_BY_STEP: { step: string; runs: number; inputTokens: number; outputTokens: number }[] = [
  { step: 'DCP Map',             runs: 42, inputTokens: 512_400, outputTokens: 138_900 },
  { step: 'Step 4 (Problem)',    runs: 61, inputTokens: 202_100, outputTokens: 74_600 },
  { step: 'Insights',            runs: 28, inputTokens: 480_200, outputTokens: 152_500 },
  { step: 'ICP Segment 1',       runs: 24, inputTokens: 88_400,  outputTokens: 62_100 },
  { step: 'Step 22 (Comp Eval)', runs: 33, inputTokens: 148_700, outputTokens: 51_200 },
  { step: 'Step 11 (CVP)',       runs: 47, inputTokens: 122_500, outputTokens: 48_900 },
  { step: 'Step 28 (Jab)',       runs: 19, inputTokens: 62_100,  outputTokens: 24_800 },
]

const SAMPLE_WEEKLY_ACTIVE: { week: string; activeAccounts: number }[] = [
  { week: 'Wk 30', activeAccounts: 3 },
  { week: 'Wk 31', activeAccounts: 4 },
  { week: 'Wk 32', activeAccounts: 4 },
  { week: 'Wk 33', activeAccounts: 5 },
  { week: 'Wk 34', activeAccounts: 5 },
  { week: 'Wk 35', activeAccounts: 6 },
  { week: 'Wk 36', activeAccounts: 6 },
  { week: 'Wk 37', activeAccounts: 5 },
]

const SAMPLE_MONTHLY_GROWTH: { month: string; accounts: number }[] = [
  { month: 'Mar', accounts: 1 },
  { month: 'Apr', accounts: 2 },
  { month: 'May', accounts: 3 },
  { month: 'Jun', accounts: 4 },
  { month: 'Jul', accounts: 5 },
  { month: 'Aug', accounts: 7 },
]
const SAMPLE_NEW_ACCOUNTS_THIS_MONTH = 2

const SAMPLE_GATE_APPROVALS_PENDING: { account: string; gate: string; submitted: string }[] = [
  { account: 'Northgate Partners',      gate: 'Gate 2 (Company Formulas)',  submitted: '2h ago' },
  { account: 'River Valley Architects', gate: 'Gate 1 (DCP Map)',           submitted: '1d ago' },
  { account: 'Apex Solutions',          gate: 'Gate 3 (Competitive Env.)',  submitted: '3d ago' },
]

const SAMPLE_ERRORS_LAST_24H: { account: string; step: string; error: string; when: string }[] = [
  { account: 'BluePeak Advisory',    step: 'Step 22 (Comp Evaluation)', error: 'JSON parse failed',        when: '3h ago' },
  { account: 'Apex Solutions',       step: 'Step 22 (Comp Evaluation)', error: 'JSON parse failed',        when: '11h ago' },
  { account: 'Silverline Studios',   step: 'DCP Map',                    error: '502 upstream (Anthropic)', when: '18h ago' },
]

const SAMPLE_DROP_OFFS: { step: string; note: string; count: number }[] = [
  { step: 'Step 10 (Formula)',        note: 'Requires Steps 4, 6, 8', count: 3 },
  { step: 'Step 16 (Company Formulas)', note: 'JSON parse issues reported', count: 2 },
  { step: 'Step 22 (Comp Evaluation)', note: 'Known Copilot bug — workaround: fill manually', count: 2 },
]

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

function healthColor(h: HealthFlag): { bg: string; fg: string; dot: string; label: string } {
  switch (h) {
    case 'active':  return { bg: 'rgba(34,197,94,0.15)',  fg: '#86EFAC', dot: '#22C55E', label: 'Active' }
    case 'slowing': return { bg: 'rgba(232,82,10,0.18)',  fg: '#FDBA74', dot: '#E8520A', label: 'Slowing' }
    case 'stalled': return { bg: 'rgba(239,68,68,0.15)',  fg: '#FCA5A5', dot: '#EF4444', label: 'Stalled' }
  }
}

function crmStatusColor(s: CrmItem['status']): { bg: string; fg: string } {
  switch (s) {
    case 'new':       return { bg: 'rgba(232,82,10,0.18)', fg: '#FDBA74' }
    case 'contacted': return { bg: 'rgba(14,165,233,0.15)', fg: '#7DD3FC' }
    case 'qualified': return { bg: 'rgba(34,197,94,0.15)', fg: '#86EFAC' }
    case 'drafted':   return { bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.7)' }
    case 'sent':      return { bg: 'rgba(34,197,94,0.15)', fg: '#86EFAC' }
    case 'closed':    return { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.45)' }
  }
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

function fmtNum(n: number): string { return n.toLocaleString('en-US') }
function estCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
}
function fmtCost(cents: number): string { return `$${cents.toFixed(2)}` }

// ─────────────────────────────────────────────────────────────────────────────
// PAGE — auth guard is unchanged from the previous version.
// ─────────────────────────────────────────────────────────────────────────────
export default function MasterControlPanel() {
  const router = useRouter()
  const [authChecking, setAuthChecking] = useState(true)
  const [section, setSection] = useState<SectionKey>('dashboard')

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

  if (authChecking) {
    return (
      <div style={{ backgroundColor: NAVY, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: NAVY, minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <header style={{ padding: '24px 32px 20px', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
        <Link href="/dashboard" style={{ color: '#93C5FD', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <ShieldCheck size={22} style={{ color: ORANGE }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Master Control Panel</h1>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '6px 0 0' }}>Platform-level administration across all client accounts.</p>
      </header>

      <div style={{ display: 'flex', gap: 24, padding: '24px 32px', maxWidth: 1240, alignItems: 'flex-start' }}>
        {/* Left nav */}
        <nav style={{ ...card, padding: 10, width: 210, flexShrink: 0, position: 'sticky', top: 24 }}>
          {SECTIONS.map((s) => {
            const active = s.key === section
            const Icon = s.icon
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2,
                  minHeight: 40, fontSize: 13.5, fontWeight: active ? 700 : 500,
                  backgroundColor: active ? 'rgba(14,165,233,0.14)' : 'transparent',
                  color: active ? '#7DD3FC' : 'rgba(255,255,255,0.75)',
                }}
              >
                <Icon size={16} /> {s.label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {section === 'dashboard'         && <DashboardSection onGo={setSection} />}
          {section === 'accounts'          && <AccountsSection />}
          {section === 'activity-summary'  && <ActivitySummarySection />}
          {section === 'usage'             && <UsageSection />}
          {section === 'crm'               && <CrmSection />}
          {section === 'users'             && <UsersSection />}
        </main>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) DASHBOARD (home) — PLACEHOLDER — sample data
// ─────────────────────────────────────────────────────────────────────────────
function DashboardSection({ onGo }: { onGo: (s: SectionKey) => void }) {
  const totalAccounts = SAMPLE_ACCOUNTS.length
  const totalUsers = SAMPLE_USERS.length
  const activeAccounts7d = SAMPLE_ACCOUNTS.filter(a => a.lastActiveMinutes <= 60 * 24 * 7).length
  const totalInput = SAMPLE_USAGE_BY_STEP.reduce((s, u) => s + u.inputTokens, 0)
  const totalOutput = SAMPLE_USAGE_BY_STEP.reduce((s, u) => s + u.outputTokens, 0)
  const totalTokens = totalInput + totalOutput
  const monthCost = estCost(totalInput, totalOutput)

  const stalled = SAMPLE_ACCOUNTS.filter(a => a.health === 'stalled')
  const maxGrowth = Math.max(...SAMPLE_MONTHLY_GROWTH.map(m => m.accounts))

  return (
    <div>
      <SectionHeader
        title="Dashboard"
        subtitle="At-a-glance summary across all beta accounts."
        placeholder
      />

      {/* TOP ROW — 4 big stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi
          label="Total accounts"
          value={fmtNum(totalAccounts)}
          hint={<span style={{ color: '#86EFAC', fontWeight: 700 }}>+{SAMPLE_NEW_ACCOUNTS_THIS_MONTH} this month</span>}
          icon={<Building2 size={16} />}
          accent="#7DD3FC"
        />
        <Kpi
          label="Total users"
          value={fmtNum(totalUsers)}
          hint={`${SAMPLE_USERS.filter(u => u.isActive).length} active`}
          icon={<Users size={16} />}
          accent="#86EFAC"
        />
        <Kpi
          label="Active accounts (7d)"
          value={fmtNum(activeAccounts7d)}
          hint={`of ${totalAccounts} total`}
          icon={<Activity size={16} />}
          accent="#F0ABFC"
        />
        <Kpi
          label="AI usage — this month"
          value={fmtCost(monthCost)}
          hint={`${fmtNum(totalTokens)} tokens`}
          icon={<Sparkles size={16} />}
          accent="#FDBA74"
        />
      </div>

      {/* GROWTH CHART + RECENT ACTIVITY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Account growth</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>Cumulative accounts, last 6 months</p>
            </div>
            <span style={{ fontSize: 12, color: '#86EFAC', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <TrendingUp size={12} /> +{SAMPLE_NEW_ACCOUNTS_THIS_MONTH} MoM
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 160, paddingTop: 4 }}>
            {SAMPLE_MONTHLY_GROWTH.map(m => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{m.accounts}</div>
                <div style={{ width: '100%', height: `${(m.accounts / maxGrowth) * 125}px`, backgroundColor: ORANGE, borderRadius: 4, opacity: 0.9 }} />
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>{m.month}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent activity</h3>
            <button onClick={() => onGo('activity-summary')} style={linkBtn}>Trends <ExternalLink size={12} /></button>
          </div>
          {[
            { who: 'Sarah Chen',   what: 'approved Step 11 (CVPs)',        org: 'River Valley Architects', when: '32m ago' },
            { who: 'Jenna Ortiz',  what: 'submitted Gate 2 for review',    org: 'Northgate Partners',      when: '2h ago' },
            { who: 'David Park',   what: 'ran DCP Map re-analysis',        org: 'Apex Solutions',          when: '5h ago' },
            { who: 'Alex Rivera',  what: 'invited a new user',             org: 'BluePeak Advisory',       when: '8h ago' },
            { who: 'Lin Zhang',    what: 'downloaded Strategic Plan PDF',  org: 'Assembly Networks',       when: '11h ago' },
          ].map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`, fontSize: 13 }}>
              <div><span style={{ fontWeight: 700 }}>{r.who}</span> <span style={{ color: 'rgba(255,255,255,0.7)' }}>{r.what}</span></div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{r.org} · {r.when}</div>
            </div>
          ))}
        </div>
      </div>

      {/* NEEDS ATTENTION */}
      <div style={{ ...card, borderLeft: `3px solid ${ORANGE}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} style={{ color: ORANGE }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Needs attention</h3>
          </div>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>
            {stalled.length + SAMPLE_GATE_APPROVALS_PENDING.length + SAMPLE_ERRORS_LAST_24H.length} items today
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', margin: '4px 0 16px' }}>What needs you today, across all accounts.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <AttentionPanel
            title="Stalled accounts"
            count={stalled.length}
            countColor="#FCA5A5"
            countBg="rgba(239,68,68,0.15)"
            desc="No activity in 14+ days"
            onFooterClick={() => onGo('accounts')}
            footerLabel="View all in Accounts"
          >
            {stalled.map(a => (
              <AttentionRow
                key={a.id}
                primary={a.name}
                secondary={`Last active ${a.lastActive} · ${a.stepsApproved}/${a.stepsTotal} steps`}
                accent="#EF4444"
              />
            ))}
            {stalled.length === 0 && <EmptyLine label="Nothing stalled." />}
          </AttentionPanel>

          <AttentionPanel
            title="Awaiting gate approval"
            count={SAMPLE_GATE_APPROVALS_PENDING.length}
            countColor="#FDBA74"
            countBg="rgba(232,82,10,0.18)"
            desc="Submitted for review"
            onFooterClick={() => onGo('accounts')}
            footerLabel="Review in Accounts"
          >
            {SAMPLE_GATE_APPROVALS_PENDING.map((g, i) => (
              <AttentionRow
                key={i}
                primary={g.account}
                secondary={`${g.gate} · submitted ${g.submitted}`}
                accent="#E8520A"
              />
            ))}
          </AttentionPanel>

          <AttentionPanel
            title="Errors (last 24h)"
            count={SAMPLE_ERRORS_LAST_24H.length}
            countColor="#FCA5A5"
            countBg="rgba(239,68,68,0.15)"
            desc="Copilot / API failures"
            onFooterClick={() => onGo('usage')}
            footerLabel="See usage details"
          >
            {SAMPLE_ERRORS_LAST_24H.map((e, i) => (
              <AttentionRow
                key={i}
                primary={e.account}
                secondary={`${e.step} · ${e.error} · ${e.when}`}
                accent="#EF4444"
              />
            ))}
          </AttentionPanel>
        </div>
      </div>

      {/* Jump to */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>Jump to</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['accounts','activity-summary','usage','crm','users'] as SectionKey[]).map(k => {
            const s = SECTIONS.find(x => x.key === k)!
            const Icon = s.icon
            return (
              <button key={k} onClick={() => onGo(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: 'rgba(255,255,255,0.85)', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
                <Icon size={14} /> {s.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) ACCOUNTS — LIVE (fetches /api/admin/accounts, real SetupAccountModal)
// This block is preserved from the previous /admin/control implementation.
// ─────────────────────────────────────────────────────────────────────────────
function AccountsSection() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/accounts')
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load accounts')
      const data = (await res.json()) as AccountsResponse
      setAccounts(data.accounts)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load accounts') }
    finally { setLoading(false) }
  }

  useEffect(() => { queueMicrotask(() => { void load() }) }, [])

  async function handleStatusChange(account: AccountSummary, nextStatus: 'suspended' | 'active') {
    // Only suspending is confirmed — significant enough to warrant a prompt.
    if (nextStatus === 'suspended') {
      const ok = typeof window !== 'undefined' && window.confirm(
        `Suspend "${account.name}"?\n\nThey will remain in the database, but this marks the workspace as suspended.`,
      )
      if (!ok) return
    }
    setStatusUpdating(prev => { const next = new Set(prev); next.add(account.id); return next })
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Failed to update status')
      }
      // Optimistically update the row so the UI flips instantly.
      setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, status: nextStatus } : a))
    } catch (err) {
      if (typeof window !== 'undefined') {
        window.alert(err instanceof Error ? err.message : 'Failed to update status')
      }
    } finally {
      setStatusUpdating(prev => { const next = new Set(prev); next.delete(account.id); return next })
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Accounts</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0 0' }}>
            {accounts.length} workspace{accounts.length === 1 ? '' : 's'} · click a row for account detail
          </p>
        </div>
        <button
          onClick={() => setShowSetup(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: ORANGE, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', minHeight: 42 }}
        >
          <Plus size={16} /> Set up account
        </button>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Loader2 size={22} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} /></div>
        ) : error ? (
          <div style={{ padding: 24, color: '#FCA5A5', fontSize: 13 }}>{error}</div>
        ) : accounts.length === 0 ? (
          <div style={{ padding: 24, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>No accounts yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Account</th>
                <th style={th}>Status</th>
                <th style={th}>Journey</th>
                <th style={th}>Last active</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const sc = statusColor(a.status)
                const pct = a.steps_total > 0 ? Math.round((a.steps_approved / a.steps_total) * 100) : 0
                const isSuspended = a.status === 'suspended'
                const updating = statusUpdating.has(a.id)
                const exactDate = a.last_active_at ? new Date(a.last_active_at).toLocaleString() : ''
                return (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/admin/control/accounts/${a.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{a.industry || a.slug}</div>
                    </td>
                    <td style={td}>
                      <span style={{ backgroundColor: sc.bg, color: sc.fg, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                        {a.status ?? '—'}
                      </span>
                    </td>
                    <td style={{ ...td, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: 6, background: ORANGE }} />
                        </div>
                        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', minWidth: 60, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {a.steps_approved}/{a.steps_total} · {pct}%
                        </span>
                      </div>
                    </td>
                    <td style={td} title={exactDate}>{timeAgo(a.last_active_at)}</td>
                    <td
                      style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { void handleStatusChange(a, isSuspended ? 'active' : 'suspended') }}
                        disabled={updating}
                        title={isSuspended ? 'Reactivate this account' : 'Suspend this account'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'rgba(255,255,255,0.04)',
                          color: isSuspended ? '#86EFAC' : '#FDBA74',
                          border: `1px solid ${isSuspended ? 'rgba(34,197,94,0.35)' : 'rgba(232,82,10,0.35)'}`,
                          borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700,
                          cursor: updating ? 'not-allowed' : 'pointer',
                          opacity: updating ? 0.6 : 1,
                        }}
                      >
                        {updating
                          ? <><Loader2 size={12} className="animate-spin" /> Updating…</>
                          : isSuspended
                            ? <><PlayCircle size={12} /> Reactivate</>
                            : <><PauseCircle size={12} /> Suspend</>}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showSetup && <SetupAccountModal onClose={() => setShowSetup(false)} onCreated={() => { void load() }} />}
    </div>
  )
}

// SetupAccountModal — preserved from the previous /admin/control implementation.
function SetupAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit() {
    if (!name.trim()) { setError('Account name is required'); return }
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), industry: industry.trim() || undefined, website: website.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create account')
      setInviteUrl(data.inviteUrl as string)
      onCreated()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to create account') }
    finally { setSubmitting(false) }
  }

  const inputStyle: CSSProperties = { width: '100%', backgroundColor: NAVY, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, marginTop: 6 }
  const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div style={{ ...card, width: 480, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{inviteUrl ? 'Account created' : 'Set up account'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {inviteUrl ? (
          <div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 12px' }}>
              Share this private invite link with the client. The first person to accept it becomes that workspace&apos;s admin.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={inviteUrl} style={{ ...inputStyle, marginTop: 0 }} />
              <button
                onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                style={{ backgroundColor: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)', color: copied ? '#86EFAC' : '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', flexShrink: 0 }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div style={{ marginTop: 18, textAlign: 'right' }}>
              <button onClick={onClose} style={{ backgroundColor: ORANGE, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Done</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Account name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Industry</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="B2B SaaS" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Website</label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" style={inputStyle} />
            </div>
            {error && <p style={{ color: '#FCA5A5', fontSize: 12.5, margin: '0 0 12px' }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button onClick={onClose} style={{ background: 'none', color: 'rgba(255,255,255,0.6)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 16px', fontSize: 13.5, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submit} disabled={submitting} style={{ backgroundColor: ORANGE, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {submitting && <Loader2 size={15} className="animate-spin" />} Create account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) ACTIVITY SUMMARY — PLACEHOLDER — sample data
// ─────────────────────────────────────────────────────────────────────────────
function ActivitySummarySection() {
  const avgPct = Math.round(
    (SAMPLE_ACCOUNTS.reduce((s, a) => s + (a.stepsApproved / a.stepsTotal), 0) / SAMPLE_ACCOUNTS.length) * 100,
  )
  const activeThisWeek = SAMPLE_ACCOUNTS.filter(a => a.lastActiveMinutes <= 60 * 24 * 7).length
  const stepsApprovedTotal = SAMPLE_ACCOUNTS.reduce((s, a) => s + a.stepsApproved, 0)
  const maxBar = Math.max(...SAMPLE_WEEKLY_ACTIVE.map(w => w.activeAccounts))

  return (
    <div>
      <SectionHeader title="Activity Summary" subtitle="Cross-account rollups over the last 8 weeks." placeholder />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Active accounts (last 7d)" value={fmtNum(activeThisWeek)} hint={`of ${SAMPLE_ACCOUNTS.length}`} icon={<TrendingUp size={16} />} accent="#86EFAC" />
        <Kpi label="Avg journey completion"    value={`${avgPct}%`}          hint="across all beta accounts" icon={<Activity size={16} />} accent="#7DD3FC" />
        <Kpi label="Steps approved (total)"    value={fmtNum(stepsApprovedTotal)} hint="this beta cohort" icon={<BarChart3 size={16} />} accent="#F0ABFC" />
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Weekly active accounts</h3>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={12} /> -1 week over week
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140, paddingTop: 4 }}>
          {SAMPLE_WEEKLY_ACTIVE.map(w => (
            <div key={w.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{w.activeAccounts}</div>
              <div style={{ width: '100%', height: `${(w.activeAccounts / maxBar) * 110}px`, backgroundColor: ORANGE, borderRadius: 4, opacity: 0.85 }} />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{w.week}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Common drop-off points</h3>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }}>Steps where multiple accounts pause for &gt; 3 days.</p>
        {SAMPLE_DROP_OFFS.map((d, i) => (
          <div key={d.step} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${BORDER}` }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{d.step}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{d.note}</div>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{d.count} accounts</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) USAGE — PLACEHOLDER — sample data
// ─────────────────────────────────────────────────────────────────────────────
function UsageSection() {
  const totalTokens = SAMPLE_ACCOUNTS.reduce((s, a) => s + a.tokensThisMonth, 0)
  const totalInput = SAMPLE_USAGE_BY_STEP.reduce((s, u) => s + u.inputTokens, 0)
  const totalOutput = SAMPLE_USAGE_BY_STEP.reduce((s, u) => s + u.outputTokens, 0)
  const monthCost = estCost(totalInput, totalOutput)
  const maxAcct = Math.max(...SAMPLE_ACCOUNTS.map(a => a.tokensThisMonth))
  const maxStep = Math.max(...SAMPLE_USAGE_BY_STEP.map(u => u.inputTokens + u.outputTokens))

  return (
    <div>
      <SectionHeader title="Usage" subtitle="Anthropic token consumption and estimated cost this month." placeholder />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Input tokens"  value={fmtNum(totalInput)}  hint="this month" icon={<Sparkles size={16} />} accent="#7DD3FC" />
        <Kpi label="Output tokens" value={fmtNum(totalOutput)} hint="this month" icon={<Sparkles size={16} />} accent="#86EFAC" />
        <Kpi label="Total tokens"  value={fmtNum(totalTokens)} hint="all accounts" icon={<Gauge size={16} />} accent="#F0ABFC" />
        <Kpi label="Est. cost"     value={fmtCost(monthCost)}  hint="Sonnet 4.5 rates" icon={<TrendingUp size={16} />} accent="#FDBA74" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>By account</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Account</th>
                <th style={th}>Tokens</th>
                <th style={th}>Share</th>
              </tr>
            </thead>
            <tbody>
              {[...SAMPLE_ACCOUNTS].sort((a, b) => b.tokensThisMonth - a.tokensThisMonth).map(a => {
                const share = (a.tokensThisMonth / maxAcct) * 100
                return (
                  <tr key={a.id}>
                    <td style={td}><div style={{ fontWeight: 700 }}>{a.name}</div></td>
                    <td style={td}>{fmtNum(a.tokensThisMonth)}</td>
                    <td style={{ ...td, minWidth: 140 }}>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${share}%`, height: 6, background: '#7DD3FC' }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>By step</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Step</th>
                <th style={th}>Runs</th>
                <th style={th}>Tokens</th>
                <th style={th}>Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {[...SAMPLE_USAGE_BY_STEP].sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens)).map(u => (
                <tr key={u.step}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{u.step}</div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${((u.inputTokens + u.outputTokens) / maxStep) * 100}%`, height: 4, background: '#F0ABFC' }} />
                    </div>
                  </td>
                  <td style={td}>{u.runs}</td>
                  <td style={td}>{fmtNum(u.inputTokens + u.outputTokens)}</td>
                  <td style={td}>{fmtCost(estCost(u.inputTokens, u.outputTokens))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) CRM — PLACEHOLDER — sample data
// ─────────────────────────────────────────────────────────────────────────────
function CrmSection() {
  const bySource = {
    Demo:              SAMPLE_CRM.filter(c => c.source === 'Demo').length,
    Whitepaper:        SAMPLE_CRM.filter(c => c.source === 'Whitepaper').length,
    Contact:           SAMPLE_CRM.filter(c => c.source === 'Contact').length,
    'GTM Assessment':  SAMPLE_CRM.filter(c => c.source === 'GTM Assessment').length,
  }
  const sourceIcon = (s: CrmItem['source']) => {
    if (s === 'Demo') return <MailQuestion size={13} />
    if (s === 'Whitepaper') return <Download size={13} />
    if (s === 'Contact') return <Inbox size={13} />
    return <FileText size={13} />
  }

  return (
    <div>
      <SectionHeader title="CRM" subtitle="Unified inbound: demo requests, whitepaper downloads, contact form, GTM assessments." placeholder />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Demo requests"    value={fmtNum(bySource['Demo'])}             icon={<MailQuestion size={16} />} accent="#7DD3FC" />
        <Kpi label="Whitepapers"       value={fmtNum(bySource['Whitepaper'])}       icon={<Download size={16} />}    accent="#86EFAC" />
        <Kpi label="Contact form"      value={fmtNum(bySource['Contact'])}          icon={<Inbox size={16} />}       accent="#F0ABFC" />
        <Kpi label="GTM assessments"   value={fmtNum(bySource['GTM Assessment'])}   icon={<FileText size={16} />}    accent="#FDBA74" />
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Source</th>
              <th style={th}>Contact</th>
              <th style={th}>Company</th>
              <th style={th}>Received</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_CRM.map(c => {
              const sc = crmStatusColor(c.status)
              return (
                <tr key={c.id}>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>
                      {sourceIcon(c.source)} {c.source}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>{c.email}</div>
                  </td>
                  <td style={td}>{c.company}</td>
                  <td style={td}>{c.date}</td>
                  <td style={td}>
                    <span style={{ backgroundColor: sc.bg, color: sc.fg, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{c.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) USERS — PLACEHOLDER — sample data
// ─────────────────────────────────────────────────────────────────────────────
function UsersSection() {
  return (
    <div>
      <SectionHeader
        title="Users"
        subtitle={`${SAMPLE_USERS.length} users across ${new Set(SAMPLE_USERS.map(u => u.org)).size} workspaces.`}
        placeholder
      />

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>User</th>
              <th style={th}>Workspace</th>
              <th style={th}>Role</th>
              <th style={th}>Super admin</th>
              <th style={th}>Status</th>
              <th style={th}>Last login</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_USERS.map(u => (
              <tr key={u.id}>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>{u.email}</div>
                </td>
                <td style={td}>{u.org}</td>
                <td style={td}><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'lowercase' }}>{u.role.replaceAll('_', ' ')}</span></td>
                <td style={td}>
                  {u.isSuperAdmin
                    ? <span style={{ backgroundColor: 'rgba(232,82,10,0.18)', color: '#FDBA74', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Yes</span>
                    : <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>—</span>}
                </td>
                <td style={td}>
                  {u.isActive
                    ? <span style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#86EFAC', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Active</span>
                    : <span style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Inactive</span>}
                </td>
                <td style={td}>{u.lastLogin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, placeholder }: { title: string; subtitle: string; placeholder?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
        {placeholder && (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FDBA74', backgroundColor: 'rgba(232,82,10,0.14)', border: `1px solid rgba(232,82,10,0.3)`, borderRadius: 999, padding: '2px 8px' }}>
            Sample data
          </span>
        )}
      </div>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0 0' }}>{subtitle}</p>
    </div>
  )
}

function Kpi({ label, value, hint, icon, accent }: { label: string; value: string; hint?: React.ReactNode; icon?: React.ReactNode; accent: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <span>{label}</span>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8, color: '#fff' }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function AttentionPanel({
  title, count, countColor, countBg, desc, children, onFooterClick, footerLabel,
}: {
  title: string; count: number; countColor: string; countBg: string; desc: string;
  children: React.ReactNode; onFooterClick: () => void; footerLabel: string;
}) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', minHeight: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h4 style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.7)', margin: 0 }}>{title}</h4>
        <span style={{ backgroundColor: countBg, color: countColor, borderRadius: 999, padding: '2px 10px', fontSize: 11.5, fontWeight: 700, minWidth: 26, textAlign: 'center' }}>{count}</span>
      </div>
      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', margin: '0 0 10px' }}>{desc}</p>
      <div style={{ flex: 1 }}>{children}</div>
      <button onClick={onFooterClick} style={{ ...linkBtn, marginTop: 10, alignSelf: 'flex-start' }}>{footerLabel} <ExternalLink size={11} /></button>
    </div>
  )
}

function AttentionRow({ primary, secondary, accent }: { primary: string; secondary: string; accent: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: `1px solid ${BORDER}` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: accent, flexShrink: 0, marginTop: 6 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>{primary}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2, lineHeight: 1.4 }}>{secondary}</div>
      </div>
    </div>
  )
}

function EmptyLine({ label }: { label: string }) {
  return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', padding: '8px 0' }}>{label}</div>
}

const linkBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#7DD3FC', fontSize: 12, cursor: 'pointer', padding: 0 }
