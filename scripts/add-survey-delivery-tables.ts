/**
 * add-survey-delivery-tables.ts — Phase 1 Built-in Survey Delivery
 *
 * Creates survey_links and survey_link_responses tables with RLS policies.
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-survey-delivery-tables.ts
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
  console.log('\nAssembly AI — Add Survey Delivery Tables')
  console.log('=========================================\n')

  // ── survey_links ────────────────────────────────────────────────────────────

  console.log('── survey_links ──')

  await run('create table', `
    create table if not exists survey_links (
      id           uuid        primary key default gen_random_uuid(),
      org_id       uuid        not null references organizations(id),
      segment_slug text        not null,
      segment_name text        not null,
      audience     text        not null,
      token        uuid        not null default gen_random_uuid() unique,
      questions    jsonb,
      is_active    boolean     default true,
      created_at   timestamptz default now(),
      expires_at   timestamptz
    );
  `)

  await run('enable row level security',  `alter table survey_links enable row level security;`)
  await run('force row level security',   `alter table survey_links force row level security;`)

  await run('drop + create SELECT policy', `
    drop policy if exists "survey_links_select_own_org" on survey_links;
    create policy "survey_links_select_own_org"
      on survey_links for select
      using (org_id in (select org_id from users where id = auth.uid()));
  `)

  await run('drop + create INSERT policy', `
    drop policy if exists "survey_links_insert_own_org" on survey_links;
    create policy "survey_links_insert_own_org"
      on survey_links for insert
      with check (org_id in (select org_id from users where id = auth.uid()));
  `)

  await run('drop + create UPDATE policy', `
    drop policy if exists "survey_links_update_own_org" on survey_links;
    create policy "survey_links_update_own_org"
      on survey_links for update
      using  (org_id in (select org_id from users where id = auth.uid()))
      with check (org_id in (select org_id from users where id = auth.uid()));
  `)

  // ── survey_link_responses ────────────────────────────────────────────────────

  console.log('\n── survey_link_responses ──')

  await run('create table', `
    create table if not exists survey_link_responses (
      id               uuid        primary key default gen_random_uuid(),
      survey_link_id   uuid        not null references survey_links(id),
      org_id           uuid        not null,
      segment_slug     text        not null,
      audience         text        not null,
      respondent_name  text,
      respondent_title text,
      respondent_company text,
      respondent_size  text,
      respondent_industry text,
      answers          jsonb,
      submitted_at     timestamptz default now()
    );
  `)

  await run('enable row level security',  `alter table survey_link_responses enable row level security;`)
  await run('force row level security',   `alter table survey_link_responses force row level security;`)

  await run('drop + create SELECT policy (org members)', `
    drop policy if exists "survey_link_responses_select_own_org" on survey_link_responses;
    create policy "survey_link_responses_select_own_org"
      on survey_link_responses for select
      using (org_id in (select org_id from users where id = auth.uid()));
  `)

  await run('drop + create INSERT policy (anon — public respondents)', `
    drop policy if exists "survey_link_responses_insert_anon" on survey_link_responses;
    create policy "survey_link_responses_insert_anon"
      on survey_link_responses for insert
      to anon
      with check (true);
  `)

  console.log('\n=========================================')
  console.log('Done. Both tables and RLS policies applied.')
  console.log('Note: the submit API route uses service_role key and bypasses RLS.\n')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
