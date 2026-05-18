-- ── icp_definition ────────────────────────────────────────────────────────────

create table if not exists icp_definition (
  id                      uuid        primary key default gen_random_uuid(),
  org_id                  uuid        not null references organizations(id) on delete cascade,
  segment_name            text        not null,
  segment_index           integer     not null check (segment_index between 1 and 3),
  buyer_type              text        not null default 'economic_buyer'
                                        check (buyer_type in ('economic_buyer', 'champion')),
  job_titles              jsonb       not null default '[]',
  company_size_range      text,
  industry_verticals      jsonb       not null default '[]',
  decision_making_power   text,
  budget_range            text,
  buying_motion           text,
  primary_challenges      jsonb       not null default '[]',
  barriers_to_success     jsonb       not null default '[]',
  the_big_win             text,
  success_metrics         jsonb       not null default '[]',
  buying_triggers         jsonb       not null default '[]',
  information_sources     jsonb       not null default '[]',
  preferred_communication text,
  purchase_criteria       jsonb       not null default '[]',
  buyer_values            text,
  common_objections       jsonb       not null default '[]',
  risk_sensitivities      text,
  tech_stack              text,
  buying_urgency_trigger  text,
  copilot_generated       boolean     not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint icp_definition_org_segment_uniq unique (org_id, segment_index)
);

-- RLS for icp_definition
alter table icp_definition enable row level security;

drop policy if exists "icp_definition_select_own_org" on icp_definition;
create policy "icp_definition_select_own_org"
  on icp_definition for select
  using (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "icp_definition_insert_own_org" on icp_definition;
create policy "icp_definition_insert_own_org"
  on icp_definition for insert
  with check (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "icp_definition_update_own_org" on icp_definition;
create policy "icp_definition_update_own_org"
  on icp_definition for update
  using  (org_id in (select org_id from users where id = auth.uid()))
  with check (org_id in (select org_id from users where id = auth.uid()));


-- ── offer_definition ──────────────────────────────────────────────────────────

create table if not exists offer_definition (
  id                    uuid        primary key default gen_random_uuid(),
  org_id                uuid        not null references organizations(id) on delete cascade,
  icp_id                uuid        not null references icp_definition(id) on delete cascade,
  offer_name            text        not null,
  key_outcome           text,
  price_range           text,
  primary_differentiator text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- RLS for offer_definition
alter table offer_definition enable row level security;

drop policy if exists "offer_definition_select_own_org" on offer_definition;
create policy "offer_definition_select_own_org"
  on offer_definition for select
  using (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "offer_definition_insert_own_org" on offer_definition;
create policy "offer_definition_insert_own_org"
  on offer_definition for insert
  with check (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "offer_definition_update_own_org" on offer_definition;
create policy "offer_definition_update_own_org"
  on offer_definition for update
  using  (org_id in (select org_id from users where id = auth.uid()))
  with check (org_id in (select org_id from users where id = auth.uid()));
