import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const orgId = process.argv[2] || '35e0e4b7-9427-448a-b4df-9d9f0bde1873'

  const { data, error } = await supabase
    .from('step_output')
    .select('step_id, version, status, last_updated_at, last_saved_at')
    .eq('workspace_id', orgId)
    .order('step_id', { ascending: true })

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log(`No step_output rows found for org ${orgId}`)
    return
  }

  console.log(`Found ${data.length} step_output rows for org ${orgId}\n`)
  console.log('step_id'.padEnd(30) + 'v'.padEnd(4) + 'status'.padEnd(20) + 'last_updated_at')
  console.log('-'.repeat(95))
  for (const row of data) {
    console.log(
      String(row.step_id).padEnd(30) +
      String(row.version).padEnd(4) +
      String(row.status).padEnd(20) +
      String(row.last_updated_at || row.last_saved_at || '—')
    )
  }
}

main().catch(e => { console.error(e); process.exit(1) })
