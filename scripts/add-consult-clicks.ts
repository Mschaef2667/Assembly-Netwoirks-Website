/**
 * add-consult-clicks.ts — 30-min Consult Click Logger
 *
 * Creates consult_clicks table with RLS enabled (no client access).
 * Rows are inserted from a service-role API route each time a visitor clicks
 * a "Book 30-min consult" CTA (which then redirects to the external Google
 * Calendar scheduler). user_id / org_id are nullable — most clicks come from
 * unauthenticated visitors and stay null.
 *
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-consult-clicks.ts
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
  console.log('\nAssembly AI — Add Consult Clicks Table')
  console.log('=======================================\n')

  console.log('── consult_clicks ──')

  await run('create table', `
    create table if not exists consult_clicks (
      id          uuid        primary key default gen_random_uuid(),
      user_id     uuid        references users(id)         on delete set null,
      org_id      uuid        references organizations(id) on delete set null,
      source_page text,
      clicked_at  timestamptz not null default now()
    );
  `)

  await run('index on clicked_at', `
    create index if not exists consult_clicks_clicked_at_idx
      on consult_clicks (clicked_at desc);
  `)

  await run('enable row level security', `alter table consult_clicks enable row level security;`)
  await run('force row level security',  `alter table consult_clicks force row level security;`)

  // Inserts only happen through the service role on the click-logger API route,
  // so no public/auth INSERT policy is needed. Reads are super-admin only, also
  // via service role; no SELECT policy is needed either. RLS is enabled + forced
  // to block all client-side access by default.

  console.log('\n=======================================')
  console.log('Done. consult_clicks table created.\n')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
