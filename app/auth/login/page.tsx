'use client'

import type { CSSProperties, FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const LABEL: CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.7)',
  marginBottom: '6px',
}

const INPUT: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#FFFFFF',
  backgroundColor: '#1A3050',
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
  const [logoError, setLogoError] = useState(false)

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
    <div style={{
      backgroundColor: '#0A1628',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '32px' }}>
        {logoError ? (
          <span style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.3px' }}>
            Assembly AI
          </span>
        ) : (
          <Image
            src="/images/logo.png"
            alt="Assembly AI"
            width={160}
            height={40}
            style={{ maxHeight: '40px', width: 'auto' }}
            onError={() => setLogoError(true)}
          />
        )}
      </div>

      {/* Card */}
      <div style={{
        backgroundColor: '#0F2140',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
          Sign in
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '28px' }}>
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
              <Link href="/auth/reset-password" style={{ fontSize: '12px', color: '#0EA5E9', textDecoration: 'none' }}>
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
            <p style={{ fontSize: '13px', color: '#F87171', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              minHeight: '44px',
              backgroundColor: loading ? 'rgba(232,82,10,0.5)' : '#E8520A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
            }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" style={{ color: '#0EA5E9', fontWeight: 600, textDecoration: 'none' }}>
            Sign up
          </Link>
        </p>

        <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          Need help?{' '}
          <a href="mailto:support@assemblynetworks.com" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Contact support@assemblynetworks.com
          </a>
        </p>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '16px', fontSize: '12px' }}>
        <Link href="/tos" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
          Terms of Service
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
        <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
          Privacy Policy
        </Link>
      </div>
    </div>
  )
}
