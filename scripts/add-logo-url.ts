/**
 * add-logo-url.ts — Add logo_url column to organizations + create org-logos bucket
 *
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/add-logo-url.ts
 *
 * Required env vars in .env.local:
 *   DATABASE_URL              — Direct Postgres connection string
 *   SUPABASE_SERVICE_ROLE_KEY — Guards against wrong project
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!databaseUrl) {
  console.error(
    '\n✗ DATABASE_URL is not set in .env.local\n\n' +
    '  Get it from: Supabase Dashboard → Settings → Database\n' +
    '               → Connection string → URI\n'
  )
  process.exit(1)
}
if (!serviceKey) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY is not set in .env.local')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })

async function run(label: string, sql: string): Promise<void> {
  try {
    await pool.query(sql)
    console.log(`  ✓ ${label}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${label}\n    ${msg}`)
  }
}

async function main(): Promise<void> {
  console.log('\nAssembly AI — Add logo_url to organizations + org-logos bucket')
  console.log('================================================================\n')

  await run('add organizations.logo_url column (idempotent)', `
    alter table organizations
    add column if not exists logo_url text;
  `)

  await run('create org-logos storage bucket (idempotent)', `
    insert into storage.buckets (id, name, public)
    values ('org-logos', 'org-logos', true)
    on conflict (id) do update set public = true;
  `)

  await run('storage SELECT policy for org-logos (public read)', `
    drop policy if exists "org_logos_public_read" on storage.objects;
    create policy "org_logos_public_read"
      on storage.objects for select
      using (bucket_id = 'org-logos');
  `)

  await run('storage INSERT policy for org-logos (authenticated)', `
    drop policy if exists "org_logos_authenticated_insert" on storage.objects;
    create policy "org_logos_authenticated_insert"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'org-logos');
  `)

  await run('storage UPDATE policy for org-logos (authenticated)', `
    drop policy if exists "org_logos_authenticated_update" on storage.objects;
    create policy "org_logos_authenticated_update"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'org-logos')
      with check (bucket_id = 'org-logos');
  `)

  await run('storage DELETE policy for org-logos (authenticated)', `
    drop policy if exists "org_logos_authenticated_delete" on storage.objects;
    create policy "org_logos_authenticated_delete"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'org-logos');
  `)

  console.log('\nDone.\n')
  await pool.end()
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err)
  pool.end().finally(() => process.exit(1))
})
