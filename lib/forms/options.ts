/**
 * Shared form option lists.
 *
 * These strings must match the select options on the Notion "Leads & Inquiries
 * (CRM)" database exactly, and must match the same lists used by the forms on
 * assemblynetworks.net. Notion rejects a select value that is not already an
 * option on the property, so changing a label here means changing it in Notion
 * too.
 */

export const INDUSTRIES = [
  'Enterprise Technology & SaaS',
  'Healthcare & Life Sciences',
  'Professional Services',
  'Financial Services & Fintech',
  'Non-Profit & Fundraising',
  'Manufacturing & Industrial',
  'Construction & Engineering',
  'Other',
] as const

export const ANNUAL_REVENUES = [
  '$0 to $500K',
  '$500K to $1M',
  '$1M to $10M',
  '$10M to $50M',
  '$50M +',
] as const

export const SITUATIONS = [
  'Launching a new product',
  'Sales and Marketing are misaligned',
  'Increasing competitive pressure',
  'Improve conversion & retention rates',
  'Better define or reposition our offerings',
  "Understand our customer's purchasing process",
  'Something else',
] as const

export const HOW_HEARD = [
  'Search',
  'AI assistant / LLM',
  'LinkedIn',
  'Referral',
  'Other',
] as const

/** Reject anything that is not on the list, rather than sending Notion a value it will refuse. */
export function allowed(value: string | null | undefined, list: readonly string[]): string | null {
  if (!value) return null
  return list.includes(value) ? value : null
}
