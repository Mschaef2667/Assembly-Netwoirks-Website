import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { Client } from 'pg'

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL!,
  })
  await client.connect()

  console.log('=== icp_definition columns ===')
  const cols = await client.query(
    `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
      where table_schema = 'public' and table_name = 'icp_definition'
      order by ordinal_position;`,
  )
  console.table(cols.rows)

  console.log('\n=== Unique / PK constraints on icp_definition ===')
  const constraints = await client.query(
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
  console.table(constraints.rows)

  console.log('\n=== CHECK constraints on icp_definition ===')
  const checks = await client.query(
    `select con.conname as constraint_name,
            pg_get_constraintdef(con.oid) as definition
       from pg_constraint con
       join pg_class rel on rel.oid = con.conrelid
       join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = 'icp_definition'
        and con.contype = 'c'
      order by con.conname;`,
  )
  console.table(checks.rows)

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
