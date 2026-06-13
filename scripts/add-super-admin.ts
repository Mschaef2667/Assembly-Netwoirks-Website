/**
 * add-super-admin.ts — Add is_super_admin column to users table
 *
 * Adds boolean is_super_admin column (default false) and elevates
 * mschaef@gmail.com to super admin.
 *
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-super-admin.ts
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

async function run(label: string, sql: string, params: unknown[] = []): Promise<void> {
  try {
    const result = await pool.query(sql, params)
    const count = typeof result.rowCount === 'number' ? ` (${result.rowCount} row${result.rowCount === 1 ? '' : 's'})` : ''
    console.log(`  ✓ ${label}${count}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${label}\n    ${msg}`)
  }
}

async function main(): Promise<void> {
  console.log('\nAssembly AI — Add is_super_admin column')
  console.log('========================================\n')

  await run('add is_super_admin column (idempotent)', `
    alter table users
    add column if not exists is_super_admin boolean not null default false;
  `)

  await run('elevate mschaef@gmail.com to super admin', `
    update users
    set is_super_admin = true
    where email = $1;
  `, ['mschaef@gmail.com'])

  await run('add resolved_at to beta_feedback (idempotent)', `
    alter table beta_feedback
    add column if not exists resolved_at timestamptz;
  `)

  console.log('\nDone.\n')
  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
