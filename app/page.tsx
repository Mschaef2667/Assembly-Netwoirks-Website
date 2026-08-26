import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: { absolute: 'Assembly AI — Go-to-Market Strategy Built on Buyer Truth' },
  description:
    'An AI-native go-to-market operating system built on the C3 Method. We ask your buyers the right questions, in the right order, then turn what they say into your positioning, messaging, and engagement plan.',
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

const HERO_NOTE: CSSProperties = {
  fontSize: 13,
  color: TEXT_DIMMER,
  marginTop: 18,
  maxWidth: 560,
  marginLeft: 'auto',
  marginRight: 'auto',
  lineHeight: 1.6,
}

const SECTION_FOOTNOTE: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: TEXT_MUTED,
  maxWidth: 680,
  margin: '32px auto 0',
  textAlign: 'center',
}

const C3_STAGE_ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: 10,
  marginTop: 40,
}

const C3_STAGE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderRadius: 999,
  border: `1px solid ${BORDER}`,
  backgroundColor: SURFACE,
  fontSize: 14,
  color: WHITE,
  whiteSpace: 'nowrap',
}

const C3_STAGE_NUM: CSSProperties = {
  color: ORANGE,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
  gap: 24,
}

const GRID_3_FEATURES: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
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
  fontSize: 15,
  lineHeight: 1.65,
  fontWeight: 400,
  color: TEXT_MUTED,
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
  {
    persona: 'Head of Sales',
    title: 'Every deal needs a different story, and you are making them up.',
    body:
      'Marketing sends leads that do not convert. You build your own pitch on the fly, deal by deal. Nobody can tell you why you won the last one or lost the one before it.',
  },
  {
    persona: 'Head of Marketing',
    title: 'You are guessing at what buyers care about.',
    body:
      'Campaigns get built from what the team thinks resonates. Some months work, some do not, and there is no reliable way to know which lever moved anything.',
  },
  {
    persona: 'Owner',
    title: 'Growth depends on you being in the room.',
    body:
      'Nothing is written down, so the story changes depending on who tells it. You cannot hand this to anyone because it lives in your head.',
  },
]

const REASSURANCE = [
  {
    title: 'Nothing to learn',
    body: 'Every question is asked in plain language. If you know your business, you can answer it.',
  },
  {
    title: 'Nothing to schedule',
    body: 'Work through it at your pace. Stop, come back, pick up where you left off.',
  },
  {
    title: 'Nothing to build',
    body: 'The plan writes itself as you answer, then exports finished.',
  },
]

type Stage = 'live' | 'building' | 'service'

const FLYWHEEL = [
  { n: 1, label: 'Strategy',       x: 380, y: 110, lx: 380, ly: 54,  anchor: 'middle' as const, stage: 'live'     as Stage, note: 'Available now' },
  { n: 2, label: 'ICP Calibrator', x: 545, y: 205, lx: 590, ly: 185, anchor: 'start'  as const, stage: 'live'     as Stage, note: 'Available now' },
  { n: 3, label: 'Idea Filter',    x: 545, y: 395, lx: 590, ly: 427, anchor: 'start'  as const, stage: 'building' as Stage, note: 'In development' },
  { n: 4, label: 'Fit Check',      x: 380, y: 490, lx: 380, ly: 560, anchor: 'middle' as const, stage: 'building' as Stage, note: 'In development' },
  { n: 5, label: 'Integrations',   x: 215, y: 395, lx: 170, ly: 427, anchor: 'end'    as const, stage: 'service'  as Stage, note: '' },
  { n: 6, label: 'Performance',    x: 215, y: 205, lx: 170, ly: 185, anchor: 'end'    as const, stage: 'service'  as Stage, note: '' },
]

const FLYWHEEL_ARROWS = [
  { x: 475, y: 135, rot: 30 },
  { x: 570, y: 300, rot: 90 },
  { x: 475, y: 465, rot: 150 },
  { x: 285, y: 465, rot: 210 },
  { x: 190, y: 300, rot: 270 },
  { x: 285, y: 135, rot: 330 },
]

const C3_STAGES = [
  'Need',
  'Motivation',
  'Search',
  'Evaluation',
  'Select Set',
  'Decision',
  'Confirmation',
]

const MODULES = [
  {
    title: '1. Strategy',
    body:
      'The C3 Method journey you can run today. Buyer research in, a complete go-to-market plan out.',
    tag: 'Available now',
    stage: 'live' as Stage,
  },
  {
    title: '2. ICP Calibrator',
    body:
      'Sharpen exactly who you should be selling to, using what your buyers told you rather than a guess.',
    tag: 'Available now',
    stage: 'live' as Stage,
  },
  {
    title: '3. Idea Filter',
    body:
      'Filter and score marketing ideas against your buyer intelligence and calibrated ICP, so you know which to pursue and which to skip.',
    tag: 'In development',
    stage: 'building' as Stage,
  },
  {
    title: '4. Fit Check',
    body: 'Check which opportunities and companies in front of you fit your calibrated profile, so you spend time on the right ones.',
    tag: 'In development',
    stage: 'building' as Stage,
  },
  {
    title: '5. Integrations',
    body:
      'Push all of it into your CRM and marketing automation so the work happens where your team already works. Can be set up manually in the meantime.',
    tag: 'Available as a service',
    stage: 'service' as Stage,
  },
  {
    title: '6. Performance',
    body:
      'Measure what happened and feed it back into the strategy. Designed to show a problem four to six weeks before it reaches revenue, while there is still time to fix it.',
    tag: 'Available as a service',
    stage: 'service' as Stage,
  },
]


const STEPS = [
  {
    title: 'Ask your buyers',
    body:
      'Surveys go out to four groups: your team, current customers, customers you lost, and prospects. You do not write them. Assembly AI does, based on your business. This is the part almost nobody does, and it is why most strategy is guesswork.',
  },
  {
    title: 'Answer the questions',
    body:
      'Guided steps, each one drafted for you by AI Copilot using what your buyers actually said. You review, adjust, and move on. Thirty-eight in total, so nothing important gets skipped.',
  },
  {
    title: 'Get the plan',
    body:
      'A complete go-to-market playbook in PDF and Word. ICP, positioning, messaging, competitive strategy, and a 30/60/90 day engagement plan. Board-ready, and more importantly, team-ready.',
  },
]

const FEATURES = [
  {
    title: 'Decision Clarity Process',
    body: 'The record of how your buyers actually decide, across all seven stages.',
  },
  {
    title: 'AI Copilot',
    body: 'Drafts every step for you using your buyer research, not generic advice.',
  },
  {
    title: 'Competitive Intelligence',
    body: 'Find out who you are really being compared against, and position against them.',
  },
  {
    title: 'Strategic Messages',
    body: 'What to say at each stage of the decision, and in what order.',
  },
  {
    title: 'Engagement Plan',
    body: 'A 30/60/90 day plan your team can pick up and run.',
  },
  {
    title: 'Your Plan, Exported',
    body: 'The whole playbook in PDF and Word, ready to share.',
  },
]

function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" style={LOGO_WRAP}>
      <Image
        src="/images/assembly-ai-logo.svg"
        alt="Assembly AI"
        width={size}
        height={Math.round(size / 5.4252)}
        style={{ objectFit: 'contain', height: 'auto' }}
        priority
      />
    </Link>
  )
}

function Flywheel() {
  return (
    <svg
      className="flywheel-svg"
      viewBox="0 0 760 600"
      role="img"
      aria-label="The Assembly AI loop: Strategy, ICP Calibrator, Idea Filter, Fit Check, Integrations, Performance, and back to Strategy"
      style={{ width: '100%', maxWidth: 720, height: 'auto', display: 'block', margin: '0 auto' }}
    >
      {/* the loop itself */}
      <circle cx="380" cy="300" r="190" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" strokeDasharray="6 8" />

      {/* direction of travel */}
      {FLYWHEEL_ARROWS.map((a, i) => (
        <path
          key={i}
          d="M -7 -6 L 7 0 L -7 6 Z"
          fill="rgba(255,255,255,0.28)"
          transform={`translate(${a.x} ${a.y}) rotate(${a.rot})`}
        />
      ))}

      {/* centre */}
      <text x="380" y="292" textAnchor="middle" fill={ORANGE} fontSize="13" fontWeight="700" letterSpacing="2.4">
        ASSEMBLY AI
      </text>
      <text x="380" y="316" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="13">
        every loop sharpens the next
      </text>

      {/* stages */}
      {FLYWHEEL.map((s) => (
        <g key={s.n}>
          <circle
            cx={s.x}
            cy={s.y}
            r="30"
            fill={s.stage === 'live' ? ORANGE : 'rgba(10,22,40,1)'}
            stroke={
              s.stage === 'live'
                ? ORANGE
                : s.stage === 'building'
                  ? 'rgba(232,82,10,0.7)'
                  : 'rgba(255,255,255,0.28)'
            }
            strokeWidth="2"
            strokeDasharray={s.stage === 'building' ? '5 4' : undefined}
          />
          <text
            x={s.x}
            y={s.y + 6}
            textAnchor="middle"
            fill={s.stage === 'live' ? WHITE : 'rgba(255,255,255,0.75)'}
            fontSize="16"
            fontWeight="700"
          >
            {s.n}
          </text>
          <text
            x={s.lx}
            y={s.ly}
            textAnchor={s.anchor}
            fill={s.stage === 'service' ? 'rgba(255,255,255,0.7)' : WHITE}
            fontSize="15"
            fontWeight={s.stage === 'live' ? 700 : 500}
          >
            {s.label}
          </text>
          {s.note && (
            <text
              x={s.lx}
              y={s.ly + 18}
              textAnchor={s.anchor}
              fill={s.stage === 'live' ? ORANGE : 'rgba(232,82,10,0.8)'}
              fontSize="11"
              fontWeight="700"
              letterSpacing="1.4"
            >
              {s.note.toUpperCase()}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

/**
 * Phone version of the loop.
 *
 * The circle is the right picture on a laptop, but at ~311px of usable width it
 * renders at 41% scale, which puts its labels at 4 to 6 pixels tall. A vertical
 * list keeps every module name legible and still reads as a sequence; the closing
 * row carries the "it loops" idea that the circle conveys geometrically.
 *
 * Which one is visible is decided purely in CSS, so there is no layout shift and
 * no client-side width measurement.
 */
function FlywheelList() {
  const last = FLYWHEEL.length - 1
  return (
    <ol
      className="flywheel-list"
      aria-label="The Assembly AI loop, in order"
      style={{ listStyle: 'none', margin: '0 auto', padding: 0, maxWidth: 420 }}
    >
      {FLYWHEEL.map((s, i) => (
        <li key={s.n} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 700,
                color: s.stage === 'live' ? WHITE : 'rgba(255,255,255,0.75)',
                backgroundColor: s.stage === 'live' ? ORANGE : 'rgba(10,22,40,1)',
                border: `2px ${s.stage === 'building' ? 'dashed' : 'solid'} ${
                  s.stage === 'live'
                    ? ORANGE
                    : s.stage === 'building'
                      ? 'rgba(232,82,10,0.7)'
                      : 'rgba(255,255,255,0.28)'
                }`,
              }}
            >
              {s.n}
            </span>
            {i < last && <span style={{ flex: 1, width: 2, minHeight: 22, backgroundColor: 'rgba(255,255,255,0.14)' }} />}
          </div>
          <div style={{ paddingTop: 5, paddingBottom: i < last ? 18 : 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: s.stage === 'live' ? 700 : 500,
                color: s.stage === 'service' ? 'rgba(255,255,255,0.7)' : WHITE,
              }}
            >
              {s.label}
            </div>
            {s.note && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  marginTop: 3,
                  color: s.stage === 'live' ? ORANGE : 'rgba(232,82,10,0.8)',
                }}
              >
                {s.note.toUpperCase()}
              </div>
            )}
          </div>
        </li>
      ))}
      <li style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10 }}>
        <span style={{ width: 34, textAlign: 'center', fontSize: 18, color: 'rgba(255,255,255,0.35)' }}>&#8635;</span>
        <span style={{ fontSize: 14, lineHeight: 1.45, color: 'rgba(255,255,255,0.55)' }}>
          Back to Strategy. Every loop sharpens the next.
        </span>
      </li>
    </ol>
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
            <a href="#c3-method" style={NAV_LINK}>
              The C3 Method
            </a>
            <a href="#coming-next" style={NAV_LINK}>
              Coming Next
            </a>
            <a
              href="https://assemblynetworks.net/contact.html"
              target="_blank"
              rel="noopener"
              style={NAV_LINK}
            >
              Contact
            </a>
          </div>
          <div style={NAV_ACTIONS}>
            <Link href="/auth/login" style={BTN_GHOST}>
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      <section style={HERO}>
        <div style={HERO_INNER}>
          <span style={EYEBROW}>Now in Beta · Limited Seats</span>
          <h1 style={H1}>Your buyers already know why you win. Now it is time to ask them.</h1>
          <p style={{ color: BLUE, fontWeight: 700, fontSize: 18, letterSpacing: 0.2, margin: '0 0 20px' }}>Get aligned. Stay aligned.</p>
          <p style={HERO_SUB}>
            Assembly AI is an AI-native go-to-market operating system built on the C3 Method. We ask
            your buyers the right questions, in the right order, then turn what they say into your
            positioning, messaging, and engagement plan. You do not need a GTM expert on staff. You need
            the questions answered.
          </p>
          <div style={HERO_CTAS}>
            <Link href="/demo" style={BTN_HERO_PRIMARY}>
              Request a Demo
            </Link>
            <Link href="/whitepaper" style={BTN_OUTLINE}>
              Download the White Paper
            </Link>
          </div>
          <p style={HERO_NOTE}>30-minute walkthrough. No credit card required.</p>
        </div>
      </section>

      <section style={SECTION} id="problem">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>Three ways this shows up. Same root cause.</h2>
          </div>
          <div style={GRID_3}>
            {PROBLEMS.map((p) => (
              <div key={p.persona} style={CARD}>
                <div style={PROBLEM_NUM}>{p.persona}</div>
                <h3 style={STEP_TITLE}>{p.title}</h3>
                <p style={PROBLEM_TEXT}>{p.body}</p>
              </div>
            ))}
          </div>
          <p style={SECTION_FOOTNOTE}>
            Underneath all three is the same thing. Your go-to-market is built on what your team
            assumes rather than what your buyers said.
          </p>
        </div>
      </section>

      <section style={SECTION} id="guided">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>You do not have to be a strategist. You have to answer the questions.</h2>
            <p style={SECTION_SUB}>
              Strategy work usually fails at small companies for a simple reason. It arrives as a
              blank page. Nobody knows where to start, so it stays a project for someday.
            </p>
            <p style={SECTION_SUB}>
              Assembly AI removes the blank page. It asks one clear question at a time, in plain
              language, in an order refined over twenty years. You answer using what you already know
              about your business. The strategy assembles itself as you go.
            </p>
            <p style={SECTION_SUB}>
              No frameworks to learn. No consultant to translate. No deck to build from scratch.
            </p>
          </div>
          <div style={GRID_3}>
            {REASSURANCE.map((r) => (
              <div key={r.title} style={CARD}>
                <h3 style={FEATURE_TITLE}>{r.title}</h3>
                <p style={FEATURE_BODY}>{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={SECTION} id="how-it-works">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>Three phases. One complete strategy.</h2>
            <p style={SECTION_SUB}>
              From asking your buyers to a finished plan your team can run.
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
          <div style={{ ...CARD, marginTop: 24 }}>
            <h3 style={FEATURE_TITLE}>About asking the ones you lost</h3>
            <p style={FEATURE_BODY}>
              Most people assume that conversation will be awkward. It rarely is. Buyers who chose
              someone else are often the most willing to talk and the most honest, and many
              appreciate being asked, because it leaves the door open for next time. It is usually
              the most valuable feedback you will get all year. If reaching out still feels
              uncomfortable, we can run those conversations for you.
            </p>
          </div>
        </div>
      </section>

      <section style={SECTION} id="features">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>Not another marketing tool.</h2>
            <p style={SECTION_SUB}>
              Every output traces back to what your buyers actually said, not to best practices
              pulled from someone else&rsquo;s business.
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

      <section style={SECTION} id="c3-method">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>
              What the <span style={{ color: ORANGE }}>C3 Method</span> actually is
            </h2>
            <p style={SECTION_SUB}>
              Customer-Centric Communication. A structured way of mapping how B2B buyers really
              decide, refined over twenty years of go-to-market work. It says a buying decision
              moves through seven stages, and that each stage needs different proof from you.
            </p>
            <p style={SECTION_SUB}>
              Most companies pitch the same way at every stage. The C3 Method is how you stop doing
              that, and it is the framework every step of Assembly AI is built on.
            </p>
          </div>

          <div style={C3_STAGE_ROW}>
            {C3_STAGES.map((stage, i) => (
              <div key={stage} style={C3_STAGE}>
                <span style={C3_STAGE_NUM}>{String(i + 1).padStart(2, '0')}</span>
                <span>{stage}</span>
              </div>
            ))}
          </div>

          <p style={{ ...SECTION_FOOTNOTE, marginBottom: 48 }}>
            <a
              href="https://assemblynetworks.net/c3-method.html"
              target="_blank"
              rel="noopener"
              style={{ color: BLUE, textDecoration: 'none', fontWeight: 600 }}
            >
              See the full C3 Method, including the walkthrough video →
            </a>
          </p>

          <div style={QUOTE_CARD}>
            <div style={QUOTE_MARK}>“</div>
            <p style={QUOTE_TEXT}>
              Traditional GTM consulting runs $75K to $225K over three to six months. For most
              companies that is not expensive, it is impossible. Assembly AI puts the same method
              in your hands in two to four weeks.
            </p>
            <div style={QUOTE_CITE}>— Michael Schaefer, Founder</div>
          </div>
        </div>
      </section>

      <section style={SECTION} id="coming-next">
        <div style={SECTION_INNER}>
          <div style={SECTION_HEADER}>
            <h2 style={H2}>One loop. Each turn sharper than the last.</h2>
            <p style={SECTION_SUB}>
              Strategy tells you who to sell to and what to say. Execution tells you whether you
              were right. Assembly AI is being built as a closed loop, so what you learn in market
              feeds straight back into the strategy instead of getting lost.
            </p>
            <p style={SECTION_SUB}>
              Steps one and two are in the platform today and step three is in development. The rest
              is not software yet, but the loop still closes. Our team or your agency can run those
              stages by hand while the modules are built. Nothing waits on a release date.
            </p>
            <p style={{ ...SECTION_SUB, marginTop: 16, color: WHITE }}>
              You do not buy the whole loop at once. Everyone starts with Strategy, then adds the
              next module when they are ready. Each one runs on what the one before it produced,
              which is why a lead list from here is built on evidence instead of a filter.
            </p>
          </div>

          <div style={{ margin: '48px 0 8px' }}>
            <Flywheel />
            <FlywheelList />
          </div>

          <div style={GRID_3_FEATURES}>
            {MODULES.map((m) => (
              <div
                key={m.title}
                style={{
                  ...CARD,
                  borderColor: m.stage === 'live' ? 'rgba(232,82,10,0.45)' : BORDER,
                }}
              >
                <div
                  style={{
                    ...PROBLEM_NUM,
                    color: m.stage === 'service' ? TEXT_DIMMER : ORANGE,
                  }}
                >
                  {m.tag}
                </div>
                <h3 style={FEATURE_TITLE}>{m.title}</h3>
                <p style={FEATURE_BODY}>{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={CTA_SECTION}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h2 style={H2}>See it on your business.</h2>
          <p style={{ ...SECTION_SUB, marginBottom: 32 }}>
            A 30-minute walkthrough using your industry, your buyers, and your competitors. Not a
            canned tour. You will leave knowing whether this fits, either way.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/demo" style={BTN_HERO_PRIMARY}>
              Request a Demo
            </Link>
            <Link href="/whitepaper" style={BTN_OUTLINE}>
              Download the White Paper
            </Link>
          </div>
          <p style={{ ...HERO_NOTE, marginTop: 24 }}>
            Everyone starts with Strategy. Add modules when you are ready. Rather not do it alone?
            We can pair you with a practitioner who knows the system, or run the whole thing as your
            agency. Ask about it on the demo.
          </p>
        </div>
      </section>

      <footer style={FOOTER}>
        <div style={FOOTER_INNER}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Logo size={180} />
            <span style={{ color: BLUE, fontSize: 13, fontWeight: 600, letterSpacing: 0.2 }}>Get aligned. Stay aligned.</span>
          </div>
          <div style={FOOTER_LINKS}>
            <Link href="/tos" style={FOOTER_LINK}>
              Terms of Service
            </Link>
            <Link href="/privacy" style={FOOTER_LINK}>
              Privacy Policy
            </Link>
            <a
              href="https://assemblynetworks.net/contact.html"
              target="_blank"
              rel="noopener"
              style={FOOTER_LINK}
            >
              Contact
            </a>
          </div>
          <div style={COPYRIGHT}>© 2026 Assembly Networks, LLC. All rights reserved.</div>
        </div>
      </footer>

      <style>{`
        html { scroll-behavior: smooth; }
        a:hover { opacity: 0.9; }
        .flywheel-list { display: none; }
        @media (max-width: 720px) {
          .landing-nav-links { display: none !important; }
          .flywheel-svg { display: none !important; }
          .flywheel-list { display: block; }
        }
      `}</style>
    </div>
  )
}
