-- ── Intelligence Phase 1 tables ──────────────────────────────────────────────

-- dcp_questions: system question library for DCP surveys (not org-scoped)
create table if not exists dcp_questions (
  id           uuid    primary key default gen_random_uuid(),
  stage_number int     not null,
  stage_name   text    not null,
  question_text text   not null,
  sub_bullets  jsonb   not null default '[]',
  is_starter   boolean not null default false,
  created_at   timestamptz default now()
);

alter table dcp_questions enable row level security;

drop policy if exists "dcp_questions_select_authenticated" on dcp_questions;
create policy "dcp_questions_select_authenticated"
  on dcp_questions for select
  using (exists (select 1 from users where id = auth.uid()));

-- workspace_survey: per-org saved survey configuration
create table if not exists workspace_survey (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id),
  selected_question_ids jsonb not null default '[]',
  customized_questions jsonb not null default '[]',
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique (org_id)
);

alter table workspace_survey enable row level security;

drop policy if exists "workspace_survey_select_own_org" on workspace_survey;
create policy "workspace_survey_select_own_org"
  on workspace_survey for select
  using (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "workspace_survey_insert_own_org" on workspace_survey;
create policy "workspace_survey_insert_own_org"
  on workspace_survey for insert
  with check (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "workspace_survey_update_own_org" on workspace_survey;
create policy "workspace_survey_update_own_org"
  on workspace_survey for update
  using  (org_id in (select org_id from users where id = auth.uid()))
  with check (org_id in (select org_id from users where id = auth.uid()));

-- survey_responses: imported survey response data
create table if not exists survey_responses (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  raw_csv          text,
  parsed_responses jsonb,
  response_count   int,
  imported_at      timestamptz default now()
);

alter table survey_responses enable row level security;

drop policy if exists "survey_responses_select_own_org" on survey_responses;
create policy "survey_responses_select_own_org"
  on survey_responses for select
  using (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "survey_responses_insert_own_org" on survey_responses;
create policy "survey_responses_insert_own_org"
  on survey_responses for insert
  with check (org_id in (select org_id from users where id = auth.uid()));

-- dcp_maps: Copilot-generated DCP analysis (one per org)
create table if not exists dcp_maps (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null,
  stage_summaries   jsonb,
  overall_confidence int,
  status            text not null default 'draft',
  submitted_at      timestamptz,
  approved_at       timestamptz,
  approved_by       uuid,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (org_id)
);

alter table dcp_maps enable row level security;

drop policy if exists "dcp_maps_select_own_org" on dcp_maps;
create policy "dcp_maps_select_own_org"
  on dcp_maps for select
  using (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "dcp_maps_insert_own_org" on dcp_maps;
create policy "dcp_maps_insert_own_org"
  on dcp_maps for insert
  with check (org_id in (select org_id from users where id = auth.uid()));

drop policy if exists "dcp_maps_update_own_org" on dcp_maps;
create policy "dcp_maps_update_own_org"
  on dcp_maps for update
  using  (org_id in (select org_id from users where id = auth.uid()))
  with check (org_id in (select org_id from users where id = auth.uid()));

-- ── Seed: DCP question library (all starter questions) ────────────────────────

insert into dcp_questions (stage_number, stage_name, question_text, sub_bullets, is_starter) values

-- Stage 1: Need Recognition
(1, 'Need Recognition',
 'What problem or need did you first realize you had that [PRODUCT/SERVICE] could address?',
 '["a. What was the impact if you did nothing?", "b. Who felt the pain most?"]',
 true),
(1, 'Need Recognition',
 'How were you handling this before you considered any solution?',
 '["a. What worked OK?", "b. What was breaking down?"]',
 true),
(1, 'Need Recognition',
 'What changed internally that made this feel worth solving now?',
 '["a. Growth, churn, cost pressure, compliance, staffing?"]',
 true),

-- Stage 2: Trigger / Catalyst
(2, 'Trigger / Catalyst',
 'What specific event triggered you to start actively looking for a solution?',
 '["a. Deadline, outage, executive mandate, lost deal, renewal, audit?"]',
 true),
(2, 'Trigger / Catalyst',
 'Why did this trigger matter now versus earlier?',
 '["a. What changed in urgency or priority?"]',
 true),
(2, 'Trigger / Catalyst',
 'Who pushed the decision forward and what did they say to create momentum?',
 '["a. Who had the strongest influence?"]',
 true),

-- Stage 3: Search / Awareness
(3, 'Search / Awareness',
 'Who conducted the search, and how did they do it?',
 '["a. Google, peers, communities, analysts, vendors, events?"]',
 true),
(3, 'Search / Awareness',
 'What keywords, questions, or phrases did you use when searching?',
 '["a. What problem-language did you use (not vendor names)?"]',
 true),
(3, 'Search / Awareness',
 'What sources did you trust most and why?',
 '["a. Peers vs reviews vs analysts vs internal experts?"]',
 true),

-- Stage 4: Evaluation / Consideration
(4, 'Evaluation / Consideration',
 'What did your evaluation process look like step-by-step?',
 '["a. Demos", "b. POC/trial", "c. References", "d. Business case", "e. Procurement/legal"]',
 true),
(4, 'Evaluation / Consideration',
 'How long did evaluation take, and what accelerated or delayed it?',
 '["a. What was the biggest bottleneck?"]',
 true),
(4, 'Evaluation / Consideration',
 'What concerns or objections came up and how were they resolved?',
 '["a. Which objections almost killed it?"]',
 true),

-- Stage 5: Select-Set / Shortlist
(5, 'Select-Set / Shortlist',
 'What types of companies made it onto your shortlist?',
 '["a. Specialist vs platform vs incumbent?"]',
 true),
(5, 'Select-Set / Shortlist',
 'What was the minimum table stakes requirement to be considered?',
 '["a. What was non-negotiable?"]',
 true),
(5, 'Select-Set / Shortlist',
 'How many vendors did you seriously consider, and why that number?',
 '["a. What narrowed it down?"]',
 true),

-- Stage 6: Decision / Purchase
(6, 'Decision / Purchase',
 'Who ultimately made the final decision, and who influenced it most?',
 '["a. Who could block the purchase?"]',
 true),
(6, 'Decision / Purchase',
 'What was the final moment of truth that tipped the decision?',
 '["a. A reference call? pricing concession? pilot results?"]',
 true),
(6, 'Decision / Purchase',
 'What were the top 3 reasons you chose the winning solution - rank them.',
 '["a. What evidence supported each?"]',
 true),

-- Stage 7: Confirmation / Validation
(7, 'Confirmation / Validation',
 'After purchase, what did you do to confirm you made the right choice?',
 '["a. What signals did you look for?"]',
 true),
(7, 'Confirmation / Validation',
 'What outcomes did you expect in the first 30/60/90 days?',
 '["a. Which mattered most?"]',
 true),
(7, 'Confirmation / Validation',
 'What would make you feel regret or doubt about the decision?',
 '["a. What are the early warning signs?"]',
 true),
(7, 'Confirmation / Validation',
 'What has been the biggest friction point post-purchase?',
 '["a. Onboarding, adoption, integrations, change management?"]',
 true)

on conflict do nothing;
