'use client'

import type { CSSProperties, FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const LABEL: CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#0D0D0D',
  marginBottom: '6px',
}

const INPUT: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#0D0D0D',
  backgroundColor: '#FFFFFF',
  width: '100%',
  minHeight: '44px',
  boxSizing: 'border-box',
  outline: 'none',
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      router.push('/dashboard')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px' }}>
        <span style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.3px' }}>
          Assembly AI
        </span>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
          padding: '40px',
          width: '100%',
          maxWidth: '400px',
        }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0D0D0D', marginBottom: '6px' }}>
            Sign in
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '28px' }}>
            Welcome back to your workspace.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={LABEL}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                style={INPUT}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>Password</label>
                <Link href="/auth/reset-password" style={{ fontSize: '12px', color: '#E8520A', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={INPUT}
              />
            </div>

            {error && (
              <p style={{ fontSize: '13px', color: '#EF4444', margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                minHeight: '44px',
                backgroundColor: loading ? '#E5E7EB' : '#E8520A',
                color: loading ? '#9CA3AF' : '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#6B7280' }}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" style={{ color: '#E8520A', fontWeight: 600, textDecoration: 'none' }}>
              Sign up
            </Link>
          </p>

          <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#9CA3AF' }}>
            Need help?{' '}
            <a href="mailto:support@assemblynetworks.com" style={{ color: '#6B7280' }}>
              Contact support@assemblynetworks.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
