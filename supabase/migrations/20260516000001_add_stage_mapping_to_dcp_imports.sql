alter table dcp_imports
  add column if not exists stage_mapping jsonb;
