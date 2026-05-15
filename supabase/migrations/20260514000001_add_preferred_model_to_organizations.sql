-- Migration: add preferred_model column to organizations
-- Stores the workspace's preferred Claude model string.
-- Default: claude-sonnet-4-5 (Sonnet — fast and cost-efficient).

alter table organizations
  add column if not exists preferred_model text not null default 'claude-sonnet-4-5';
