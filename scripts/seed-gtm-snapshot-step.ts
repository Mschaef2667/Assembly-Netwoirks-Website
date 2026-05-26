/**
 * Seed script — insert step_definition row for GTM Snapshot (step id '4.5')
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-gtm-snapshot-step.ts
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
  console.log('\nInserting step_definition row for GTM Snapshot (step 4.5)…\n')

  const { error } = await supabase
    .from('step_definition')
    .upsert(
      {
        id: '4.5',
        title: 'GTM Snapshot',
        description: 'Capture your current go-to-market metrics, sales motion, and biggest challenges to give Copilot context for the rest of the journey.',
        section: 'Company Foundation',
        phase: 4.5,
      },
      { onConflict: 'id' }
    )

  if (error) {
    console.error('  ✗ Failed to upsert step_definition row:', error.message)
    process.exit(1)
  }

  console.log('  ✓ step_definition row upserted: id=4.5, title="GTM Snapshot", section="Company Foundation", phase=4.5')
  console.log('\nDone.\n')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
