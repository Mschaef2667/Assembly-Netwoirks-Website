/**
 * Seed script — Assembly Networks test organization + user
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-test-org.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to bypass RLS.
 * The auth user for test@assemblynetworks.net must already exist in Supabase Auth
 * before running this script.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

// ─── Supabase client (service role — bypasses RLS) ───────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}
if (!serviceKey) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY in .env.local\n' +
    'Find it in your Supabase project: Settings > API > service_role key'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

// ─── Config ───────────────────────────────────────────────────────────────────

const TEST_EMAIL = 'test@assemblynetworks.net'
const ORG_NAME = 'Assembly Networks'
const ORG_SLUG = 'assembly-networks'

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nSeeding test organization: ${ORG_NAME}\n`)

  // ── 1. Look up auth user by email ─────────────────────────────────────────
  console.log(`Looking up auth user: ${TEST_EMAIL}`)

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })

  if (listError) {
    console.error(`  ✗ Failed to list auth users: ${listError.message}`)
    process.exit(1)
  }

  const authUser = listData.users.find((u) => u.email === TEST_EMAIL)

  if (!authUser) {
    console.error(
      `  ✗ No auth user found with email ${TEST_EMAIL}\n` +
      '    Create the user in Supabase Auth (Authentication > Users > Add user) first, then re-run this script.'
    )
    process.exit(1)
  }

  console.log(`  ✓ Auth user found: ${authUser.id}`)

  // ── 2. Create or reuse organization ──────────────────────────────────────
  console.log(`\nCreating organization: ${ORG_NAME}`)

  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', ORG_SLUG)
    .maybeSingle()

  let orgId: string

  if (existingOrg) {
    orgId = existingOrg.id
    console.log(`  ✓ Organization already exists, reusing: ${orgId}`)
  } else {
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: ORG_NAME,
        slug: ORG_SLUG,
        status: 'trial',
        preferred_model: 'claude-sonnet-4-5',
      })
      .select('id')
      .single()

    if (orgError) {
      console.error(`  ✗ Failed to create organization: ${orgError.message}`)
      process.exit(1)
    }

    orgId = orgData.id
    console.log(`  ✓ Organization created: ${orgId}`)
  }

  // ── 3. Create or skip user record ────────────────────────────────────────
  console.log(`\nCreating user record: ${TEST_EMAIL}`)

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', authUser.id)
    .maybeSingle()

  if (existingUser) {
    console.log(`  ✓ User record already exists, skipping`)
  } else {
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        org_id: orgId,
        email: TEST_EMAIL,
        first_name: 'Assembly',
        last_name: 'Networks',
        role: 'org_admin',
        is_active: true,
      })

    if (userError) {
      console.error(`  ✗ Failed to create user record: ${userError.message}`)
      process.exit(1)
    }

    console.log(`  ✓ User record created`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────')
  console.log('Done.')
  console.log(`  Organization: ${ORG_NAME}`)
  console.log(`  Org ID:       ${orgId}`)
  console.log(`  User:         ${TEST_EMAIL} (${authUser.id})`)
  console.log(`  Role:         org_admin`)
  console.log('─────────────────────────────────────────\n')
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
