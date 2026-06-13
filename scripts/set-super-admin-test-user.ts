/**
 * set-super-admin-test-user.ts — Promote test@assemblynetworks.net to super admin
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/set-super-admin-test-user.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!databaseUrl) {
  console.error('✗ DATABASE_URL is not set in .env.local')
  process.exit(1)
}
if (!serviceKey) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY is not set in .env.local')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })

async function main(): Promise<void> {
  const email = 'test@assemblynetworks.net'

  const before = await pool.query(
    'select id, email, is_super_admin from users where email = $1',
    [email]
  )
  console.log('Before:', before.rows)

  const result = await pool.query(
    'update users set is_super_admin = true where email = $1 returning id, email, is_super_admin',
    [email]
  )
  console.log(`Updated ${result.rowCount} row(s):`, result.rows)

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err)
  pool.end().finally(() => process.exit(1))
})
