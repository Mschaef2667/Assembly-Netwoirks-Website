'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const NAVY = '#0A1628'
const NAVY_DEEP = '#06101F'
const ORANGE = '#E8520A'
const BLUE = '#0EA5E9'
const WHITE = '#FFFFFF'
const BLACK = '#0D0D0D'
const TEXT_MUTED = 'rgba(255,255,255,0.65)'
const TEXT_DIMMER = 'rgba(255,255,255,0.5)'
const BORDER = 'rgba(255,255,255,0.1)'

const PAGE: CSSProperties = {
  backgroundColor: NAVY,
  color: WHITE,
  minHeight: '100vh',
  fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const NAV: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  backgroundColor: 'rgba(10,22,40,0.85)',
  backdropFilter: 'saturate(180%) blur(10px)',
  WebkitBackdropFilter: 'saturate(180%) blur(10px)',
  borderBottom: `1px solid ${BORDER}`,
}

const NAV_INNER: CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '16px 32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
}

const LOGO_WRAP: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
}

const HERO: CSSProperties = {
  padding: '64px 32px 96px',
  background:
    'radial-gradient(1200px 600px at 50% -10%, rgba(14,165,233,0.15), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(232,82,10,0.1), transparent 60%)',
}

const CONTAINER: CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  textAlign: 'center',
}

const EYEBROW: CSSProperties = {
  display: 'inline-block',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  color: ORANGE,
  backgroundColor: 'rgba(232,82,10,0.12)',
  border: '1px solid rgba(232,82,10,0.3)',
  padding: '6px 12px',
  borderRadius: 999,
  marginBottom: 20,
}

const H1: CSSProperties = {
  fontSize: 'clamp(34px, 4.6vw, 50px)',
  fontWeight: 800,
  lineHeight: 1.1,
  letterSpacing: -1,
  margin: '0 0 18px',
  color: WHITE,
}

const SUBTITLE: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.55,
  color: TEXT_MUTED,
  margin: '0 auto 36px',
  maxWidth: 560,
}

const FORM_CARD: CSSProperties = {
  backgroundColor: WHITE,
  borderRadius: 16,
  padding: 32,
  boxShadow: '0 30px 60px -20px rgba(0,0,0,0.55)',
  color: BLACK,
  textAlign: 'left',
  marginTop: 8,
}

const FORM_ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 14,
}

const FIELD: CSSProperties = {
  marginBottom: 14,
}

const LABEL: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: '#475569',
  marginBottom: 6,
}

const INPUT: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 15,
  color: BLACK,
  backgroundColor: WHITE,
  outline: 'none',
}

const TEXTAREA: CSSProperties = {
  ...INPUT,
  minHeight: 120,
  resize: 'vertical',
  fontFamily: 'inherit',
  lineHeight: 1.5,
}

const SUBMIT_BTN: CSSProperties = {
  marginTop: 8,
  width: '100%',
  minHeight: 48,
  backgroundColor: ORANGE,
  color: WHITE,
  fontSize: 15,
  fontWeight: 700,
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  boxShadow: '0 10px 24px -8px rgba(232,82,10,0.55)',
}

const ERROR_BOX: CSSProperties = {
  backgroundColor: '#FEF2F2',
  border: '1px solid #FCA5A5',
  color: '#B91C1C',
  fontSize: 13,
  borderRadius: 8,
  padding: '10px 12px',
  marginBottom: 14,
}

const SUCCESS_CARD: CSSProperties = {
  backgroundColor: '#ECFDF5',
  border: '1px solid #6EE7B7',
  color: '#065F46',
  fontSize: 17,
  lineHeight: 1.55,
  borderRadius: 12,
  padding: '32px 28px',
  textAlign: 'center',
  fontWeight: 600,
}

const FOOTER: CSSProperties = {
  padding: '32px 32px',
  borderTop: `1px solid ${BORDER}`,
  backgroundColor: NAVY_DEEP,
}

const FOOTER_INNER: CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 18,
}

const FOOTER_LINKS: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 24,
  flexWrap: 'wrap',
}

const FOOTER_LINK: CSSProperties = {
  color: TEXT_MUTED,
  fontSize: 13,
  textDecoration: 'none',
}

const COPYRIGHT: CSSProperties = {
  color: TEXT_DIMMER,
  fontSize: 13,
}

export default function DemoPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [goals, setGoals] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (submitting) return
    setError(null)

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !company.trim() || !jobTitle.trim()) {
      setError('Please complete every required field.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          goals: goals.trim(),
        }),
      })

      if (!res.ok) {
        let message = 'Something went wrong. Please try again.'
        try {
          const json = (await res.json()) as { error?: string }
          if (json.error) message = json.error
        } catch {
          // ignore
        }
        setError(message)
        return
      }

      setSuccess(true)
    } catch (err) {
      console.error('[demo] submit failed', err)
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={PAGE}>
      <nav style={NAV}>
        <div style={NAV_INNER}>
          <Link href="/" style={LOGO_WRAP}>
            <Image
              src="/images/logo.png"
              alt="Assembly AI"
              width={180}
              height={36}
              style={{ objectFit: 'contain' }}
              priority
            />
          </Link>
        </div>
      </nav>

      <section style={HERO}>
        <div style={CONTAINER}>
          <span style={EYEBROW}>Assembly AI</span>
          <h1 style={H1}>Request a Demo</h1>
          <p style={SUBTITLE}>
            See how Assembly AI turns buyer research into a complete GTM strategy in 2-4 weeks.
          </p>

          {success ? (
            <div style={SUCCESS_CARD}>
              Thank you! We will be in touch within 1 business day.
            </div>
          ) : (
            <form style={FORM_CARD} onSubmit={handleSubmit} noValidate>
              {error && <div style={ERROR_BOX}>{error}</div>}

              <div style={FORM_ROW}>
                <div>
                  <label htmlFor="demo-first" style={LABEL}>First Name</label>
                  <input
                    id="demo-first"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    style={INPUT}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="demo-last" style={LABEL}>Last Name</label>
                  <input
                    id="demo-last"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    style={INPUT}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div style={FIELD}>
                <label htmlFor="demo-email" style={LABEL}>Work Email</label>
                <input
                  id="demo-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={INPUT}
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div style={FIELD}>
                <label htmlFor="demo-company" style={LABEL}>Company</label>
                <input
                  id="demo-company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  style={INPUT}
                  autoComplete="organization"
                  required
                />
              </div>

              <div style={FIELD}>
                <label htmlFor="demo-title" style={LABEL}>Job Title</label>
                <input
                  id="demo-title"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  style={INPUT}
                  autoComplete="organization-title"
                  required
                />
              </div>

              <div style={FIELD}>
                <label htmlFor="demo-goals" style={LABEL}>What are you hoping to accomplish?</label>
                <textarea
                  id="demo-goals"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  style={TEXTAREA}
                  rows={5}
                />
              </div>

              <button type="submit" style={SUBMIT_BTN} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Request a Demo'}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer style={FOOTER}>
        <div style={FOOTER_INNER}>
          <Link href="/" style={LOGO_WRAP}>
            <Image
              src="/images/logo.png"
              alt="Assembly AI"
              width={150}
              height={30}
              style={{ objectFit: 'contain' }}
            />
          </Link>
          <div style={FOOTER_LINKS}>
            <Link href="/tos" style={FOOTER_LINK}>Terms of Service</Link>
            <Link href="/privacy" style={FOOTER_LINK}>Privacy Policy</Link>
            <a href="mailto:info@assemblynetworks.net" style={FOOTER_LINK}>Contact</a>
          </div>
          <div style={COPYRIGHT}>© 2026 Assembly Networks, LLC. All rights reserved.</div>
        </div>
      </footer>

      <style>{`
        input:focus, textarea:focus { border-color: ${BLUE} !important; box-shadow: 0 0 0 3px rgba(14,165,233,0.15); }
        button[disabled] { opacity: 0.7; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
