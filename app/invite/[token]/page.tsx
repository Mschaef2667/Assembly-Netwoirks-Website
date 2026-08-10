'use client'

import type { CSSProperties, FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const LABEL: CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }
const INPUT: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 12px', fontSize: '14px',
  color: '#FFFFFF', backgroundColor: '#1A3050', width: '100%', minHeight: '44px', boxSizing: 'border-box', outline: 'none',
}
const CARD: CSSProperties = {
  width: '100%', maxWidth: '420px', backgroundColor: '#0F2140', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '14px', padding: '32px', boxSizing: 'border-box',
}

export default function InvitePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = String(params?.token ?? '')

  const [checking, setChecking] = useState(true)
  const [valid, setValid] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/invite/accept?token=${encodeURIComponent(token)}`)
        const data = (await res.json()) as { valid: boolean; orgName?: string; error?: string }
        if (cancelled) return
        setValid(data.valid)
        setOrgName(data.orgName ?? '')
        if (!data.valid) setError(data.error ?? 'This invite link is not valid.')
      } catch {
        if (!cancelled) setError('Could not verify this invite link.')
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password, firstName, lastName }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? 'Could not create your account.'); return }

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) { router.push('/auth/login'); return }
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A1628', padding: '24px' }}>
      <div style={CARD}>
        {checking ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'rgba(255,255,255,0.6)' }}>
            <Loader2 size={16} className="animate-spin" /> Verifying your invitation…
          </div>
        ) : !valid ? (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 8px' }}>Invitation not valid</h1>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: '0 0 16px' }}>{error}</p>
            <a href="/auth/login" style={{ color: '#0EA5E9', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Go to sign in</a>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px' }}>Join {orgName}</h1>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: '0 0 20px' }}>Create your account to get started.</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={LABEL}>First name</label><input style={INPUT} value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                <div><label style={LABEL}>Last name</label><input style={INPUT} value={lastName} onChange={e => setLastName(e.target.value)} /></div>
              </div>
              <div><label style={LABEL}>Work email</label><input style={INPUT} type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><label style={LABEL}>Password</label><input style={INPUT} type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
              {error && <p style={{ color: '#F87171', fontSize: '13px', margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading} style={{
                marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
                minHeight: '44px', borderRadius: '8px', border: 'none', backgroundColor: '#0EA5E9', color: '#FFFFFF',
                fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}>
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
