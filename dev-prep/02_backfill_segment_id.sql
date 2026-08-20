-- ============================================================================
-- Backfill: populate survey linkage segment_id from the existing segment_slug
-- ============================================================================
-- Matches each row's segment_slug to the slugified NAME of a segment in that
-- org's latest Step 2 content (step_output where step_id = '2', highest version).
-- Slug formula mirrors the app exactly:  lower(name) with whitespace runs -> '-'
-- (app: name.toLowerCase().replace(/\s+/g, '-')).
--
-- PRE-REQ: every org's Step 2 must have been saved at least once AFTER the
-- stable-ID foundation shipped, so each segment carries an "id" in its JSON.
-- Rows whose slug no longer matches any current segment stay NULL (expected for
-- segments that were renamed before IDs existed) — see verification below.
--
-- Run in DEV, AFTER 01_migration_survey_segment_id.sql. Idempotent (only touches
-- rows where segment_id is still null).
-- ============================================================================

-- ---- survey_links -----------------------------------------------------------
with latest_step2 as (
  select distinct on (workspace_id)
    workspace_id as org_id,
    content
  from public.step_output
  where step_id = '2'
  order by workspace_id, version desc
),
seg as (
  select
    ls.org_id,
    (s->>'id') as segment_id,
    lower(regexp_replace(s->>'name', '\s+', '-', 'g')) as slug
  from latest_step2 ls
  cross join lateral jsonb_array_elements(ls.content->'segments') as s
  where coalesce(s->>'id', '')   <> ''
    and coalesce(s->>'name', '') <> ''
)
update public.survey_links t
set segment_id = seg.segment_id::uuid
from seg
where seg.org_id = t.org_id
  and seg.slug   = t.segment_slug
  and t.segment_id is null;

-- ---- survey_link_responses --------------------------------------------------
with latest_step2 as (
  select distinct on (workspace_id)
    workspace_id as org_id,
    content
  from public.step_output
  where step_id = '2'
  order by workspace_id, version desc
),
seg as (
  select
    ls.org_id,
    (s->>'id') as segment_id,
    lower(regexp_replace(s->>'name', '\s+', '-', 'g')) as slug
  from latest_step2 ls
  cross join lateral jsonb_array_elements(ls.content->'segments') as s
  where coalesce(s->>'id', '')   <> ''
    and coalesce(s->>'name', '') <> ''
)
update public.survey_link_responses t
set segment_id = seg.segment_id::uuid
from seg
where seg.org_id = t.org_id
  and seg.slug   = t.segment_slug
  and t.segment_id is null;

-- ---- verification (run separately; expect 0 or a known-explainable count) ---
-- select count(*) as links_unmatched     from public.survey_links          where segment_id is null;
-- select count(*) as responses_unmatched from public.survey_link_responses where segment_id is null;
-- -- Inspect any leftovers:
-- select org_id, segment_slug, count(*) from public.survey_link_responses
--   where segment_id is null group by org_id, segment_slug order by 3 desc;
