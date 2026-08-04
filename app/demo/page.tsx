'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import { INDUSTRIES, ANNUAL_REVENUES, SITUATIONS, HOW_HEARD } from '@/lib/forms/options'
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
  maxWidth: 1200,
  margin: '0 auto',
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

const TWO_COL: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
  gap: 48,
  alignItems: 'start',
  textAlign: 'left',
}

const INFO_COL: CSSProperties = {
  paddingTop: 8,
}

const CHECK_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  marginBottom: 14,
  fontSize: 15,
  color: TEXT_MUTED,
}

const CHECK_ICON: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  flexShrink: 0,
  backgroundColor: 'rgba(14,165,233,0.12)',
  border: '1px solid rgba(14,165,233,0.3)',
  color: BLUE,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const QUOTE_BLOCK: CSSProperties = {
  marginTop: 36,
  padding: '20px 24px',
  borderLeft: `3px solid ${BLUE}`,
  backgroundColor: 'rgba(255,255,255,0.03)',
  borderRadius: '0 10px 10px 0',
}

const QUOTE_TXT: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  fontStyle: 'italic',
  color: WHITE,
  margin: '0 0 10px',
}

const QUOTE_ATTR: CSSProperties = {
  fontSize: 13,
  color: TEXT_DIMMER,
}

const FORM_NOTE: CSSProperties = {
  fontSize: 12.5,
  color: TEXT_DIMMER,
  textAlign: 'center',
  marginTop: 16,
  lineHeight: 1.6,
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

const SELECT: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  backgroundColor: 'rgba(255,255,255,0.04)',
  color: '#FFFFFF',
  fontSize: 15,
  outline: 'none',
  appearance: 'none',
  minHeight: 46,
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
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [goals, setGoals] = useState('')
  const [phone, setPhone] = useState('')
  const [industry, setIndustry] = useState('')
  const [annualRevenue, setAnnualRevenue] = useState('')
  const [situation, setSituation] = useState('')
  const [howHeard, setHowHeard] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (submitting) return
    setError(null)

    if (!fullName.trim() || !email.trim() || !company.trim() || !jobTitle.trim()) {
      setError('Please complete every required field.')
      return
    }
    if (!industry || !annualRevenue || !situation) {
      setError('Please choose an industry, revenue range, and situation.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: fullName.trim().split(/\s+/)[0] ?? '',
          lastName: fullName.trim().split(/\s+/).slice(1).join(' '),
          email: email.trim(),
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          goals: goals.trim(),
          phone: phone.trim(),
          industry,
          annualRevenue,
          situation,
          howHeard,
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
              src="/images/assembly-ai-logo.svg"
              alt="Assembly AI"
              width={180}
              height={33}
              style={{ objectFit: 'contain', height: 'auto' }}
              priority
            />
          </Link>
        </div>
      </nav>

      <section style={HERO}>
        <div style={CONTAINER}>
          <div style={TWO_COL}>
            <div style={INFO_COL}>
              <span style={EYEBROW}>Assembly AI&trade;</span>
              <h1 style={{ ...H1, textAlign: 'left' }}>See it on your business.</h1>
              <p style={{ ...SUBTITLE, textAlign: 'left', margin: '0 0 32px' }}>
                A 30-minute walkthrough using your industry, your buyers, and your competitive set.
                Not a canned tour. You will leave knowing whether this fits, either way.
              </p>

              {[
                '30 minutes, live, no recording required',
                'No credit card, no obligation',
                'We respond within one business day',
              ].map((t) => (
                <div key={t} style={CHECK_ROW}>
                  <span style={CHECK_ICON}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,7 6,11 12,3" />
                    </svg>
                  </span>
                  {t}
                </div>
              ))}
              <div style={CHECK_ROW}>
                <span style={CHECK_ICON}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="2" width="12" height="10" rx="1" />
                    <polyline points="1,3 7,8 13,3" />
                  </svg>
                </span>
                <a href="mailto:info@assemblynetworks.net" style={{ color: TEXT_MUTED, textDecoration: 'none' }}>
                  info@assemblynetworks.net
                </a>
              </div>

              <div style={QUOTE_BLOCK}>
                <p style={QUOTE_TXT}>
                  &ldquo;Not another tool. A complete system designed to think, align, and execute
                  the way your customers want you to.&rdquo;
                </p>
                <div style={QUOTE_ATTR}>Assembly AI&trade;</div>
              </div>
            </div>

            <div>
          {success ? (
            <div style={SUCCESS_CARD}>
              Thank you! We will be in touch within 1 business day.
            </div>
          ) : (
            <form style={FORM_CARD} onSubmit={handleSubmit} noValidate>
              {error && <div style={ERROR_BOX}>{error}</div>}

              <div style={FORM_ROW}>
                <div>
                  <label htmlFor="demo-name" style={LABEL}>Full Name</label>
                  <input
                    id="demo-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={INPUT}
                    autoComplete="name"
                    required
                  />
                </div>
                <div>
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
              </div>

              <div style={FORM_ROW}>
                <div>
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
                <div>
                  <label htmlFor="demo-phone" style={LABEL}>Phone <span style={{ opacity: 0.5 }}>(optional)</span></label>
                  <input
                    id="demo-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={INPUT}
                    autoComplete="tel"
                  />
                </div>
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
                <label htmlFor="demo-industry" style={LABEL}>Industry</label>
                <select
                  id="demo-industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  style={SELECT}
                  required
                >
                  <option value="">Select an industry</option>
                  {INDUSTRIES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div style={FIELD}>
                <label htmlFor="demo-revenue" style={LABEL}>Annual Revenue</label>
                <select
                  id="demo-revenue"
                  value={annualRevenue}
                  onChange={(e) => setAnnualRevenue(e.target.value)}
                  style={SELECT}
                  required
                >
                  <option value="">Select a range</option>
                  {ANNUAL_REVENUES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div style={FIELD}>
                <label htmlFor="demo-situation" style={LABEL}>Which best describes your situation?</label>
                <select
                  id="demo-situation"
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  style={SELECT}
                  required
                >
                  <option value="">Select one</option>
                  {SITUATIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div style={FIELD}>
                <label htmlFor="demo-heard" style={LABEL}>How did you hear about us? <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <select
                  id="demo-heard"
                  value={howHeard}
                  onChange={(e) => setHowHeard(e.target.value)}
                  style={SELECT}
                >
                  <option value="">Select one</option>
                  {HOW_HEARD.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
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

              <p style={FORM_NOTE}>
                30-minute walkthrough. No credit card required.
                <br />
                We respect your privacy. No spam, ever.{' '}
                <Link href="/privacy" style={{ color: TEXT_DIMMER }}>Privacy Policy</Link>.
              </p>
            </form>
          )}
            </div>
          </div>
        </div>
      </section>

      <footer style={FOOTER}>
        <div style={FOOTER_INNER}>
          <Link href="/" style={LOGO_WRAP}>
            <Image
              src="/images/assembly-ai-logo.svg"
              alt="Assembly AI"
              width={150}
              height={28}
              style={{ objectFit: 'contain', height: 'auto' }}
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
