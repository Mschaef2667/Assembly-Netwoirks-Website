import posthog from 'posthog-js'

let initialized = false

function ensureInit(): void {
  if (initialized || typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false,
    autocapture: false,
  })
  initialized = true
}

export function captureEvent(event: string, properties: Record<string, unknown>): void {
  ensureInit()
  if (typeof window === 'undefined') return
  posthog.capture(event, properties)
}
