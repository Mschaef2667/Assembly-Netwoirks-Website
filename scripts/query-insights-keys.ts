import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const workspaceId = '35e0e4b7-9427-448a-b4df-9d9f0bde1873'
  const stepId = 'insights'

  const { data, error } = await supabase
    .from('step_output')
    .select('id, step_id, version, status, content, last_updated_at')
    .eq('workspace_id', workspaceId)
    .eq('step_id', stepId)

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log(`No step_output row found for workspace ${workspaceId} step ${stepId}`)
    return
  }

  for (const row of data) {
    console.log(`Row id: ${row.id}`)
    console.log(`step_id: ${row.step_id}`)
    console.log(`version: ${row.version}`)
    console.log(`status: ${row.status}`)
    console.log(`last_updated_at: ${row.last_updated_at}`)
    const content = row.content
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const keys = Object.keys(content)
      console.log(`\nTop-level keys of content (${keys.length}):`)
      for (const k of keys) {
        const v = (content as Record<string, unknown>)[k]
        const typeLabel = Array.isArray(v) ? `array[${v.length}]` : typeof v
        console.log(`  - ${k}  (${typeLabel})`)
      }
    } else {
      console.log(`content is not a plain object (type: ${Array.isArray(content) ? 'array' : typeof content})`)
    }
    console.log()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
