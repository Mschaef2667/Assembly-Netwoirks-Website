/**
 * add-report-generation-log.ts — Deliverable Generation Audit Log
 *
 * Creates report_generation_log table and its RLS policies. Every time a
 * client-facing deliverable is generated (Engagement Plan, Future State,
 * ICP Calibration report), the code paths in app/dashboard/journeys/report
 * and /api/icp/report append an audit row here so the admin panel can show
 * per-account deliverable status server-side (vs. the older localStorage
 * scheme that was per-browser and got lost across devices).
 *
 * Unlike demo_requests / whitepaper_leads (service-role-only), this table
 * is written to by USER-SESSION clients from the report page. So RLS DOES
 * need policies:
 *   - SELECT: super-admin OR (org_id = auth_org_id())
 *   - INSERT: super-admin OR (org_id = auth_org_id())
 *   - No UPDATE / DELETE policies — the log is append-only.
 *
 * Note on the `is_super_admin()` SQL helper: it currently checks
 * users.role = 'super_admin' rather than the users.is_super_admin boolean
 * (a known repo-wide inconsistency documented elsewhere). For today, the
 * "super_admin OR" branch of these policies will not admit user-session
 * queries from platform admins elevated via the boolean; cross-account
 * admin reads flow through service-role routes (which bypass RLS) instead.
 * That still works — this policy shape does not change what admins can do
 * via /api/admin/**; it just fires the user-session INSERT/SELECT paths
 * for a workspace's own row on its own dashboard.
 *
 * Idempotent: safe to re-run. Policies use drop-if-exists + create because
 * Postgres has no `create policy if not exists`.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-report-generation-log.ts
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
  console.log('\nAssembly AI — Add Report Generation Log Table')
  console.log('==============================================\n')

  console.log('── report_generation_log ──')

  await run('create table', `
    create table if not exists report_generation_log (
      id            uuid        primary key default gen_random_uuid(),
      org_id        uuid        not null references organizations(id) on delete cascade,
      report_type   text        not null check (report_type in (
                      'dcp_map',
                      'insights',
                      'engagement_plan',
                      'future_state',
                      'icp_calibration'
                    )),
      generated_at  timestamptz not null default now(),
      generated_by  uuid        references users(id) on delete set null,
      metadata      jsonb
    );
  `)

  await run('index on (org_id, report_type)', `
    create index if not exists idx_report_gen_log_org_type
      on report_generation_log (org_id, report_type);
  `)

  await run('index on generated_at', `
    create index if not exists idx_report_gen_log_generated_at
      on report_generation_log (generated_at desc);
  `)

  await run('enable row level security', `alter table report_generation_log enable row level security;`)

  // SELECT policy — own org or super admin.
  await run('drop existing select policy (if any)', `
    drop policy if exists report_generation_log_select on report_generation_log;
  `)
  await run('create select policy', `
    create policy report_generation_log_select
      on report_generation_log
      for select
      using ( is_super_admin() or (org_id = auth_org_id()) );
  `)

  // INSERT policy — own org or super admin.
  await run('drop existing insert policy (if any)', `
    drop policy if exists report_generation_log_insert on report_generation_log;
  `)
  await run('create insert policy', `
    create policy report_generation_log_insert
      on report_generation_log
      for insert
      with check ( is_super_admin() or (org_id = auth_org_id()) );
  `)

  // No UPDATE / DELETE policies on purpose — the log is append-only from user
  // sessions. If a row ever needs to be corrected or removed, do it via the
  // service role in an admin API route (bypasses RLS).

  console.log('\n==============================================')
  console.log('Done. report_generation_log table created.\n')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
