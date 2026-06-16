/**
 * add-provisioned-at.ts — Beta-client provisioning columns
 *
 * Adds:
 *   demo_requests.provisioned_at    timestamptz
 *   demo_requests.provisioned_org_id uuid (FK → organizations.id)
 *   organizations.plan              text (e.g. 'beta')
 *
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-provisioned-at.ts
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
  console.log('\nAssembly AI — Add Provisioning Columns')
  console.log('==========================================\n')

  console.log('── demo_requests ──')

  await run('add provisioned_at column', `
    alter table demo_requests
      add column if not exists provisioned_at timestamptz;
  `)

  await run('add provisioned_org_id column', `
    alter table demo_requests
      add column if not exists provisioned_org_id uuid references organizations(id) on delete set null;
  `)

  console.log('\n── organizations ──')

  await run('add plan column', `
    alter table organizations
      add column if not exists plan text;
  `)

  console.log('\n==========================================')
  console.log('Done.\n')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
