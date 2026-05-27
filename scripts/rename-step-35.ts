/**
 * Rename step 3.5 title from 'Buying Center Evaluation' to 'The Yes Criteria'
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/rename-step-35.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to bypass RLS.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

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

async function main(): Promise<void> {
  console.log('\nUpdating step_definition title for step 3.5…\n')

  const { error } = await supabase
    .from('step_definition')
    .update({ title: 'The Yes Criteria' })
    .eq('id', '3.5')

  if (error) {
    console.error('  ✗ Failed to update step_definition row:', error.message)
    process.exit(1)
  }

  console.log('  ✓ step_definition updated: id=3.5, title="The Yes Criteria"')
  console.log('\nDone.\n')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
