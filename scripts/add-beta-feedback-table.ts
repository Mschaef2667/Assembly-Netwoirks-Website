/**
 * add-beta-feedback-table.ts — Beta Feedback Widget
 *
 * Creates beta_feedback table with RLS policies.
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-beta-feedback-table.ts
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
  console.log('\nAssembly AI — Add Beta Feedback Table')
  console.log('======================================\n')

  console.log('── beta_feedback ──')

  await run('create table', `
    create table if not exists beta_feedback (
      id         uuid        primary key default gen_random_uuid(),
      org_id     uuid        not null,
      user_id    uuid        not null,
      page_url   text,
      step_id    text,
      type       text        not null check (type in ('thumbs_up', 'thumbs_down', 'issue', 'idea')),
      message    text,
      created_at timestamptz not null default now()
    );
  `)

  await run('enable row level security', `alter table beta_feedback enable row level security;`)
  await run('force row level security',  `alter table beta_feedback force row level security;`)

  await run('drop + create INSERT policy (own org)', `
    drop policy if exists "beta_feedback_insert_own_org" on beta_feedback;
    create policy "beta_feedback_insert_own_org"
      on beta_feedback for insert
      with check (org_id in (select org_id from users where id = auth.uid()));
  `)

  await run('drop + create SELECT policy (own rows)', `
    drop policy if exists "beta_feedback_select_own_rows" on beta_feedback;
    create policy "beta_feedback_select_own_rows"
      on beta_feedback for select
      using (user_id = auth.uid());
  `)

  console.log('\n======================================')
  console.log('Done. beta_feedback table and RLS policies applied.\n')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
