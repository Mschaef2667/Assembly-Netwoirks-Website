'use client'

import { useRef, useState, type CSSProperties, type FormEvent } from 'react'
import Turnstile, { type TurnstileHandle } from '@/components/ui/Turnstile'
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
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
  minHeight: 140,
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

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const turnstileRef = useRef<TurnstileHandle | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (submitting) return
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setSubmitting(true)
    try {
      const turnstileToken = (await turnstileRef.current?.getToken()) ?? ''

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnstileToken,
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          message: message.trim(),
        }),
      })

      if (!res.ok) {
        let msg = 'Something went wrong. Please try again.'
        try {
          const json = (await res.json()) as { error?: string }
          if (json.error) msg = json.error
        } catch {
          // ignore
        }
        setError(msg)
        return
      }

      setSuccess(true)
    } catch (err) {
      console.error('[contact] submit failed', err)
      setError('Network error. Please try again.')
    } finally {
      turnstileRef.current?.reset()
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
              <span style={EYEBROW}>Contact Us</span>
              <h1 style={{ ...H1, textAlign: 'left' }}>Get in touch.</h1>
              <p style={{ ...SUBTITLE, textAlign: 'left', margin: '0 0 32px' }}>
                Questions about Assembly AI, pricing, or how it might fit your business?
                Send a note and we&apos;ll get back to you within one business day.
              </p>

              {[
                'We respond within one business day',
                'No sales pitch — a real reply from a real person',
                'Prefer email? info@assemblynetworks.net',
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
            </div>

            <div>
              {success ? (
                <div style={SUCCESS_CARD}>
                  Thanks — your message is in. We&apos;ll be in touch within 1 business day.
                </div>
              ) : (
                <form style={FORM_CARD} onSubmit={handleSubmit} noValidate>
                  {error && <div style={ERROR_BOX}>{error}</div>}

                  <div style={FIELD}>
                    <label htmlFor="contact-name" style={LABEL}>Name</label>
                    <input
                      id="contact-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={INPUT}
                      autoComplete="name"
                    />
                  </div>

                  <div style={FIELD}>
                    <label htmlFor="contact-email" style={LABEL}>Work Email</label>
                    <input
                      id="contact-email"
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
                    <label htmlFor="contact-company" style={LABEL}>Company <span style={{ opacity: 0.5 }}>(optional)</span></label>
                    <input
                      id="contact-company"
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      style={INPUT}
                      autoComplete="organization"
                    />
                  </div>

                  <div style={FIELD}>
                    <label htmlFor="contact-message" style={LABEL}>Message <span style={{ opacity: 0.5 }}>(optional)</span></label>
                    <textarea
                      id="contact-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      style={TEXTAREA}
                      rows={6}
                      placeholder="Tell us a bit about what you're looking for."
                    />
                  </div>

                  <Turnstile ref={turnstileRef} />

                  <button type="submit" style={SUBMIT_BTN} disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send Message'}
                  </button>

                  <p style={FORM_NOTE}>
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
            <a href="mailto:info@assemblynetworks.net" style={FOOTER_LINK}>Email</a>
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
