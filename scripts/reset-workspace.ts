/**
 * Reset workspace script — wipes all org data without touching auth or org record
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/reset-workspace.ts <org_id>
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

async function deleteRows(
  table: string,
  orgCol: string,
  orgId: string
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq(orgCol, orgId)
    .select('id')

  if (error) {
    throw new Error(`Failed to delete from ${table}: ${error.message}`)
  }

  return data?.length ?? 0
}

async function main(): Promise<void> {
  const orgId = process.argv[2]

  if (!orgId) {
    console.error('Usage: npx ts-node --project tsconfig.scripts.json scripts/reset-workspace.ts <org_id>')
    process.exit(1)
  }

  // Validate that the org exists before wiping anything
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle()

  if (orgError) {
    console.error(`Failed to look up organization: ${orgError.message}`)
    process.exit(1)
  }

  if (!org) {
    console.error(`No organization found with id: ${orgId}`)
    process.exit(1)
  }

  console.log(`\nResetting workspace: ${org.name} (${orgId})\n`)

  const tables: Array<{ table: string; orgCol: string }> = [
    { table: 'step_output',      orgCol: 'workspace_id' },
    { table: 'dcp_analysis',     orgCol: 'org_id' },
    { table: 'dcp_imports',      orgCol: 'org_id' },
    { table: 'icp_definition',   orgCol: 'org_id' },
    { table: 'offer_definition', orgCol: 'org_id' },
    { table: 'copilot_run',      orgCol: 'workspace_id' },
  ]

  let totalDeleted = 0

  for (const { table, orgCol } of tables) {
    process.stdout.write(`  Deleting from ${table}...`)
    try {
      const count = await deleteRows(table, orgCol, orgId)
      console.log(` ${count} row${count === 1 ? '' : 's'} deleted`)
      totalDeleted += count
    } catch (err) {
      console.log('')
      console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }
  }

  console.log('\n─────────────────────────────────────────')
  console.log('Done.')
  console.log(`  Organization: ${org.name}`)
  console.log(`  Org ID:       ${orgId}`)
  console.log(`  Total rows:   ${totalDeleted} deleted`)
  console.log('─────────────────────────────────────────\n')
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
