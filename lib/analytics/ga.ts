/**
 * Google Analytics 4 helpers for assemblyai.net.
 *
 * PRIVACY RULE, do not break it: never pass personal data to GA4. No name, no
 * email, no phone, no job title, no free-text message. Google's terms forbid
 * sending personally identifiable information, and it is not needed here.
 * Categorical fields only.
 *
 * BOTH SITES SHARE ONE MEASUREMENT ID ON PURPOSE. Cross-domain measurement
 * requires the same G- ID from the same web data stream, so assemblyai.net
 * reports into the marketing site's property. This keeps a visitor who moves
 * from assemblynetworks.net to assemblyai.net as one user on one session, and
 * preserves the original traffic source instead of recording a self-referral.
 * Split reports by the Hostname dimension when you want per-site numbers.
 *
 * The separate property G-WWS69LPR4J is intentionally unused. Do not switch
 * back to it without also accepting broken cross-domain attribution.
 */

export const GA_MEASUREMENT_ID = 'G-ZG44BWSYVQ'

/**
 * Hostnames that count as production for analytics. The GA4 tag is only loaded
 * on these hosts, so the dev environment, Vercel preview URLs, and localhost
 * never report into the live property. Exact-match allowlist on purpose: a dev
 * subdomain like dev.assemblyai.net must NOT be treated as production.
 */
export const GA_PRODUCTION_HOSTS: readonly string[] = [
  'assemblyai.net',
  'www.assemblyai.net',
  'assemblynetworks.net',
  'www.assemblynetworks.net',
]

export function isGaProductionHost(hostname: string): boolean {
  return GA_PRODUCTION_HOSTS.includes(hostname)
}

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
