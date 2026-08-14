-- GTM Gap Report: assessment intake + generated report storage.
-- Step 2 of the free GTM assessment lead magnet. Super-admin only.
-- The public hosted report page reads a single row by public_token through a
-- service-role server route (RLS bypassed), so no anon SELECT policy is needed.

create table if not exists gtm_assessments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'drafted', 'sent')),

  -- contact
  name text not null,
  email text not null,
  company text,
  job_title text,
  industry text,
  annual_revenue text,
  how_heard text,

  -- intake (the C3 substance)
  competitors text,
  challenge text,
  gtm_summary text,

  -- provenance
  source_site text,
  page_url text,
  notion_page_id text,

  -- report
  report_draft jsonb,
  report_final jsonb,
  public_token text unique,
  sent_at timestamptz
);

create index if not exists gtm_assessments_status_idx on gtm_assessments (status);
create index if not exists gtm_assessments_created_at_idx on gtm_assessments (created_at desc);
create index if not exists gtm_assessments_public_token_idx on gtm_assessments (public_token);

alter table gtm_assessments enable row level security;

-- Super admin can do everything; no one else has access via RLS.
drop policy if exists "gtm_assessments_superadmin_all" on gtm_assessments;
create policy "gtm_assessments_superadmin_all" on gtm_assessments
  for all
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_super_admin))
  with check (exists (select 1 from users u where u.id = auth.uid() and u.is_super_admin));
