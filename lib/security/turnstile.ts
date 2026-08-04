/**
 * Server-side Cloudflare Turnstile verification.
 *
 * FAIL-OPEN WHEN UNCONFIGURED, FAIL-CLOSED WHEN CONFIGURED. If
 * TURNSTILE_SECRET_KEY is not set, verification is skipped so the forms keep
 * working (this is what makes it safe to deploy the code before adding the
 * variable in Vercel). Once the secret exists, a missing or invalid token is
 * rejected.
 *
 * If Cloudflare itself is unreachable or returns an error, we allow the
 * submission through. A real visitor should not lose a form fill because a
 * third party is having an outage; spam protection is not worth a lost lead.
 *
 * Environment variable (Vercel > Settings > Environment Variables):
 *   TURNSTILE_SECRET_KEY   same secret already used by assemblynetworks.net
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileResult {
  ok: boolean
  /** Present when ok is false, suitable for logging (not for the visitor). */
  reason?: string
}

export async function verifyTurnstile(
  token: string | null | undefined,
  ip: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.log('[turnstile] TURNSTILE_SECRET_KEY not set; skipping verification.')
    return { ok: true }
  }

  if (!token) return { ok: false, reason: 'missing-token' }

  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      console.error('[turnstile] siteverify HTTP', res.status)
      return { ok: true }
    }

    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (json.success) return { ok: true }
    return { ok: false, reason: (json['error-codes'] ?? []).join(',') || 'rejected' }
  } catch (err) {
    console.error('[turnstile] verify error:', err)
    return { ok: true }
  }
}
