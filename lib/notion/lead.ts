/**
 * Mirrors inbound leads into the Notion "Leads & Inquiries (CRM)" database, so
 * leads from assemblyai.net land in the same place as leads from
 * assemblynetworks.net.
 *
 * This is a MIRROR, not the system of record. Supabase remains authoritative:
 * the admin panel reads from it and beta provisioning depends on it. Every
 * function here swallows its own errors and never throws, so a Notion outage
 * can never block a form submission or lose a lead.
 *
 * Environment variables (Vercel > Settings > Environment Variables):
 *   NOTION_TOKEN            secret from app.notion.com/developers/connections
 *   NOTION_DATA_SOURCE_ID   a04abaee-e97b-4edc-8760-3ce7d760382a
 *
 * If either is missing the mirror is skipped silently, which makes this safe to
 * deploy before the variables exist.
 */

import { INDUSTRIES, ANNUAL_REVENUES, SITUATIONS, HOW_HEARD, allowed } from '@/lib/forms/options'

const NOTION_VERSION = '2025-09-03'
const NOTION_ENDPOINT = 'https://api.notion.com/v1/pages'

/** Form names that exist as options on the Notion "Form" select property. */
export type NotionFormType = 'Request Demo' | 'Download Whitepaper'

export interface NotionLead {
  form: NotionFormType
  firstName?: string | null
  lastName?: string | null
  email: string
  company?: string | null
  jobTitle?: string | null
  /** Free text: "what you hope to accomplish" on the demo form. */
  goal?: string | null
  /** Free text: the situation description on the whitepaper form. */
  message?: string | null
  phone?: string | null
  industry?: string | null
  annualRevenue?: string | null
  /** Must be one of SITUATIONS to reach the Notion select. */
  situation?: string | null
  howHeard?: string | null
}

type NotionValue = Record<string, unknown>

const text = (value?: string | null): NotionValue | undefined =>
  value ? { rich_text: [{ text: { content: value.slice(0, 2000) } }] } : undefined

const select = (value: string | null | undefined, list: readonly string[]): NotionValue | undefined => {
  const ok = allowed(value, list)
  return ok ? { select: { name: ok } } : undefined
}

/**
 * Write one lead to Notion. Never throws and never rejects: callers should use
 * `void mirrorLeadToNotion(...)` so the response is not delayed by this call.
 */
export async function mirrorLeadToNotion(lead: NotionLead): Promise<void> {
  const token = process.env.NOTION_TOKEN
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID

  if (!token || !dataSourceId) {
    console.log('[notion] NOTION_TOKEN or NOTION_DATA_SOURCE_ID not set; skipping CRM mirror.')
    return
  }

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || lead.email

  const properties: Record<string, NotionValue> = {
    Name: { title: [{ text: { content: name.slice(0, 200) } }] },
    Email: { email: lead.email },
    Form: { select: { name: lead.form } },
    Stage: { select: { name: 'New' } },
    'Source Site': { select: { name: 'assemblyai.net' } },
  }

  if (lead.phone) properties.Phone = { phone_number: lead.phone.slice(0, 60) }

  const optional: Record<string, NotionValue | undefined> = {
    Company: text(lead.company),
    'Job Title': text(lead.jobTitle),
    Goal: text(lead.goal),
    Message: text(lead.message),
    Industry: select(lead.industry, INDUSTRIES),
    'Annual Revenue': select(lead.annualRevenue, ANNUAL_REVENUES),
    Situation: select(lead.situation, SITUATIONS),
    'How Heard': select(lead.howHeard, HOW_HEARD),
  }
  for (const [key, value] of Object.entries(optional)) {
    if (value) properties[key] = value
  }

  try {
    const res = await fetch(NOTION_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { type: 'data_source_id', data_source_id: dataSourceId },
        properties,
      }),
      // Do not let a hung Notion request keep a serverless function alive.
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      console.error('[notion] mirror failed', res.status, await res.text())
    }
  } catch (err) {
    console.error('[notion] mirror error:', err)
  }
}
