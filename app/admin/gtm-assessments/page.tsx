'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface Row {
  id: string
  company: string | null
  name: string | null
  email: string | null
  industry: string | null
  status: 'new' | 'drafted' | 'sent'
  created_at: string
  sent_at: string | null
}

const PAGE: CSSProperties = { backgroundColor: '#0A1628', minHeight: '100vh', color: '#FFFFFF' }
const WRAP: CSSProperties = { maxWidth: '1000px', margin: '0 auto', padding: '28px 32px 80px' }
const TH: CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }
const TD: CSSProperties = { padding: '12px 14px', fontSize: '13px', color: '#FFFFFF', verticalAlign: 'middle', borderTop: '1px solid rgba(255,255,255,0.07)' }

const statusColor = (s: string): { bg: string; fg: string } =>
  s === 'sent' ? { bg: 'rgba(34,197,94,0.18)', fg: '#86EFAC' }
    : s === 'drafted' ? { bg: 'rgba(14,165,233,0.18)', fg: '#93C5FD' }
      : { bg: 'rgba(245,158,11,0.18)', fg: '#FCD34D' }

function fmt(v: string | null): string {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return v }
}

export default function GtmAssessmentsListPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }
      const { data: row } = await supabase.from('users').select('is_super_admin').eq('id', user.id).maybeSingle()
      if (!active) return
      if (!(row as { is_super_admin?: boolean } | null)?.is_super_admin) { router.replace('/dashboard'); return }
      setAuthed(true)
    })()
    return () => { active = false }
  }, [router])

  useEffect(() => {
    if (!authed) return
    queueMicrotask(() => {
      void (async () => {
        try {
          const res = await fetch('/api/admin/gtm-assessments')
          const body = (await res.json()) as { assessments?: Row[]; error?: string }
          if (!res.ok) throw new Error(body.error ?? 'Failed to load')
          setRows(body.assessments ?? [])
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        } finally {
          setLoading(false)
        }
      })()
    })
  }, [authed])

  if (!authed || loading) {
    return <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={22} /></div>
  }

  return (
    <div style={PAGE}>
      <div style={WRAP}>
        <Link href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#93C5FD', fontSize: '13px', textDecoration: 'none', marginBottom: '16px' }}>
          <ArrowLeft size={14} /> Back to admin
        </Link>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px' }}>GTM Gap Reports</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', marginBottom: '22px' }}>Free assessment requests. Click a row to generate, review, and send.</p>

        {error && <div style={{ color: '#FCA5A5', marginBottom: '16px' }}>{error}</div>}

        {rows.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.55)' }}>No assessment requests yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Company</th>
                <th style={TH}>Contact</th>
                <th style={TH}>Status</th>
                <th style={TH}>Received</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sc = statusColor(r.status)
                return (
                  <tr key={r.id}>
                    <td style={TD}>
                      <div style={{ fontWeight: 600 }}>{r.company ?? '—'}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{r.industry ?? ''}</div>
                    </td>
                    <td style={TD}>
                      <div>{r.name ?? '—'}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{r.email ?? ''}</div>
                    </td>
                    <td style={TD}>
                      <span style={{ backgroundColor: sc.bg, color: sc.fg, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', textTransform: 'uppercase' }}>{r.status}</span>
                    </td>
                    <td style={{ ...TD, color: 'rgba(255,255,255,0.7)' }}>{fmt(r.created_at)}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <Link href={`/admin/gtm-assessment/${r.id}`} style={{ color: '#7DD3FC', textDecoration: 'none', fontWeight: 600 }}>Open →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
