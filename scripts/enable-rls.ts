/**
 * enable-rls.ts — Row Level Security enablement for all public tables
 *
 * Enables RLS and applies the Assembly AI standard org-scoped policies on every
 * public table that holds org-specific data.  Idempotent: DROP POLICY IF EXISTS
 * precedes every CREATE POLICY, so it is safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/enable-rls.ts
 *
 * Required env vars in .env.local:
 *   DATABASE_URL            — Direct Postgres connection string.
 *                             Supabase dashboard → Settings → Database
 *                             → Connection string → URI (session pooler or direct).
 *   SUPABASE_SERVICE_ROLE_KEY — Kept for consistency with other scripts; not used
 *                               for the SQL execution here but guards against
 *                               running against the wrong project.
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
    '               → Connection string → URI\n' +
    '  It looks like: postgresql://postgres.[ref]:[password]@...supabase.com:5432/postgres\n'
  )
  process.exit(1)
}
if (!serviceKey) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY is not set in .env.local')
  process.exit(1)
}

// ─── Postgres client (runs as postgres superuser — bypasses RLS) ─────────────

const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function orgMatch(orgCol: string): string {
  return `${orgCol} in (select org_id from users where id = auth.uid())`
}

async function run(label: string, sql: string): Promise<void> {
  try {
    await pool.query(sql)
    console.log(`  ✓ ${label}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${label}\n    ${msg}`)
  }
}

// ─── Table configurations ─────────────────────────────────────────────────────

interface TableConfig {
  table: string
  orgCol: string
  /** Roles allowed to INSERT (default: all authenticated org members) */
  canInsert?: boolean
  /** Roles allowed to UPDATE (default: all authenticated org members) */
  canUpdate?: boolean
  /** Roles allowed to DELETE (default: all authenticated org members) */
  canDelete?: boolean
  /** Custom SELECT policy expression (overrides orgMatch) */
  selectUsing?: string
  /** Custom INSERT policy expression (overrides orgMatch) */
  insertCheck?: string
  /** Custom UPDATE policy expressions */
  updateUsing?: string
  updateCheck?: string
}

const tables: TableConfig[] = [
  // step_output uses workspace_id as the org column
  {
    table: 'step_output',
    orgCol: 'workspace_id',
    canInsert: true,
    canUpdate: true,
    canDelete: true,
  },

  // dcp_analysis: one row per org, full CRUD for org members
  {
    table: 'dcp_analysis',
    orgCol: 'org_id',
    canInsert: true,
    canUpdate: true,
    canDelete: true,
  },

  // dcp_imports: append-only in the app, but DELETE allowed for admin resets
  {
    table: 'dcp_imports',
    orgCol: 'org_id',
    canInsert: true,
    canUpdate: true,
    canDelete: true,
  },

  // icp_definition
  {
    table: 'icp_definition',
    orgCol: 'org_id',
    canInsert: true,
    canUpdate: true,
    canDelete: true,
  },

  // offer_definition
  {
    table: 'offer_definition',
    orgCol: 'org_id',
    canInsert: true,
    canUpdate: true,
    canDelete: true,
  },

  // copilot_run uses workspace_id — insert-only in the app, no update/delete
  {
    table: 'copilot_run',
    orgCol: 'workspace_id',
    canInsert: true,
    canUpdate: false,
    canDelete: false,
  },

  // organizations: any org member can SELECT their org; only org_admin can UPDATE
  {
    table: 'organizations',
    orgCol: 'id',
    canInsert: false,
    // SELECT: all authenticated org members (not just org_admin)
    selectUsing: 'id in (select org_id from users where id = auth.uid())',
    // UPDATE: org_admin only
    canUpdate: true,
    updateUsing:
      'id in (select org_id from users where id = auth.uid() and role = \'org_admin\')',
    updateCheck:
      'id in (select org_id from users where id = auth.uid() and role = \'org_admin\')',
    canDelete: false,
  },

  // users: SELECT by direct auth.uid() match — avoids circular join (org_id lookup
  // requires reading users, which would itself require org_id from users)
  {
    table: 'users',
    orgCol: 'org_id',
    selectUsing: 'id = auth.uid()',
    canInsert: false,
    canUpdate: false,
    canDelete: false,
  },

  // step_dependency: reference/lookup table — any authenticated user can SELECT,
  // no INSERT/UPDATE/DELETE for regular users (managed via service role / migrations)
  {
    table: 'step_dependency',
    orgCol: 'step_id',            // unused — selectUsing overrides org scoping
    selectUsing: 'auth.uid() is not null',
    canInsert: false,
    canUpdate: false,
    canDelete: false,
  },
]

// ─── Apply RLS for one table ──────────────────────────────────────────────────

async function applyRls(cfg: TableConfig): Promise<void> {
  const { table, orgCol } = cfg

  console.log(`\n── ${table} ──`)

  // 1. Enable RLS
  await run(
    'enable row level security',
    `alter table ${table} enable row level security;`
  )

  // 2. Force RLS even for the table owner (postgres role)
  //    This ensures admin operations go through the service_role bypass, not owner bypass.
  await run(
    'force row level security',
    `alter table ${table} force row level security;`
  )

  // 3. SELECT
  const selectUsing = cfg.selectUsing ?? orgMatch(orgCol)
  await run(
    'drop + create SELECT policy',
    `
    drop policy if exists "${table}_select_own_org" on ${table};
    create policy "${table}_select_own_org"
      on ${table} for select
      using (${selectUsing});
    `
  )

  // 4. INSERT
  if (cfg.canInsert) {
    const insertCheck = cfg.insertCheck ?? orgMatch(orgCol)
    await run(
      'drop + create INSERT policy',
      `
      drop policy if exists "${table}_insert_own_org" on ${table};
      create policy "${table}_insert_own_org"
        on ${table} for insert
        with check (${insertCheck});
      `
    )
  } else {
    // Drop any stale insert policy
    await run(
      'drop INSERT policy (not allowed for regular users)',
      `drop policy if exists "${table}_insert_own_org" on ${table};`
    )
  }

  // 5. UPDATE
  if (cfg.canUpdate) {
    const using = cfg.updateUsing ?? orgMatch(orgCol)
    const check  = cfg.updateCheck ?? orgMatch(orgCol)
    await run(
      'drop + create UPDATE policy',
      `
      drop policy if exists "${table}_update_own_org" on ${table};
      create policy "${table}_update_own_org"
        on ${table} for update
        using  (${using})
        with check (${check});
      `
    )
  } else {
    await run(
      'drop UPDATE policy (not allowed for regular users)',
      `drop policy if exists "${table}_update_own_org" on ${table};`
    )
  }

  // 6. DELETE
  if (cfg.canDelete) {
    const deleteUsing = cfg.selectUsing ?? orgMatch(orgCol)
    await run(
      'drop + create DELETE policy',
      `
      drop policy if exists "${table}_delete_own_org" on ${table};
      create policy "${table}_delete_own_org"
        on ${table} for delete
        using (${deleteUsing});
      `
    )
  } else {
    await run(
      'drop DELETE policy (not allowed for regular users)',
      `drop policy if exists "${table}_delete_own_org" on ${table};`
    )
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\nAssembly AI — Enable Row Level Security')
  console.log('========================================')
  console.log('Service role bypasses RLS automatically; these policies govern')
  console.log('all connections that authenticate as a regular Supabase user.\n')

  for (const cfg of tables) {
    await applyRls(cfg)
  }

  console.log('\n========================================')
  console.log('Done. All tables processed.')
  console.log(
    '\nNote: The service_role key bypasses RLS by design — no policy needed for it.\n'
  )

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
