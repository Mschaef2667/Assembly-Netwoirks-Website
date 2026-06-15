'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { WHITEPAPER } from '@/lib/whitepaper/content'

const NAVY = '#0A1628'
const NAVY_DEEP = '#06101F'
const ORANGE = '#E8520A'
const BLUE = '#0EA5E9'
const WHITE = '#FFFFFF'
const BLACK = '#0D0D0D'
const TEXT_MUTED = 'rgba(255,255,255,0.65)'
const TEXT_DIMMER = 'rgba(255,255,255,0.5)'
const BORDER = 'rgba(255,255,255,0.1)'
const SURFACE = 'rgba(255,255,255,0.03)'

const SITUATIONS = [
  'Building new',
  'Validating existing',
  'Refreshing stale',
  'Just exploring',
] as const

// ── Styles ────────────────────────────────────────────────────────────────────

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

const BTN_GHOST: CSSProperties = {
  color: WHITE,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  padding: '10px 16px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const HERO: CSSProperties = {
  padding: '64px 32px 96px',
  background:
    'radial-gradient(1200px 600px at 50% -10%, rgba(14,165,233,0.15), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(232,82,10,0.1), transparent 60%)',
}

const GRID: CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
  gap: 48,
  alignItems: 'start',
}

const LEFT_COL: CSSProperties = { color: WHITE }

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
  margin: '0 0 28px',
  maxWidth: 560,
}

const PREVIEW_CARD: CSSProperties = {
  backgroundColor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: 28,
  marginTop: 8,
}

const PREVIEW_LABEL: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  color: BLUE,
  marginBottom: 14,
}

const PREVIEW_HEAD: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: WHITE,
  margin: '0 0 14px',
}

const BULLET_LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const BULLET_ITEM: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  color: TEXT_MUTED,
  fontSize: 14,
  lineHeight: 1.55,
}

const BULLET_DOT: CSSProperties = {
  flexShrink: 0,
  width: 6,
  height: 6,
  borderRadius: 999,
  backgroundColor: ORANGE,
  marginTop: 8,
}

const TRUST_ROW: CSSProperties = {
  marginTop: 28,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  color: TEXT_DIMMER,
  fontSize: 13,
}

// Form ─────────

const FORM_CARD: CSSProperties = {
  backgroundColor: WHITE,
  borderRadius: 16,
  padding: 32,
  boxShadow: '0 30px 60px -20px rgba(0,0,0,0.55)',
  color: BLACK,
}

const FORM_TITLE: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  margin: '0 0 6px',
  color: NAVY,
}

const FORM_SUB: CSSProperties = {
  fontSize: 14,
  color: '#475569',
  margin: '0 0 22px',
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
  ...INPUT,
  appearance: 'none',
  backgroundImage:
    'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\' fill=\'none\'><path d=\'M1 1l5 5 5-5\' stroke=\'%2364748B\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 38,
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

const SMALL_PRINT: CSSProperties = {
  fontSize: 12,
  color: '#64748B',
  margin: '14px 0 0',
  textAlign: 'center',
  lineHeight: 1.5,
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

const SUCCESS_BOX: CSSProperties = {
  backgroundColor: '#ECFDF5',
  border: '1px solid #6EE7B7',
  color: '#047857',
  fontSize: 14,
  borderRadius: 8,
  padding: '14px 16px',
  marginBottom: 14,
  lineHeight: 1.5,
}

// Footer ───────

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

// ── Bullets shown on the preview card ────────────────────────────────────────

const PREVIEW_BULLETS = [
  'Why most B2B GTM strategies collapse within 9 months — and the structural cause.',
  'The 7-stage Decision Clarity Profile that turns buyer interviews into a usable artifact.',
  'How to build an Ideal Customer Profile that survives contact with the pipeline.',
  'The Set-Up · Jab · Knock-Out · Clean-Up messaging model in plain language.',
  'A working blueprint for the 38-step Strategic Plan and how to operationalize it.',
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WhitepaperPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [situation, setSituation] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (submitting) return
    setError(null)
    setSuccess(false)

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !company.trim() || !jobTitle.trim() || !situation) {
      setError('Please complete every field before downloading.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/whitepaper/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          situation,
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

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'assembly-ai-whitepaper.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setSuccess(true)
    } catch (err) {
      console.error('[whitepaper] download failed', err)
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
          <Link href="/auth/signup" style={BTN_GHOST}>
            Request Beta Access
          </Link>
        </div>
      </nav>

      <section style={HERO}>
        <div style={GRID} className="wp-grid">
          <div style={LEFT_COL}>
            <span style={EYEBROW}>Free White Paper · {WHITEPAPER.publicationDate}</span>
            <h1 style={H1}>{WHITEPAPER.title}</h1>
            <p style={SUBTITLE}>{WHITEPAPER.subtitle}</p>

            <div style={PREVIEW_CARD}>
              <div style={PREVIEW_LABEL}>What You&rsquo;ll Learn</div>
              <h3 style={PREVIEW_HEAD}>A buyer-led approach to B2B go-to-market strategy</h3>
              <ul style={BULLET_LIST}>
                {PREVIEW_BULLETS.map((b) => (
                  <li key={b} style={BULLET_ITEM}>
                    <span style={BULLET_DOT} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={TRUST_ROW}>
              <span>Authored by {WHITEPAPER.author}, {WHITEPAPER.organization}</span>
              <span>·</span>
              <span>{WHITEPAPER.sections.length} sections · PDF</span>
            </div>
          </div>

          <div>
            <form style={FORM_CARD} onSubmit={handleSubmit} noValidate>
              <h2 style={FORM_TITLE}>Download the white paper</h2>
              <p style={FORM_SUB}>Enter your details to download a PDF copy instantly.</p>

              {error && <div style={ERROR_BOX}>{error}</div>}
              {success && (
                <div style={SUCCESS_BOX}>
                  Thank you. Your download should have started — check your downloads folder if it didn&rsquo;t.
                </div>
              )}

              <div style={FORM_ROW}>
                <div>
                  <label htmlFor="wp-first" style={LABEL}>First Name</label>
                  <input
                    id="wp-first"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    style={INPUT}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="wp-last" style={LABEL}>Last Name</label>
                  <input
                    id="wp-last"
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
                <label htmlFor="wp-email" style={LABEL}>Work Email</label>
                <input
                  id="wp-email"
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
                <label htmlFor="wp-company" style={LABEL}>Company Name</label>
                <input
                  id="wp-company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  style={INPUT}
                  autoComplete="organization"
                  required
                />
              </div>

              <div style={FIELD}>
                <label htmlFor="wp-title" style={LABEL}>Job Title</label>
                <input
                  id="wp-title"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  style={INPUT}
                  autoComplete="organization-title"
                  required
                />
              </div>

              <div style={FIELD}>
                <label htmlFor="wp-situation" style={LABEL}>What best describes your situation?</label>
                <select
                  id="wp-situation"
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  style={SELECT}
                  required
                >
                  <option value="" disabled>Select one…</option>
                  {SITUATIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <button type="submit" style={SUBMIT_BTN} disabled={submitting}>
                {submitting ? 'Preparing your PDF…' : 'Download Now'}
              </button>

              <p style={SMALL_PRINT}>
                We respect your privacy. No spam, ever.
                <br />
                See our <Link href="/privacy" style={{ color: '#0284C7', textDecoration: 'underline' }}>Privacy Policy</Link>.
              </p>
            </form>
          </div>
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
        @media (max-width: 900px) {
          .wp-grid { grid-template-columns: 1fr !important; }
        }
        input:focus, select:focus { border-color: ${BLUE} !important; box-shadow: 0 0 0 3px rgba(14,165,233,0.15); }
        button[disabled] { opacity: 0.7; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
