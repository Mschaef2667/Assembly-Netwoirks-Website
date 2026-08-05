/**
 * The four "best customer" categories that drive the ICP Calibrator.
 *
 * These are deliberately qualitative. An SMB owner can answer "who is my most
 * profitable customer" from memory, accurately, without having clean CRM data to
 * export. That is the whole point: the input is judgment, not a data dump.
 *
 * The categories are captured when a response is logged (interview transcript or
 * manual entry) rather than collected up front, so the client tags a customer at
 * the moment they are already thinking about that person.
 *
 * IMPORTANT: every category here describes a customer who likes you. They are for
 * choosing among CURRENT customers only. Lost customers and prospects remain
 * separate audiences, or the research just confirms what the client already
 * believes. The client guides say the same thing.
 *
 * This list is the single source of truth. The database column is plain text on
 * purpose so this file stays the only place the values are defined.
 */

export interface CustomerCategory {
  value: string
  /** Shown in the dropdown. */
  label: string
  /** One-line clarification, so two clients interpret the category the same way. */
  hint: string
}

export const CUSTOMER_CATEGORIES: readonly CustomerCategory[] = [
  {
    value: 'Most Profitable',
    label: 'Most Profitable',
    hint: 'Best margin, not simply the biggest invoice',
  },
  {
    value: 'Most Loyal',
    label: 'Most Loyal',
    hint: 'Renews without drama, stayed through a problem',
  },
  {
    value: 'Most Influential',
    label: 'Most Influential',
    hint: 'Sends referrals and opens doors to new customers',
  },
  {
    value: 'Highest Growth Potential',
    label: 'Highest Growth Potential',
    hint: 'Small today, could be much bigger',
  },
] as const

/** Reject anything not on the list rather than storing a value nothing can read. */
export function allowedCustomerCategory(value: string | null | undefined): string | null {
  if (!value) return null
  return CUSTOMER_CATEGORIES.some(c => c.value === value) ? value : null
}

/**
 * Only current customers get categorised. Lost customers, prospects, and the
 * internal team are not "best customers" and tagging them would be meaningless.
 */
export function categoryAppliesTo(audience: string): boolean {
  return audience === 'current'
}
