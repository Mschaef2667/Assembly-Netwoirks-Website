'use client'

/**
 * Cloudflare Turnstile widget for the public marketing forms on assemblyai.net.
 *
 * Mirrors the behaviour of js/forms.js on assemblynetworks.net so both sites
 * behave identically for a visitor:
 *   - Managed mode with appearance 'interaction-only', so the widget stays
 *     invisible unless Cloudflare actually decides a challenge is warranted.
 *   - One widget per form.
 *   - Tokens are single use and expire after 300s, so the widget is reset
 *     after every submit attempt.
 *
 * The SITE key is public by design and safe in client code. The SECRET key is
 * only ever read server-side from TURNSTILE_SECRET_KEY.
 */

import { useEffect, useImperativeHandle, useRef, type RefObject } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** Public site key. Overridable per environment, with the live key as default. */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAEFgM5sp8nayFAd_'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
  execute: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export interface TurnstileHandle {
  /**
   * Resolve the current token, waiting for the widget if it has not produced
   * one yet. Resolves to '' rather than rejecting, so a form can still decide
   * to submit when the challenge is unavailable.
   */
  getToken: () => Promise<string>
  /** Clear the token so the next submit gets a fresh one. */
  reset: () => void
}

/** Load the Turnstile script exactly once per page, no matter how many forms mount. */
let scriptPromise: Promise<boolean> | null = null

function loadScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.turnstile) return Promise.resolve(true)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const el = existing ?? document.createElement('script')
    if (!existing) {
      el.src = SCRIPT_SRC
      el.async = true
      el.defer = true
      document.head.appendChild(el)
    }
    el.addEventListener('load', () => resolve(true))
    el.addEventListener('error', () => resolve(false))
    // Never hang a form submit on a blocked or slow script.
    setTimeout(() => resolve(!!window.turnstile), 10000)
  })

  return scriptPromise
}

export default function Turnstile({ ref }: { ref: RefObject<TurnstileHandle | null> }) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)
  const token = useRef<string>('')
  const pending = useRef<((value: string) => void) | null>(null)
  const ready = useRef<Promise<boolean> | null>(null)

  useEffect(() => {
    let cancelled = false

    ready.current = loadScript().then((ok) => {
      if (!ok || cancelled || !boxRef.current || !window.turnstile) return false
      // React 18+ StrictMode double-invokes effects in dev; guard re-render.
      if (widgetId.current !== null) return true

      widgetId.current = window.turnstile.render(boxRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: 'interaction-only',
        callback: (t: string) => {
          token.current = t
          if (pending.current) {
            pending.current(t)
            pending.current = null
          }
        },
        'expired-callback': () => {
          token.current = ''
        },
        'error-callback': () => {
          token.current = ''
          if (pending.current) {
            pending.current('')
            pending.current = null
          }
        },
      })
      return true
    })

    return () => {
      cancelled = true
      if (widgetId.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current)
        } catch {
          // widget already gone
        }
        widgetId.current = null
      }
    }
  }, [])

  useImperativeHandle(
    ref,
    (): TurnstileHandle => ({
      async getToken() {
        await (ready.current ?? Promise.resolve(false))
        if (!window.turnstile || widgetId.current === null) return ''
        if (token.current) return token.current

        return new Promise<string>((resolve) => {
          pending.current = resolve
          try {
            window.turnstile?.execute(widgetId.current as string)
          } catch {
            // Managed mode runs on its own; execute is a no-op there.
          }
          // Do not leave the submit button spinning forever.
          setTimeout(() => {
            if (pending.current) {
              pending.current('')
              pending.current = null
            }
          }, 20000)
        })
      },
      reset() {
        token.current = ''
        if (widgetId.current !== null && window.turnstile) {
          try {
            window.turnstile.reset(widgetId.current)
          } catch {
            // ignore
          }
        }
      },
    }),
    [],
  )

  return <div ref={boxRef} style={{ margin: '0.5rem 0', display: 'flex', justifyContent: 'center' }} />
}
