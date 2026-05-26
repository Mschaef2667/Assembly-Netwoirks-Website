/**
 * Seed script — blank user + workspace
 *
 * Creates a fresh auth user, organization, and users record with no content seeded.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-blank-user.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to bypass RLS.
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

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Credentials ─────────────────────────────────────────────────────────────

const EMAIL = 'newuser@assemblyai.net'
const PASSWORD = 'TestUser2026!'

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\nCreating blank user workspace...\n')

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error('✗ Auth user creation failed:', authError?.message ?? 'unknown error')
    process.exit(1)
  }

  const authUserId = authData.user.id
  console.log(`✓ Auth user created: ${authUserId}`)

  // 2. Create organization
  const slug = 'test-organization-' + Date.now()

  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: 'Test Organization',
      slug,
      status: 'trial',
    })
    .select('id')
    .single()

  if (orgError || !orgData) {
    console.error('✗ Organization creation failed:', orgError?.message ?? 'unknown error')
    // Clean up auth user before exiting
    await supabase.auth.admin.deleteUser(authUserId)
    process.exit(1)
  }

  const orgId = orgData.id
  console.log(`✓ Organization created: ${orgId}`)

  // 3. Create user record
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: authUserId,
      org_id: orgId,
      email: EMAIL,
      first_name: 'Test',
      last_name: 'User',
      role: 'org_admin',
      is_active: true,
    })

  if (userError) {
    console.error('✗ User record creation failed:', userError.message)
    // Clean up org and auth user before exiting
    await supabase.from('organizations').delete().eq('id', orgId)
    await supabase.auth.admin.deleteUser(authUserId)
    process.exit(1)
  }

  console.log('✓ User record created')

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────')
  console.log('Blank workspace ready.')
  console.log(`  Email:    ${EMAIL}`)
  console.log(`  Password: ${PASSWORD}`)
  console.log(`  Org ID:   ${orgId}`)
  console.log('─────────────────────────────────────────\n')
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
