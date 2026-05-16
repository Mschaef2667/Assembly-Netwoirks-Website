-- Cumulative import batches stored as a JSONB array on the existing dcp_imports row
alter table dcp_imports
  add column if not exists batches jsonb not null default '[]';

-- Track how many times analysis has been re-run for a workspace
alter table dcp_analysis
  add column if not exists analysis_version int not null default 1;
