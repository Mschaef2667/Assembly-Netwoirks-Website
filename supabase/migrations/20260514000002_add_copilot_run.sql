-- copilot_run: records every Claude API call made by the Copilot

create table if not exists copilot_run (
  id               uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        not null,
  step_id          text        not null,
  prompt_version   text,
  context_hash     text,
  confidence_score int,
  latency_ms       int,
  assumptions      jsonb       not null default '[]',
  status           text        not null default 'success',
  error_code       text,
  model            text,
  input_tokens     int,
  output_tokens    int,
  created_at       timestamptz not null default now()
);

-- RLS

alter table copilot_run enable row level security;

drop policy if exists "copilot_run_select_own_org" on copilot_run;
create policy "copilot_run_select_own_org"
  on copilot_run for select
  using (
    workspace_id in (select org_id from users where id = auth.uid())
  );

drop policy if exists "copilot_run_insert_own_org" on copilot_run;
create policy "copilot_run_insert_own_org"
  on copilot_run for insert
  with check (
    workspace_id in (select org_id from users where id = auth.uid())
  );
