-- Migration: create step_output and step_dependency tables
-- Sprint 1, Task 4 — Assembly AI C3 Method OS

-- step_output: stores all wizard and Copilot draft outputs per workspace/step.
-- version is incremented on every save; the latest version is the authoritative draft.
create table if not exists step_output (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null,
  step_id             text not null,
  version             int  not null default 1,
  status              text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved')),
  content             jsonb not null default '{}',
  copilot_assisted    boolean not null default false,
  last_saved_at       timestamptz,
  last_updated_at     timestamptz,
  last_updated_by     uuid,
  original_confidence int,
  last_reviewed_at    timestamptz,
  created_at          timestamptz not null default now()
);

-- Index for the canonical query: latest draft per workspace + step
create index if not exists step_output_workspace_step_version_idx
  on step_output (workspace_id, step_id, version desc);

-- step_dependency: canonical dependency graph for the 38-step C3 process.
-- step_id depends on prerequisite_step_id before Copilot can draft it.
create table if not exists step_dependency (
  step_id              text not null,
  prerequisite_step_id text not null,
  primary key (step_id, prerequisite_step_id)
);

-- Seed the dependency map from CONTEXT.md (canonical — do not modify)
insert into step_dependency (step_id, prerequisite_step_id) values
  ('3.5', '3'),
  ('4',   '1'), ('4',   '3'),
  ('5',   '1'), ('5',   '3'),
  ('6',   '1'), ('6',   '3'),
  ('7',   '3'), ('7',   '4'),
  ('8',   '3'), ('8',   '4'),
  ('9',   '3'), ('9',   '8'),
  ('10',  '3'), ('10',  '8'),
  ('11',  '1'), ('11',  '4'), ('11', '6'),
  ('12',  '11'),
  ('13',  '12'),
  ('14',  '13'),
  ('15',  '11'), ('15', '13'), ('15', '14'),
  ('16',  '3'),  ('16', '11'), ('16', '13'), ('16', '14'),
  ('17',  '11'),
  ('18',  '13'), ('18', '4'),  ('18', '17'),
  ('19',  '17'), ('19', '18'),
  ('20',  '11'),
  ('21',  '11'),
  ('22',  '3'),  ('22', '17'),
  ('25',  '14'),
  ('26',  '14'),
  ('27',  '5'),  ('27', '6'),
  ('28',  '11'), ('28', '14'),
  ('29',  '18'),
  ('30',  '19'), ('30', '6'),
  ('31',  '4'),  ('31', '5'),  ('31', '6'),  ('31', '7'),
  ('32',  '9'),
  ('33',  '9'),  ('33', '22'),
  ('34',  '14'), ('34', '15'), ('34', '17'), ('34', '18'),
  ('36',  '14'), ('36', '15'), ('36', '17'), ('36', '18'),
  ('37',  '32'), ('37', '33'), ('37', '34'), ('37', '35'), ('37', '36')
on conflict do nothing;
