'use client'

import type { CSSProperties } from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type {
  AdminDataResponse,
  AdminOrg,
  AdminOrgUser,
  AdminFeedback,
  AdminError,
  AdminUsageSummary,
} from '@/app/api/admin/data/route'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'clients' | 'feedback' | 'errors' | 'usage'
type FeedbackFilter = 'all' | 'issue' | 'idea' | 'thumbs_up' | 'thumbs_down'

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE: CSSProperties = { backgroundColor: '#0A1628', minHeight: '100vh' }

const HEADER: CSSProperties = {
  backgroundColor: '#0A1628',
  padding: '24px 32px 20px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const TAB_BAR: CSSProperties = {
  display: 'flex',
  gap: '4px',
  padding: '0 32px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  backgroundColor: '#0A1628',
}

const CARD: CSSProperties = {
  backgroundColor: '#0F2140',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  padding: '20px',
}

const TH: CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  backgroundColor: '#0F2140',
}

const TD: CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: '#FFFFFF',
  verticalAlign: 'top',
}

const SUBTLE: CSSProperties = { ...TD, color: 'rgba(255,255,255,0.55)' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return value
  }
}

function formatRelative(value: string | null): string {
  if (!value) return '—'
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return formatDate(value)
  const diff = Date.now() - then
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'today'
  const days = Math.floor(diff / day)
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 mo ago'
  if (months < 12) return `${months} mo ago`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 yr ago' : `${years} yr ago`
}

function FeedbackBadge({ type }: { type: AdminFeedback['type'] }) {
  const map: Record<AdminFeedback['type'], { bg: string; color: string; label: string }> = {
    issue:        { bg: 'rgba(239,68,68,0.18)',  color: '#FCA5A5', label: 'Issue' },
    idea:         { bg: 'rgba(14,165,233,0.18)', color: '#93C5FD', label: 'Idea' },
    thumbs_up:    { bg: 'rgba(34,197,94,0.18)',  color: '#86EFAC', label: '👍 Up' },
    thumbs_down:  { bg: 'rgba(245,158,11,0.18)', color: '#FCD34D', label: '👎 Down' },
  }
  const { bg, color, label } = map[type]
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '999px',
      backgroundColor: bg,
      color,
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.04em',
    }}>
      {label}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const router = useRouter()
  const [authChecking, setAuthChecking] = useState(true)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AdminDataResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('clients')

  useEffect(() => {
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        console.log('[Admin] user:', user?.id, user?.email)
        if (!user) {
          router.replace('/auth/login')
          return
        }
        const { data: row } = await supabase
          .from('users')
          .select('is_super_admin')
          .eq('id', user.id)
          .maybeSingle()
        const isSuper = !!(row && (row as { is_super_admin?: boolean }).is_super_admin)
        console.log('[Admin] row:', row, 'isSuper:', isSuper)
        if (!isSuper) {
          router.replace('/dashboard')
          return
        }
        setAuthChecking(false)
      } catch (e) {
        console.log('[Admin] catch error:', e)
        router.replace('/dashboard')
      }
    }
    void check()
  }, [router])

  useEffect(() => {
    if (authChecking) return
    void loadData()
  }, [authChecking])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/data')
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Failed to load (${res.status})`)
      }
      const payload = (await res.json()) as AdminDataResponse
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  if (authChecking) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  return (
    <div style={PAGE}>
      <header style={HEADER}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Super Admin</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '6px 0 0' }}>
          Cross-workspace operations console.
        </p>
      </header>

      <nav style={TAB_BAR}>
        {(['clients', 'feedback', 'errors', 'usage'] as Tab[]).map(t => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                backgroundColor: 'transparent',
                color: active ? '#0EA5E9' : 'rgba(255,255,255,0.55)',
                border: 'none',
                borderBottom: `2px solid ${active ? '#0EA5E9' : 'transparent'}`,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        )}
        {error && (
          <div style={{ ...CARD, borderLeft: '3px solid #EF4444', color: '#FCA5A5', fontSize: '13px' }}>
            {error}
          </div>
        )}
        {data && !loading && (
          <>
            {tab === 'clients'  && <ClientsTab  orgs={data.orgs} users={data.users} />}
            {tab === 'feedback' && <FeedbackTab feedback={data.feedback} onResolved={loadData} />}
            {tab === 'errors'   && <ErrorsTab   errors={data.errors} />}
            {tab === 'usage'    && <UsageTab    usage={data.usage} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── Clients Tab ───────────────────────────────────────────────────────────────

function ClientsTab({ orgs, users }: { orgs: AdminOrg[]; users: AdminOrgUser[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const usersByOrg = useMemo(() => {
    const m = new Map<string, AdminOrgUser[]>()
    for (const u of users) {
      const arr = m.get(u.org_id) ?? []
      arr.push(u)
      m.set(u.org_id, arr)
    }
    return m
  }, [users])

  function toggle(orgId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(orgId)) next.delete(orgId); else next.add(orgId)
      return next
    })
  }

  if (orgs.length === 0) {
    return <div style={{ ...CARD, color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>No workspaces yet.</div>
  }

  return (
    <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0F2140' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th style={{ ...TH, width: '32px' }} />
            <th style={TH}>Workspace</th>
            <th style={TH}>Users</th>
            <th style={TH}>Journey Progress</th>
            <th style={TH}>Last Active</th>
            <th style={TH}>Created</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map(o => {
            const isOpen = expanded.has(o.id)
            const orgUsers = usersByOrg.get(o.id) ?? []
            const pct = o.steps_total === 0 ? 0 : Math.round((o.steps_approved / o.steps_total) * 100)
            return (
              <Fragment key={o.id}>
                <tr
                  onClick={() => toggle(o.id)}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  <td style={TD}>
                    {isOpen ? <ChevronDown size={16} color="rgba(255,255,255,0.6)" /> : <ChevronRight size={16} color="rgba(255,255,255,0.6)" />}
                  </td>
                  <td style={{ ...TD, fontWeight: 600 }}>{o.name}</td>
                  <td style={TD}>{o.user_count}</td>
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        flex: 1,
                        height: '6px',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                        minWidth: '120px',
                      }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: '#E8520A',
                        }} />
                      </div>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', minWidth: '90px' }}>
                        {o.steps_approved}/{o.steps_total} ({pct}%)
                      </span>
                    </div>
                  </td>
                  <td style={SUBTLE}>{formatRelative(o.last_active_at)}</td>
                  <td style={SUBTLE}>{formatDate(o.created_at)}</td>
                </tr>
                {isOpen && (
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <td />
                    <td colSpan={5} style={{ padding: '14px 16px' }}>
                      {orgUsers.length === 0 ? (
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>No users.</span>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Name</th>
                              <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Email</th>
                              <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Role</th>
                              <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Active</th>
                              <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Joined</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orgUsers.map(u => {
                              const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—'
                              return (
                                <tr key={u.id}>
                                  <td style={{ ...TD, padding: '8px 10px' }}>{name}</td>
                                  <td style={{ ...SUBTLE, padding: '8px 10px' }}>{u.email}</td>
                                  <td style={{ ...SUBTLE, padding: '8px 10px' }}>{u.role}</td>
                                  <td style={{ ...SUBTLE, padding: '8px 10px' }}>{u.is_active ? 'Yes' : 'No'}</td>
                                  <td style={{ ...SUBTLE, padding: '8px 10px' }}>{formatDate(u.created_at)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Feedback Tab ──────────────────────────────────────────────────────────────

function FeedbackTab({ feedback, onResolved }: { feedback: AdminFeedback[]; onResolved: () => void }) {
  const [filter, setFilter] = useState<FeedbackFilter>('all')
  const [resolving, setResolving] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return feedback
    return feedback.filter(f => f.type === filter)
  }, [feedback, filter])

  async function markResolved(id: string) {
    setResolving(id)
    try {
      const res = await fetch('/api/admin/resolve-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolved: true }),
      })
      if (!res.ok) throw new Error('Failed')
      onResolved()
    } catch (err) {
      console.error('[admin] resolve failed', err)
    } finally {
      setResolving(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {(['all', 'issue', 'idea', 'thumbs_up', 'thumbs_down'] as FeedbackFilter[]).map(f => {
          const active = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                minHeight: '36px',
                padding: '0 14px',
                borderRadius: '999px',
                border: `1px solid ${active ? '#0EA5E9' : 'rgba(255,255,255,0.15)'}`,
                backgroundColor: active ? 'rgba(14,165,233,0.15)' : 'transparent',
                color: active ? '#0EA5E9' : 'rgba(255,255,255,0.65)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {f.replace('_', ' ')}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...CARD, color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>No feedback in this view.</div>
      ) : (
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0F2140' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={TH}>Type</th>
                <th style={TH}>Message</th>
                <th style={TH}>Workspace</th>
                <th style={TH}>Page / Step</th>
                <th style={TH}>Submitted</th>
                <th style={TH} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={TD}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <FeedbackBadge type={f.type} />
                      {f.resolved_at && (
                        <span style={{ fontSize: '10px', color: '#86EFAC', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={10} /> Resolved
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...TD, maxWidth: '360px' }}>
                    {f.message || <span style={{ color: 'rgba(255,255,255,0.4)' }}>—</span>}
                  </td>
                  <td style={SUBTLE}>{f.org_name}</td>
                  <td style={SUBTLE}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {f.step_id && <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px' }}>Step {f.step_id}</span>}
                      {f.page_url && (
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                          {f.page_url}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={SUBTLE}>{formatDate(f.created_at)}</td>
                  <td style={TD}>
                    {f.resolved_at ? (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>—</span>
                    ) : (
                      <button
                        onClick={() => markResolved(f.id)}
                        disabled={resolving === f.id}
                        style={{
                          minHeight: '32px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(14,165,233,0.4)',
                          backgroundColor: 'rgba(14,165,233,0.12)',
                          color: '#7DD3FC',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: resolving === f.id ? 'not-allowed' : 'pointer',
                          opacity: resolving === f.id ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {resolving === f.id ? 'Saving…' : 'Mark resolved'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Errors Tab ────────────────────────────────────────────────────────────────

function ErrorsTab({ errors }: { errors: AdminError[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of errors) m.set(e.step_id, (m.get(e.step_id) ?? 0) + 1)
    return [...m.entries()]
      .map(([step_id, count]) => ({ step_id, count }))
      .sort((a, b) => b.count - a.count)
  }, [errors])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={CARD}>
        <h3 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>
          Failures grouped by step
        </h3>
        {grouped.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>No Copilot errors recorded.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {grouped.map(g => (
              <span key={g.step_id} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '999px',
                backgroundColor: 'rgba(239,68,68,0.15)',
                color: '#FCA5A5',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                <span style={{ color: '#FFFFFF' }}>Step {g.step_id}</span>
                <span>{g.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0F2140' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={TH}>Step</th>
              <th style={TH}>Error Code</th>
              <th style={TH}>Workspace</th>
              <th style={TH}>Model</th>
              <th style={TH}>When</th>
            </tr>
          </thead>
          <tbody>
            {errors.length === 0 ? (
              <tr><td colSpan={5} style={{ ...SUBTLE, padding: '20px 14px' }}>No errors.</td></tr>
            ) : errors.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ ...TD, fontWeight: 600 }}>{e.step_id}</td>
                <td style={SUBTLE}>{e.error_code || '—'}</td>
                <td style={SUBTLE}>{e.org_name}</td>
                <td style={SUBTLE}>{e.model || '—'}</td>
                <td style={SUBTLE}>{formatDate(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Usage Tab ─────────────────────────────────────────────────────────────────

function UsageTab({ usage }: { usage: AdminUsageSummary }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <StatCard label="Workspaces"   value={usage.total_orgs} />
        <StatCard label="Users"        value={usage.total_users} />
        <StatCard label="Copilot runs (7 days)" value={usage.total_runs_week} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={CARD}>
          <h3 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>
            Most used steps
          </h3>
          {usage.top_steps.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>No runs yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Step</th>
                  <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Runs</th>
                </tr>
              </thead>
              <tbody>
                {usage.top_steps.map(s => (
                  <tr key={s.step_id}>
                    <td style={{ ...TD, padding: '8px 10px' }}>{s.step_id}</td>
                    <td style={{ ...TD, padding: '8px 10px' }}>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={CARD}>
          <h3 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>
            Highest error-rate steps
          </h3>
          {usage.error_rate_steps.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>No errors recorded.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Step</th>
                  <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Errors</th>
                  <th style={{ ...TH, padding: '6px 10px', backgroundColor: 'transparent' }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {usage.error_rate_steps.map(s => (
                  <tr key={s.step_id}>
                    <td style={{ ...TD, padding: '8px 10px' }}>{s.step_id}</td>
                    <td style={{ ...TD, padding: '8px 10px' }}>{s.errors} / {s.total}</td>
                    <td style={{ ...TD, padding: '8px 10px', color: '#FCA5A5' }}>{Math.round(s.rate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={CARD}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {label}
      </p>
      <p style={{ color: '#FFFFFF', fontSize: '32px', fontWeight: 700, margin: '8px 0 0' }}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}
