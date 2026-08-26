'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, Building2, Activity, Users, BarChart3, Inbox, Gauge,
  Plus, Copy, Check, ExternalLink, ArrowLeft, ShieldCheck, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type { AccountSummary, AccountsResponse } from '@/app/api/admin/accounts/route'

type SectionKey = 'accounts' | 'account-activity' | 'users' | 'activity-summary' | 'crm' | 'usage'

const SECTIONS: { key: SectionKey; label: string; icon: typeof Building2 }[] = [
  { key: 'accounts', label: 'Accounts', icon: Building2 },
  { key: 'account-activity', label: 'Account Activity', icon: Activity },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'activity-summary', label: 'Activity Summary', icon: BarChart3 },
  { key: 'crm', label: 'CRM', icon: Inbox },
  { key: 'usage', label: 'Usage', icon: Gauge },
]

const NAVY = '#0A1628'
const PANEL = '#0F2140'
const BORDER = 'rgba(255,255,255,0.1)'
const ORANGE = '#E8520A'

const card: CSSProperties = { backgroundColor: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }
const th: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textAlign: 'left', padding: '10px 12px', whiteSpace: 'nowrap' }
const td: CSSProperties = { fontSize: 13, color: '#fff', padding: '12px', borderTop: `1px solid ${BORDER}`, verticalAlign: 'top' }

function statusColor(status: string | null): { bg: string; fg: string } {
  switch (status) {
    case 'active': return { bg: 'rgba(34,197,94,0.15)', fg: '#86EFAC' }
    case 'trial': return { bg: 'rgba(14,165,233,0.15)', fg: '#7DD3FC' }
    case 'suspended': return { bg: 'rgba(239,68,68,0.15)', fg: '#FCA5A5' }
    case 'churned': return { bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.5)' }
    default: return { bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.6)' }
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

export default function MasterControlPanel() {
  const router = useRouter()
  const [authChecking, setAuthChecking] = useState(true)
  const [section, setSection] = useState<SectionKey>('accounts')

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
          {section === 'accounts' && <AccountsSection />}
          {section === 'account-activity' && (
            <Stub title="Account Activity" desc="Per-account detail: user activity, journey activity, gate status, performance score, reports downloaded, and average session time. Coming in the next phase." links={[{ label: 'View clients in the console', href: '/admin' }]} />
          )}
          {section === 'users' && (
            <Stub title="Users" desc="Add, edit, and remove users within each account. Coming in the next phase." links={[{ label: 'See per-account users in the console', href: '/admin' }]} />
          )}
          {section === 'activity-summary' && (
            <Stub title="Activity Summary" desc="Cross-account rollups: steps completed, high- and low-score accounts, average session time, average token usage, and help/beta activity. Coming in the next phase." links={[{ label: 'Usage in the console', href: '/admin' }]} />
          )}
          {section === 'crm' && (
            <Stub title="CRM" desc="Form submissions (Demo, Whitepaper, Contact Us, GTM Assessment), GTM reports, and consultations. Coming in the next phase." links={[{ label: 'GTM Gap Reports', href: '/admin/gtm-assessments' }, { label: 'Leads & demo requests in the console', href: '/admin' }]} />
          )}
          {section === 'usage' && (
            <Stub title="Usage" desc="Token status and platform usage. Coming in the next phase." links={[{ label: 'Usage in the console', href: '/admin' }]} />
          )}
        </main>
      </div>
    </div>
  )
}

function Stub({ title, desc, links }: { title: string; desc: string; links?: { label: string; href: string }[] }) {
  return (
    <div style={{ ...card }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{title}</h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, lineHeight: 1.6, margin: '0 0 14px', maxWidth: 620 }}>{desc}</p>
      {links && links.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {links.map((l) => (
            <Link key={l.href + l.label} href={l.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#7DD3FC', textDecoration: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
              {l.label} <ExternalLink size={13} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function AccountsSection() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)

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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Accounts</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0 0' }}>{accounts.length} workspace{accounts.length === 1 ? '' : 's'}</p>
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
                <th style={th}>Plan</th>
                <th style={th}>Users</th>
                <th style={th}>Journey</th>
                <th style={th}>Last active</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const sc = statusColor(a.status)
                const pct = a.steps_total > 0 ? Math.round((a.steps_approved / a.steps_total) * 100) : 0
                return (
                  <tr key={a.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{a.industry || a.slug}</div>
                    </td>
                    <td style={td}><span style={{ backgroundColor: sc.bg, color: sc.fg, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{a.status ?? '—'}</span></td>
                    <td style={td}>{a.plan ?? '—'}</td>
                    <td style={td}>{a.active_user_count}/{a.user_count}</td>
                    <td style={{ ...td, minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: 6, background: ORANGE }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{a.steps_approved}/{a.steps_total}</span>
                      </div>
                    </td>
                    <td style={td}>{timeAgo(a.last_active_at)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <Link href={`/dashboard/journeys?org=${a.id}`} style={{ color: '#7DD3FC', fontSize: 12.5, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        Open journey <ExternalLink size={12} />
                      </Link>
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
