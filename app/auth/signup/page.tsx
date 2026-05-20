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

export default function SignupPage() {
  const router = useRouter()
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [logoError, setLogoError] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { workspace_name: workspaceName.trim() || email.split('@')[0] } },
      })
      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (!data.session) {
        setInfo('Check your email for a confirmation link, then sign in.')
        return
      }

      const provisionRes = await fetch('/api/auth/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceName: workspaceName.trim() || email.split('@')[0] }),
      })

      if (!provisionRes.ok) {
        const body = await provisionRes.json() as { error?: string }
        setError(body.error ?? 'Failed to set up workspace. Please contact support.')
        return
      }

      router.push('/dashboard/company-profile')
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
          Create account
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '28px' }}>
          Set up your Assembly AI workspace.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={LABEL}>Workspace name</label>
            <input
              type="text"
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              required
              autoComplete="organization"
              placeholder="Acme Corp"
              style={INPUT}
            />
          </div>
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
            <label style={LABEL}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              style={INPUT}
            />
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: '#F87171', margin: 0 }}>{error}</p>
          )}
          {info && (
            <p style={{ fontSize: '13px', color: '#34D399', margin: 0 }}>{info}</p>
          )}

          <button
            type="submit"
            disabled={loading || !!info}
            style={{
              minHeight: '44px',
              backgroundColor: loading || info ? 'rgba(232,82,10,0.5)' : '#E8520A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading || info ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
            }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: '#0EA5E9', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>

        <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          Need help?{' '}
          <a href="mailto:support@assemblynetworks.com" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Contact support@assemblynetworks.com
          </a>
        </p>
      </div>
    </div>
  )
}
