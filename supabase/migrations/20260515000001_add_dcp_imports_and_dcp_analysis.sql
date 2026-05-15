-- Both survey_responses and dcp_maps already exist in this project with
-- different schemas. Create purpose-specific tables under new names.

-- dcp_imports: stores bulk CSV survey imports (one row per import event)
create table if not exists dcp_imports (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  raw_csv          text,
  parsed_responses jsonb,
  response_count   int,
  imported_at      timestamptz not null default now()
);

alter table dcp_imports enable row level security;

drop policy if exists "dcp_imports_select_own_org" on dcp_imports;
create policy "dcp_imports_select_own_org"
  on dcp_imports for select
  using (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "dcp_imports_insert_own_org" on dcp_imports;
create policy "dcp_imports_insert_own_org"
  on dcp_imports for insert
  with check (org_id in (select org_id from users where id = auth.uid()));

-- dcp_analysis: Copilot-generated DCP stage summaries (one row per org)
create table if not exists dcp_analysis (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null,
  stage_summaries    jsonb,
  overall_confidence int,
  status             text not null default 'draft',
  submitted_at       timestamptz,
  approved_at        timestamptz,
  approved_by        uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id)
);

alter table dcp_analysis enable row level security;

drop policy if exists "dcp_analysis_select_own_org" on dcp_analysis;
create policy "dcp_analysis_select_own_org"
  on dcp_analysis for select
  using (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "dcp_analysis_insert_own_org" on dcp_analysis;
create policy "dcp_analysis_insert_own_org"
  on dcp_analysis for insert
  with check (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "dcp_analysis_update_own_org" on dcp_analysis;
create policy "dcp_analysis_update_own_org"
  on dcp_analysis for update
  using  (org_id in (select org_id from users where id = auth.uid()))
  with check (org_id in (select org_id from users where id = auth.uid()));
