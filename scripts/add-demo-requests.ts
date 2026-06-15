/**
 * add-demo-requests.ts — Demo Request Lead Capture
 *
 * Creates demo_requests table with RLS enabled (no client access).
 * Inserts and reads happen via the service role on /api/demo routes only.
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-demo-requests.ts
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
  console.log('\nAssembly AI — Add Demo Requests Table')
  console.log('==========================================\n')

  console.log('── demo_requests ──')

  await run('create table', `
    create table if not exists demo_requests (
      id           uuid        primary key default gen_random_uuid(),
      first_name   text,
      last_name    text,
      email        text        not null,
      company      text,
      job_title    text,
      goals        text,
      submitted_at timestamptz not null default now(),
      ip_address   text
    );
  `)

  await run('index on email', `
    create index if not exists demo_requests_email_idx
      on demo_requests (email);
  `)

  await run('index on submitted_at', `
    create index if not exists demo_requests_submitted_at_idx
      on demo_requests (submitted_at desc);
  `)

  await run('enable row level security', `alter table demo_requests enable row level security;`)
  await run('force row level security',  `alter table demo_requests force row level security;`)

  // Inserts only happen through the service role on the /api/demo route, so no
  // public/auth INSERT policy is needed. Reads are super-admin only, also via
  // service role; no SELECT policy is needed either. RLS is enabled to block
  // all client-side access by default.

  console.log('\n==========================================')
  console.log('Done. demo_requests table created.\n')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
