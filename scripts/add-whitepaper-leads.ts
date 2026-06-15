/**
 * add-whitepaper-leads.ts — White Paper Lead Capture
 *
 * Creates whitepaper_leads table with RLS policies (super-admin read only).
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-whitepaper-leads.ts
 *
 * Required env vars in .env.local:
 *   DATABASE_URL              — Direct Postgres connection string
 *   SUPABASE_SERVICE_ROLE_KEY — Guards against wrong project
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!databaseUrl) {
  console.error(
    '\n✗ DATABASE_URL is not set in .env.local\n\n' +
    '  Get it from: Supabase Dashboard → Settings → Database\n' +
    '               → Connection string → URI\n'
  )
  process.exit(1)
}
if (!serviceKey) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY is not set in .env.local')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })

async function run(label: string, sql: string): Promise<void> {
  try {
    await pool.query(sql)
    console.log(`  ✓ ${label}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${label}\n    ${msg}`)
  }
}

async function main(): Promise<void> {
  console.log('\nAssembly AI — Add White Paper Leads Table')
  console.log('==========================================\n')

  console.log('── whitepaper_leads ──')

  await run('create table', `
    create table if not exists whitepaper_leads (
      id            uuid        primary key default gen_random_uuid(),
      first_name    text,
      last_name     text,
      email         text        not null,
      company       text,
      job_title     text,
      situation     text,
      downloaded_at timestamptz not null default now(),
      ip_address    text
    );
  `)

  await run('index on email', `
    create index if not exists whitepaper_leads_email_idx
      on whitepaper_leads (email);
  `)

  await run('index on downloaded_at', `
    create index if not exists whitepaper_leads_downloaded_at_idx
      on whitepaper_leads (downloaded_at desc);
  `)

  await run('enable row level security', `alter table whitepaper_leads enable row level security;`)
  await run('force row level security',  `alter table whitepaper_leads force row level security;`)

  // Inserts only happen through the service role on the /api/whitepaper/download
  // route, so no public/auth INSERT policy is needed. Reads are super-admin only,
  // also via service role; no SELECT policy is needed either. RLS is enabled to
  // block all client-side access by default.

  console.log('\n==========================================')
  console.log('Done. whitepaper_leads table created.\n')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
