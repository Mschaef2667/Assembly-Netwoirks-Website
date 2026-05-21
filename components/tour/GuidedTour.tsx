'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface TourStep {
  page: string
  targetId: string
  title: string
  body: string
  position: 'top' | 'right' | 'bottom' | 'left'
  skipOnTimeout?: boolean
}

interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
}

const TOUR_KEY = 'assembly_tour_state'

const TOUR_STEPS: TourStep[] = [
  {
    page: '/dashboard',
    targetId: 'widget-journey',
    title: 'Your GTM Command Center',
    body: 'Six stages each building on the last. Journey Progress shows exactly where your strategy stands at a glance — no guessing no spreadsheets.',
    position: 'bottom',
  },
  {
    page: '/dashboard',
    targetId: 'widget-gates',
    title: 'Governance Built In',
    body: 'Gates require leadership sign-off before messaging moves forward. Governance is built into the platform — not bolted on after.',
    position: 'top',
  },
  {
    page: '/dashboard',
    targetId: 'widget-score',
    title: 'Performance Score',
    body: 'A real-time measure of how complete and battle-ready your go-to-market strategy is. Every approved step moves this number.',
    position: 'left',
  },
  {
    page: '/dashboard/intelligence',
    targetId: 'intelligence-survey',
    title: 'Start With Listening',
    body: 'Build a Decision Clarity Process survey to understand exactly how your buyers decide — not just what they buy. Seven buying stages. Real data. Not assumptions.',
    position: 'bottom',
  },
  {
    page: '/dashboard/intelligence',
    targetId: 'intelligence-dcp',
    title: 'The Buyer Map',
    body: 'Assembly AI analyzes every response across all seven buying stages and builds a behavioral map of your buyer. Gate 1 must be approved before strategy begins — because if the foundation is wrong everything built on it is wrong.',
    position: 'top',
    skipOnTimeout: true,
  },
  {
    page: '/dashboard/journeys',
    targetId: 'journey-sections',
    title: '38 Steps. One Connected System.',
    body: 'Every step of the C3 Method organized across six stages. Each one builds on the last. Change something in Step 4 and it ripples forward through every downstream step automatically.',
    position: 'right',
  },
  {
    page: '/dashboard/journeys/step/4',
    targetId: 'step-pain-points',
    title: 'Three Real Buyer Problems',
    body: 'These are the endemic problems your buyers actually experience — surfaced from real DCP survey data not assumptions. Every downstream step is linked to these three pain points.',
    position: 'bottom',
  },
  {
    page: '/dashboard/journeys/step/11',
    targetId: 'step-cvp',
    title: 'AI Writing Your Messaging',
    body: 'Click Copilot Draft and watch Assembly AI write a compelling value proposition specific to this buyer this pain point and this company. Not generic. Not interchangeable.',
    position: 'bottom',
  },
  {
    page: '/dashboard/journeys/step/11',
    targetId: 'step-cvp-copilot-panel',
    title: 'Messaging That Knows Your Buyer',
    body: 'See the Copilot panel on the right — click Draft for Invisible Pipeline Risk and watch Assembly AI write messaging specific to this buyer, this pain point, and this company. Not generic. Not interchangeable.',
    position: 'top',
  },
  {
    page: '/dashboard/journeys/step/17',
    targetId: 'step-competitive',
    title: 'Live Competitive Intelligence',
    body: 'Assembly AI searches the live web right now to find your competitors — known players adjacent tools and emerging threats — all organized by relevance to your specific ICP and pain points.',
    position: 'bottom',
  },
  {
    page: '/dashboard/journeys',
    targetId: 'journey-report-btn',
    title: 'Generate the Strategic Plan',
    body: 'Every approved step compiles into one complete document. Click Generate Report to build your C3 Method Strategic Plan.',
    position: 'top',
  },
  {
    page: '/dashboard/journeys',
    targetId: 'journey-report-btn',
    title: 'Your Plan. Ready to Share.',
    body: 'Download as PDF or Word. Share with your board your sales team or your next investor meeting. This document used to cost 50000 dollars and six months of consulting work. Assembly AI produces it in days.',
    position: 'left',
  },
]

function SpotlightOverlay({ rect }: { rect: SpotlightRect | null }) {
  const PAD = 12
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[200] h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id="tour-mask">
          <rect width="100%" height="100%" fill="white" />
          {rect && (
            <rect
              x={rect.x - PAD}
              y={rect.y - PAD}
              width={rect.width + PAD * 2}
              height={rect.height + PAD * 2}
              rx={10}
              fill="black"
            />
          )}
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(6,14,26,0.85)"
        mask="url(#tour-mask)"
      />
    </svg>
  )
}

function TourCard({
  step,
  index,
  total,
  cardPos,
  onNext,
  onSkip,
  visible,
}: {
  step: TourStep
  index: number
  total: number
  cardPos: { top: number; left: number }
  onNext: () => void
  onSkip: () => void
  visible: boolean
}) {
  return (
    <div
      className="fixed z-[300] w-80 rounded-2xl border p-5 shadow-2xl"
      style={{
        top: cardPos.top,
        left: cardPos.left,
        background: '#0A1628',
        borderColor: 'rgba(14,165,233,0.3)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.93)',
        transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: visible ? 'all' : 'none',
      }}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.5px]" style={{ color: '#0EA5E9' }}>
        Step {index + 1} of {total}
      </p>
      <h3 className="mb-2 text-[15px] font-bold leading-tight" style={{ color: '#F8F6F1' }}>
        {step.title}
      </h3>
      <p className="mb-5 text-[13px] leading-relaxed" style={{ color: 'rgba(248,246,241,0.68)' }}>
        {step.body}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full transition-colors duration-200"
              style={{ background: i === index ? '#E8520A' : 'rgba(255,255,255,0.15)' }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSkip}
            className="rounded-md border px-3 py-1.5 text-xs"
            style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#6B7280', background: 'transparent' }}
          >
            Skip
          </button>
          <button
            onClick={onNext}
            className="rounded-md px-4 py-1.5 text-xs font-semibold text-white"
            style={{ background: '#E8520A' }}
          >
            {index === total - 1 ? 'Finish ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function useGuidedTour() {
  const router = useRouter()
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 })
  const [cardVisible, setCardVisible] = useState(false)

  // Refs so effects/callbacks always see latest values without stale closures
  const activeRef = useRef(false)
  const stepIndexRef = useRef(0)
  activeRef.current = active
  stepIndexRef.current = stepIndex

  const pollGenRef = useRef(0)
  const nextRef = useRef<() => void>(() => {})
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const CARD_W = 320
  const CARD_H = 200
  const GAP = 18

  const computePositions = useCallback((step: TourStep): boolean => {
    const el = document.getElementById(step.targetId)
    if (!el) return false
    const rect = el.getBoundingClientRect()
    setSpotlightRect({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top = 0
    let left = 0
    switch (step.position) {
      case 'right':
        left = rect.right + GAP
        top = rect.top + rect.height / 2 - CARD_H / 2
        break
      case 'left':
        left = rect.left - GAP - CARD_W
        top = rect.top + rect.height / 2 - CARD_H / 2
        break
      case 'top':
        left = rect.left + rect.width / 2 - CARD_W / 2
        top = rect.top - GAP - CARD_H
        break
      default:
        left = rect.left + rect.width / 2 - CARD_W / 2
        top = rect.bottom + GAP
        break
    }
    left = Math.max(16, Math.min(left, vw - CARD_W - 16))
    top = Math.max(16, Math.min(top, vh - CARD_H - 16))
    setCardPos({ top, left })
    return true
  }, [])

  // Retry-based show: pages may need time to load data before target elements appear
  const showStepWhenReady = useCallback((index: number, initialDelay = 200) => {
    const step = TOUR_STEPS[index]
    if (!step) return
    console.log(`[Tour] showStepWhenReady(${index}): target=${step.targetId} page=${step.page}`)
    setCardVisible(false)

    const gen = ++pollGenRef.current
    let attempts = 0
    const tryShow = () => {
      if (gen !== pollGenRef.current) return
      if (computePositions(step)) {
        console.log(`[Tour] Element found: ${step.targetId} (attempt ${attempts + 1})`)
        setTimeout(() => setCardVisible(true), 80)
        return
      }
      attempts++
      if (attempts < 60) {
        setTimeout(tryShow, 150)
      } else {
        console.log(`[Tour] TIMEOUT: Element not found: ${step.targetId} after ${attempts} attempts`)
        if (step.skipOnTimeout) {
          console.log(`[Tour] skipOnTimeout: advancing to next step`)
          nextRef.current()
        }
      }
    }
    setTimeout(tryShow, initialDelay)
  }, [computePositions])

  function persistState(idx: number) {
    try {
      localStorage.setItem(TOUR_KEY, JSON.stringify({ active: true, stepIndex: idx }))
    } catch { /* non-fatal */ }
  }

  function clearPersistedState() {
    try {
      localStorage.removeItem(TOUR_KEY)
    } catch { /* non-fatal */ }
  }

  // On mount: restore an active tour from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOUR_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { active: boolean; stepIndex: number }
      if (!saved.active) return
      const idx = saved.stepIndex
      if (idx < 0 || idx >= TOUR_STEPS.length) return
      const step = TOUR_STEPS[idx]
      setStepIndex(idx)
      setActive(true)
      if (pathname === step.page) {
        showStepWhenReady(idx)
      } else {
        router.push(step.page)
      }
    } catch { /* non-fatal */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After navigation: show the current step if we just arrived on its page
  useEffect(() => {
    setCardVisible(false)
    setSpotlightRect(null)
    if (!activeRef.current) return
    const idx = stepIndexRef.current
    const step = TOUR_STEPS[idx]
    console.log(`[Tour] pathname → ${pathname}, stepIndex=${idx}, step.page=${step?.page}`)
    if (!step || pathname !== step.page) return
    showStepWhenReady(idx, 500)
  }, [pathname, showStepWhenReady])

  const start = useCallback(() => {
    const firstStep = TOUR_STEPS[0]
    setStepIndex(0)
    setActive(true)
    persistState(0)
    if (pathname !== firstStep.page) {
      router.push(firstStep.page)
    } else {
      showStepWhenReady(0)
    }
  }, [pathname, router, showStepWhenReady])

  const end = useCallback(() => {
    setCardVisible(false)
    setSpotlightRect(null)
    clearPersistedState()
    setTimeout(() => setActive(false), 300)
  }, [])

  const next = useCallback(() => {
    const current = stepIndexRef.current
    const nextIndex = current + 1
    console.log(`[Tour] next() called: current=${current} → next=${nextIndex} (pathname=${pathname})`)
    if (nextIndex >= TOUR_STEPS.length) {
      console.log('[Tour] Tour complete, ending.')
      end()
      return
    }
    const nextStep = TOUR_STEPS[nextIndex]
    // Update ref immediately so the pathname effect reads the correct index
    // even if it fires before the React re-render commits the new stepIndex state.
    stepIndexRef.current = nextIndex
    setStepIndex(nextIndex)
    persistState(nextIndex)
    console.log(`[Tour] Step ${nextIndex}: page=${nextStep.page}, target=${nextStep.targetId}`)
    if (nextStep.page === pathnameRef.current) {
      showStepWhenReady(nextIndex)
    } else {
      setCardVisible(false)
      setSpotlightRect(null)
      console.log(`[Tour] Navigating from ${pathnameRef.current} → ${nextStep.page}`)
      router.push(nextStep.page)
    }
  }, [router, end, showStepWhenReady])

  nextRef.current = next

  return { active, start, next, end, stepIndex, spotlightRect, cardPos, cardVisible }
}

export default function GuidedTour() {
  const { active, start, next, end, stepIndex, spotlightRect, cardPos, cardVisible } = useGuidedTour()

  return (
    <>
      {!active && (
        <button
          onClick={start}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
          style={{
            background: '#E8520A',
            boxShadow: '0 4px 24px rgba(232,82,10,0.4)',
          }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Take the Tour
        </button>
      )}
      {active && spotlightRect && (
        <SpotlightOverlay rect={spotlightRect} />
      )}
      {active && spotlightRect && (
        <TourCard
          step={TOUR_STEPS[stepIndex]}
          index={stepIndex}
          total={TOUR_STEPS.length}
          cardPos={cardPos}
          onNext={next}
          onSkip={end}
          visible={cardVisible}
        />
      )}
    </>
  )
}
