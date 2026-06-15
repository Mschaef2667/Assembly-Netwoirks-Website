import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Assembly AI — Stop Guessing. Start Winning.',
  description:
    'Assembly AI transforms real buyer research into a complete go-to-market strategy. The only platform that makes you earn your strategy before you execute it.',
}

const NAVY = '#0A1628'
const ORANGE = '#E8520A'
const BLUE = '#0EA5E9'
const WHITE = '#FFFFFF'
const TEXT_MUTED = 'rgba(255,255,255,0.6)'
const TEXT_DIMMER = 'rgba(255,255,255,0.5)'
const BORDER = 'rgba(255,255,255,0.08)'
const SURFACE = 'rgba(255,255,255,0.03)'

const PAGE: CSSProperties = {
  backgroundColor: NAVY,
  color: WHITE,
  minHeight: '100vh',
  fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  scrollBehavior: 'smooth',
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

const NAV_LINKS: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 32,
}

const NAV_LINK: CSSProperties = {
  color: TEXT_MUTED,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
}

const NAV_ACTIONS: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
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

const BTN_PRIMARY: CSSProperties = {
  backgroundColor: ORANGE,
  color: WHITE,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  padding: '10px 18px',
  borderRadius: 8,
  border: 'none',
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 14px rgba(232,82,10,0.35)',
}

const BTN_OUTLINE: CSSProperties = {
  color: WHITE,
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
  padding: '14px 22px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.25)',
  minHeight: 48,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const BTN_HERO_PRIMARY: CSSProperties = {
  backgroundColor: ORANGE,
  color: WHITE,
  fontSize: 15,
  fontWeight: 700,
  textDecoration: 'none',
  padding: '14px 26px',
  borderRadius: 10,
  border: 'none',
  minHeight: 48,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 8px 24px rgba(232,82,10,0.4)',
}

const HERO: CSSProperties = {
  position: 'relative',
  padding: '96px 32px 120px',
  textAlign: 'center',
  background:
    'radial-gradient(1200px 600px at 50% -10%, rgba(14,165,233,0.18), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(232,82,10,0.12), transparent 60%), linear-gradient(180deg, #0A1628 0%, #0A1628 100%)',
  overflow: 'hidden',
}

const HERO_INNER: CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
}

const EYEBROW: CSSProperties = {
  display: 'inline-block',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  color: BLUE,
  backgroundColor: 'rgba(14,165,233,0.1)',
  border: '1px solid rgba(14,165,233,0.25)',
  padding: '6px 12px',
  borderRadius: 999,
  marginBottom: 24,
}

const H1: CSSProperties = {
  fontSize: 'clamp(40px, 6vw, 64px)',
  fontWeight: 800,
  lineHeight: 1.05,
  letterSpacing: -1.2,
  margin: '0 0 20px',
  color: WHITE,
}

const HERO_SUB: CSSProperties = {
  fontSize: 'clamp(16px, 1.6vw, 19px)',
  lineHeight: 1.6,
  color: TEXT_MUTED,
  maxWidth: 720,
  margin: '0 auto 36px',
}

const HERO_CTAS: CSSProperties = {
  display: 'flex',
  gap: 14,
  justifyContent: 'center',
  flexWrap: 'wrap',
}

const SECTION: CSSProperties = {
  padding: '96px 32px',
  borderTop: `1px solid ${BORDER}`,
}

const SECTION_INNER: CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
}

const SECTION_HEADER: CSSProperties = {
  textAlign: 'center',
  marginBottom: 56,
}

const H2: CSSProperties = {
  fontSize: 'clamp(28px, 4vw, 40px)',
  fontWeight: 700,
  letterSpacing: -0.6,
  margin: '0 0 12px',
  color: WHITE,
}

const SECTION_SUB: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.6,
  color: TEXT_MUTED,
  maxWidth: 640,
  margin: '0 auto',
}

const GRID_3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 24,
}

const GRID_3_FEATURES: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: 20,
}

const CARD: CSSProperties = {
  backgroundColor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: 28,
}

const PROBLEM_NUM: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: ORANGE,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  marginBottom: 12,
}

const PROBLEM_TEXT: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.5,
  fontWeight: 600,
  color: WHITE,
  margin: 0,
}

const STEP_NUM: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  backgroundColor: 'rgba(14,165,233,0.12)',
  border: '1px solid rgba(14,165,233,0.3)',
  color: BLUE,
  fontWeight: 700,
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 18,
}

const STEP_TITLE: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: WHITE,
  margin: '0 0 10px',
}

const STEP_BODY: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: TEXT_MUTED,
  margin: 0,
}

const FEATURE_ICON: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  backgroundColor: 'rgba(14,165,233,0.12)',
  border: '1px solid rgba(14,165,233,0.3)',
  color: BLUE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 16,
}

const FEATURE_TITLE: CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: WHITE,
  margin: '0 0 8px',
}

const FEATURE_BODY: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.55,
  color: TEXT_MUTED,
  margin: 0,
}

const QUOTE_CARD: CSSProperties = {
  maxWidth: 820,
  margin: '0 auto',
  backgroundColor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 40,
  textAlign: 'center',
}

const QUOTE_MARK: CSSProperties = {
  fontSize: 48,
  lineHeight: 1,
  color: ORANGE,
  fontWeight: 700,
  marginBottom: 8,
}

const QUOTE_TEXT: CSSProperties = {
  fontSize: 20,
  lineHeight: 1.55,
  color: WHITE,
  fontWeight: 500,
  margin: '0 0 24px',
}

const QUOTE_CITE: CSSProperties = {
  fontSize: 14,
  color: TEXT_MUTED,
  fontStyle: 'normal',
}

const CTA_SECTION: CSSProperties = {
  padding: '96px 32px',
  textAlign: 'center',
  background:
    'radial-gradient(800px 400px at 50% 50%, rgba(232,82,10,0.18), transparent 70%), linear-gradient(180deg, #0A1628 0%, #0A1628 100%)',
  borderTop: `1px solid ${BORDER}`,
}

const FOOTER: CSSProperties = {
  padding: '40px 32px',
  borderTop: `1px solid ${BORDER}`,
  backgroundColor: '#06101F',
}

const FOOTER_INNER: CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 20,
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

const LOGO_WRAP: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
}

const LOGO_TEXT: CSSProperties = {
  color: WHITE,
  fontWeight: 800,
  fontSize: 28,
  letterSpacing: -0.4,
}

const PROBLEMS = [
  'You build ICPs from guesswork, not buyer research',
  'Your messaging misses what buyers actually care about',
  'Your strategy changes every quarter because it was never grounded in reality',
]

const STEPS = [
  {
    title: 'Intelligence',
    body:
      'Survey your buyers across 4 audiences. Our Decision Clarity Process maps exactly how they make decisions.',
  },
  {
    title: 'Strategy',
    body:
      'Complete 38 structured steps. Copilot uses your buyer research to generate positioning, messaging, and competitive strategy.',
  },
  {
    title: 'Plan',
    body:
      'Generate your complete Strategic Plan. A full GTM playbook grounded in real buyer intelligence.',
  },
]

const FEATURES = [
  {
    title: 'Decision Clarity Process',
    body: 'Map your buyer’s 7-stage decision journey.',
  },
  {
    title: 'AI Copilot',
    body: 'Every step guided by Claude-powered intelligence.',
  },
  {
    title: 'Competitive Intelligence',
    body: 'Discover and position against your Select Set.',
  },
  {
    title: 'Strategic Messages',
    body: 'Set-Up, Jab, Knock-Out, Clean-Up messaging system.',
  },
  {
    title: 'Action Plan',
    body: '38-step journey from research to executable strategy.',
  },
  {
    title: 'Strategic Plan PDF',
    body: 'Download your complete GTM playbook.',
  },
]

function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" style={LOGO_WRAP}>
      <Image
        src="/images/logo.png"
        alt="Assembly AI"
        width={size}
        height={size}
        style={{ borderRadius: 6, objectFit: 'contain' }}
        priority
      />
    </Link>
  )
}

function IconIntel() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconStrategy() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  )
}

function IconPlan() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

const STEP_ICONS = [<IconIntel key="i" />, <IconStrategy key="s" />, <IconPlan key="p" />]

function IconDCP() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
    </svg>
  )
}
function IconCopilot() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.39 4.84L20 8l-4 3.89.94 5.48L12 14.77 7.06 17.37 8 11.89 4 8l5.61-1.16L12 2z" />
    </svg>
  )
}
function IconCompete() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V2h12v7" />
      <path d="M6 9a6 6 0 0 0 12 0" />
      <path d="M12 15v7" />
      <path d="M8 22h8" />
    </svg>
  )
}
function IconMessages() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function IconAction() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
    </svg>
  )
}
function IconPDF() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <polyline points="9 15 12 12 15 15" />
    </svg>
  )
}
const FEATURE_ICONS = [
  <IconDCP key="1" />,
  <IconCopilot key="2" />,
  <IconCompete key="3" />,
  <IconMessages key="4" />,
  <IconAction key="5" />,
  <IconPDF key="6" />,
]

export default function LandingPage() {
  return (
    <div style={PAGE}>
      <nav style={NAV}>
        <div style={NAV_INNER}>
          <Logo size={200} />
          <div style={NAV_LINKS} className="landing-nav-links">
            <a href="#how-it-works" style={NAV_LINK}>
              How It Works
            </a>
            <a href="#features" style={NAV_LINK}>
              Features
            </a>
            <a href="#pricing" style={NAV_LINK}>
              Pricing
            </a>
          </div>
          <div style={NAV_ACTIONS}>
            <Link href="/auth/login" style={BTN_GHOST}>
              Sign In
            </Link>
            <Link href="/auth/signup" style={BTN_PRIMARY}>
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section style={HERO}>
        <div style={HERO_INNER}>
          <span style={EYEBROW}>The C3 Method Operating System</span>
          <h1 style={H1}>Stop Guessing. Start Winning.</h1>
          <p style={HERO_SUB}>
            Assembly AI transforms real buyer research into a complete go-to-market strategy —
            automatically. The only platform that makes you earn your strategy before you execute it.
          </p>
          <div style={HERO_CTAS}>
            <Link href="/auth/signup" style={BTN_HERO_PRIMARY}>
              Request a Demo
            </Link>
            <Link href="/whitepaper" style={BTN_OUTLINE}>
              Download White Paper
            </Link>
            <a href="#how-it-works" style={BTN_OUTLINE}>
              See How It Works
            </a>
          </div>
        </div>
      </section>

      <section style={SECTION} id="problem">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>Most GTM strategies are built on assumptions</h2>
            <p style={SECTION_SUB}>
              The result: positioning that doesn’t land, messaging that misses, and roadmaps that get
              rewritten every quarter.
            </p>
          </div>
          <div style={GRID_3}>
            {PROBLEMS.map((text, i) => (
              <div key={i} style={CARD}>
                <div style={PROBLEM_NUM}>Problem {i + 1}</div>
                <p style={PROBLEM_TEXT}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={SECTION} id="how-it-works">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>Earn your strategy. Ground every decision in buyer truth.</h2>
            <p style={SECTION_SUB}>
              Three phases that move you from buyer research to executable GTM strategy.
            </p>
          </div>
          <div style={GRID_3}>
            {STEPS.map((s, i) => (
              <div key={s.title} style={CARD}>
                <div style={STEP_NUM}>{STEP_ICONS[i]}</div>
                <h3 style={STEP_TITLE}>
                  {i + 1}. {s.title}
                </h3>
                <p style={STEP_BODY}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={SECTION} id="features">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>Everything you need to build a buyer-led GTM strategy</h2>
            <p style={SECTION_SUB}>
              A complete operating system for the C3 Method — from research to Strategic Plan.
            </p>
          </div>
          <div style={GRID_3_FEATURES}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={CARD}>
                <div style={FEATURE_ICON}>{FEATURE_ICONS[i]}</div>
                <h3 style={FEATURE_TITLE}>{f.title}</h3>
                <p style={FEATURE_BODY}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={SECTION} id="pricing">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>Built on 20+ years of B2B GTM expertise</h2>
          </div>
          <div style={QUOTE_CARD}>
            <div style={QUOTE_MARK}>“</div>
            <p style={QUOTE_TEXT}>
              Assembly AI operationalizes the C3 Method — a proven go-to-market framework developed
              over two decades of B2B sales and marketing consulting.
            </p>
            <div style={QUOTE_CITE}>— Michael Schaefer, Founder</div>
          </div>
        </div>
      </section>

      <section style={CTA_SECTION}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2 style={H2}>Ready to build a strategy your buyers actually respond to?</h2>
          <p style={{ ...SECTION_SUB, marginBottom: 32 }}>
            Request a Demo and get early access to Assembly AI.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/auth/signup" style={BTN_HERO_PRIMARY}>
              Request a Demo
            </Link>
            <Link href="/whitepaper" style={BTN_OUTLINE}>
              Download White Paper
            </Link>
          </div>
        </div>
      </section>

      <footer style={FOOTER}>
        <div style={FOOTER_INNER}>
          <Logo size={180} />
          <div style={FOOTER_LINKS}>
            <Link href="/tos" style={FOOTER_LINK}>
              Terms of Service
            </Link>
            <Link href="/privacy" style={FOOTER_LINK}>
              Privacy Policy
            </Link>
            <a href="mailto:info@assemblynetworks.net" style={FOOTER_LINK}>
              Contact
            </a>
          </div>
          <div style={COPYRIGHT}>© 2026 Assembly Networks, LLC. All rights reserved.</div>
        </div>
      </footer>

      <style>{`
        html { scroll-behavior: smooth; }
        a:hover { opacity: 0.9; }
        @media (max-width: 720px) {
          .landing-nav-links { display: none !important; }
        }
      `}</style>
    </div>
  )
}
