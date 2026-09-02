/**
 * add-contact-submissions.ts — Contact Us Form Submissions
 *
 * Creates contact_submissions table with RLS enabled (no client access).
 * Inserts happen via the service role on the /api/contact route only.
 * Reads are super-admin only, also via service role. No client-side policies.
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-contact-submissions.ts
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
  console.log('\nAssembly AI — Add Contact Submissions Table')
  console.log('============================================\n')

  console.log('── contact_submissions ──')

  await run('create table', `
    create table if not exists contact_submissions (
      id         uuid        primary key default gen_random_uuid(),
      name       text,
      email      text        not null,
      company    text,
      message    text,
      ip_address text,
      handled_at timestamptz,
      created_at timestamptz not null default now()
    );
  `)

  await run('index on created_at', `
    create index if not exists contact_submissions_created_at_idx
      on contact_submissions (created_at desc);
  `)

  await run('enable row level security', `alter table contact_submissions enable row level security;`)
  await run('force row level security',  `alter table contact_submissions force row level security;`)

  // Inserts only happen through the service role on the /api/contact route, so no
  // public/auth INSERT policy is needed. Reads are super-admin only, also via
  // service role; no SELECT policy is needed either. RLS is enabled + forced to
  // block all client-side access by default.

  console.log('\n============================================')
  console.log('Done. contact_submissions table created.\n')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
