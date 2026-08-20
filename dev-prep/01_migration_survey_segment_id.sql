-- ============================================================================
-- Migration: add stable segment_id to survey linkage tables
-- ============================================================================
-- Part of the "segment as source of truth" work. Survey links and responses
-- currently reference a segment by segment_slug (a slugified NAME), which
-- orphans historical rows whenever a segment is renamed. This adds a stable
-- segment_id (matches the "id" now stored on each Step 2 segment in JSON).
--
-- segment_id is NULLABLE during transition:
--   1. add the column (this file)
--   2. backfill from slug (see 02_backfill_segment_id.sql)
--   3. ship the code cutover so new writes populate it
-- We intentionally do NOT set NOT NULL yet, and do NOT add a foreign key
-- (segments live in step_output JSONB, not their own table).
--
-- >>> APPLY TO DEV FIRST. Do not run against production until validated. <<<
-- When running in dev, this becomes the canonical migration; copy it into
-- supabase/migrations/<timestamp>_survey_segment_id.sql at apply time.
-- ============================================================================

alter table public.survey_links
  add column if not exists segment_id uuid;

alter table public.survey_link_responses
  add column if not exists segment_id uuid;

create index if not exists survey_links_org_segment_idx
  on public.survey_links (org_id, segment_id);

create index if not exists survey_link_responses_org_segment_idx
  on public.survey_link_responses (org_id, segment_id);
