import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { Client } from 'pg'

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL!,
  })
  await client.connect()

  console.log('=== Constraints on icp_definition BEFORE migration ===')
  const before = await client.query(
    `select tc.constraint_name, tc.constraint_type,
            string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on tc.constraint_name = kcu.constraint_name
        and tc.table_schema    = kcu.table_schema
      where tc.table_schema = 'public'
        and tc.table_name   = 'icp_definition'
        and tc.constraint_type in ('UNIQUE', 'PRIMARY KEY')
      group by tc.constraint_name, tc.constraint_type
      order by tc.constraint_type, tc.constraint_name;`,
  )
  console.table(before.rows)

  await client.query('begin')
  try {
    console.log('\nDropping constraint icp_definition_org_segment_uniq ...')
    await client.query(
      `alter table icp_definition
         drop constraint if exists icp_definition_org_segment_uniq;`,
    )

    console.log('Creating new unique constraint on (org_id, segment_index, buyer_type) ...')
    await client.query(
      `alter table icp_definition
         add constraint icp_definition_org_segment_buyer_uniq
         unique (org_id, segment_index, buyer_type);`,
    )

    await client.query('commit')
    console.log('Migration committed.')
  } catch (err) {
    await client.query('rollback')
    console.error('Migration failed, rolled back:', err)
    process.exit(1)
  }

  console.log('\n=== Constraints on icp_definition AFTER migration ===')
  const after = await client.query(
    `select tc.constraint_name, tc.constraint_type,
            string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on tc.constraint_name = kcu.constraint_name
        and tc.table_schema    = kcu.table_schema
      where tc.table_schema = 'public'
        and tc.table_name   = 'icp_definition'
        and tc.constraint_type in ('UNIQUE', 'PRIMARY KEY')
      group by tc.constraint_name, tc.constraint_type
      order by tc.constraint_type, tc.constraint_name;`,
  )
  console.table(after.rows)

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
