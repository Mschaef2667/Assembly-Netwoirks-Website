/**
 * add-beta-agreements-table.ts — Beta Agreement Acceptance Tracking
 *
 * Creates beta_agreements table with RLS policies.
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-beta-agreements-table.ts
 *
 * Required env vars in .env.local:
 *   DATABASE_URL              — Direct Postgres connection string
 *   SUPABASE_SERVICE_ROLE_KEY — Guards against wrong project
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { Pool } from 'pg'

// ─── Env validation ───────────────────────────────────────────────────────────

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

// ─── Postgres client ──────────────────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\nAssembly AI — Add Beta Agreements Table')
  console.log('========================================\n')

  console.log('── beta_agreements ──')

  await run('create table', `
    create table if not exists beta_agreements (
      id                uuid        primary key default gen_random_uuid(),
      user_id           uuid        not null references auth.users(id),
      org_id            uuid        not null,
      agreed_at         timestamptz default now(),
      ip_address        text,
      agreement_version text        default 'beta-v1',
      user_agent        text
    );
  `)

  await run('enable row level security', `alter table beta_agreements enable row level security;`)
  await run('force row level security',  `alter table beta_agreements force row level security;`)

  await run('drop + create INSERT policy (own user)', `
    drop policy if exists "beta_agreements_insert_own_user" on beta_agreements;
    create policy "beta_agreements_insert_own_user"
      on beta_agreements for insert
      with check (user_id = auth.uid());
  `)

  await run('drop + create SELECT policy (own user)', `
    drop policy if exists "beta_agreements_select_own_user" on beta_agreements;
    create policy "beta_agreements_select_own_user"
      on beta_agreements for select
      using (user_id = auth.uid());
  `)

  console.log('\n========================================')
  console.log('Done. beta_agreements table and RLS policies applied.\n')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
