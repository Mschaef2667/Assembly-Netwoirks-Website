/**
 * Google Analytics 4 helpers for assemblyai.net (measurement ID G-WWS69LPR4J).
 *
 * PRIVACY RULE, do not break it: never pass personal data to GA4. No name, no
 * email, no phone, no job title, no free-text message. Google's terms forbid
 * sending personally identifiable information, and it is not needed here.
 * Categorical fields only.
 *
 * The marketing site (assemblynetworks.net, G-ZG44BWSYVQ) fires the same
 * `generate_lead` event with the same parameter names, so the two properties
 * stay comparable.
 */

export const GA_MEASUREMENT_ID = 'G-WWS69LPR4J'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** Non-personal lead attributes. Anything identifying a person is excluded by design. */
export interface LeadEventParams {
  /** Which form was submitted, e.g. "Request Demo". */
  form_name: string
  industry?: string
  annual_revenue?: string
  situation?: string
  how_heard?: string
}

/**
 * Fire the GA4 recommended `generate_lead` event. Safe to call anywhere: it is
 * a no-op when gtag has not loaded (ad blocker, server render, local dev).
 */
export function trackLead(params: LeadEventParams): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  try {
    window.gtag('event', 'generate_lead', {
      ...params,
      source_site: 'assemblyai.net',
    })
  } catch (err) {
    console.error('[ga] generate_lead failed', err)
  }
}
