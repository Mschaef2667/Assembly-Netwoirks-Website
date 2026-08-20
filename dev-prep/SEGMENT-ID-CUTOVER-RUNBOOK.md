# Segment-ID Survey Linkage Cutover — Dev Runbook

**Goal:** stop survey links and responses from orphaning when a segment is renamed, by keying them off the stable segment `id` (already in Step 2 JSON) instead of `segment_slug`.

**Status going in:** the stable-ID *foundation* is already live on `main` — every Step 2 segment now carries an `id`. This runbook does the database + code cutover, **dev-first**.

**Golden rule:** every step below runs against **dev** first. Production only happens at Phase 5, after dev is validated.

---

## Order of operations (do not reorder)

### Phase 0 — Make sure segments have IDs
IDs are generated the first time Step 2 is saved after the foundation shipped.

- For each active org (Assembly Networks, and Apex if populated), open the journey **Step 2** and save it once (any trivial edit + blur, or re-save).
- Confirm in dev:
  ```sql
  select workspace_id,
         jsonb_agg(s->>'id') as segment_ids
  from public.step_output,
       lateral jsonb_array_elements(content->'segments') s
  where step_id = '2'
  group by workspace_id;
  ```
  Every segment should show a non-empty UUID. Blank IDs mean that org's Step 2 hasn't been re-saved yet — fix before backfilling.

### Phase 1 — Schema (dev)
- Apply `01_migration_survey_segment_id.sql` to the **dev** Supabase project.
- Adds nullable `segment_id uuid` to `survey_links` and `survey_link_responses` + supporting indexes. No FK, no NOT NULL yet.

### Phase 2 — Backfill (dev)
- Run `02_backfill_segment_id.sql` against dev.
- Then run the verification queries at the bottom of that file. Unmatched count should be **0**, or a small number you can explain (segments renamed before IDs existed — those keep matching by slug via the fallback, so they're not broken, just not upgraded).

### Phase 3 — Code cutover (dev branch)
Make new writes populate `segment_id`, and switch reads to prefer it (slug stays as fallback so nothing regresses). Files and the specific edits:

1. **`components/survey-builder/useSurveyState.ts`** (parseSegments, ~lines 18 & 27)
   - Currently builds `{ id: name, name, slug }` — the `id` is the *name*, not the stable ID.
   - Change to read the real segment ID from Step 2 JSON: `id: String(s['id'] ?? '')`, keep `slug` for fallback. (Add an `id` field to the local Segment shape.)

2. **`app/api/survey-builder/generate-link/route.ts`**
   - Accept `segmentId` in the request body and include `segment_id: segmentId ?? null` in the `survey_links` insert.

3. **Callers of generate-link** — pass the segment's stable `id`:
   - `components/survey-builder/SurveyCopilotPanel.tsx` (~line 104): add `segmentId: selectedSegment.id` alongside `segmentSlug`.
   - Check `app/dashboard/target-markets/page.tsx` for any generate-link call and pass `segmentId` there too.

4. **`app/api/survey/submit/route.ts`**
   - Add `segment_id` to the `survey_links` select (~line 36) and write `segment_id: link.segment_id ?? null` on the `survey_link_responses` insert.

5. **`app/dashboard/intelligence/responses/page.tsx`**
   - `parseSegments` (~line 143): carry `id` on the `Segment` shape.
   - Build the decision-maker map by segment **id** (`dmsById`) in addition to slug; in `inheritedRiskFor`, look up by `resp.segment_id` first, fall back to `dmsBySlug[resp.segment_slug]`.
   - `segmentNameFromSlug`: add an id-based lookup path for rows that now carry `segment_id`.
   - Add `segment_id` to the `ViewResponse` interface and the `.select(...)` at ~line 563.

Verify after edits (recreate the throwaway config first):
```bash
cat > tsconfig.verify.json <<'EOF'
{ "extends": "./tsconfig.json", "exclude": ["node_modules", ".next"] }
EOF
npx tsc --noEmit -p tsconfig.verify.json
npx eslint <changed files>
rm -f tsconfig.verify.json
```
(Leave the 4–5 known pre-existing `set-state-in-effect` errors alone; only new problems matter.)

### Phase 4 — Test in dev
- Generate a fresh survey link, submit a response → confirm `segment_id` is populated on both the link and the response.
- **Rename a segment** in Step 2, then reload the Response Manager → the old responses should still group under the renamed segment, and decision-maker risk inheritance should still resolve.
- Confirm existing (pre-backfill) responses still display correctly via the slug fallback.

### Phase 5 — Promote to production
Only after Phase 4 passes in dev:
1. Apply `01_migration_...sql` to production (copy into `supabase/migrations/<timestamp>_survey_segment_id.sql` as the canonical migration).
2. Ensure prod orgs' Step 2 have IDs (Phase 0), then run `02_backfill_...sql` against prod and verify.
3. Merge the Phase 3 code to `main` (build → targeted `git add` → push).

---

## Guardrails & rollback
- `segment_id` is **additive and nullable**; all reads fall back to `segment_slug`, so partial state is safe at every point.
- **Rollback** = revert the Phase 3 code. The columns can stay (harmless) or be dropped:
  ```sql
  alter table public.survey_links            drop column if exists segment_id;
  alter table public.survey_link_responses   drop column if exists segment_id;
  ```
- Do not add `NOT NULL` or a foreign key on `segment_id` — segments live in JSONB, and historical rows may legitimately stay null.
- Re-verify the exact line numbers/shapes above against current code at execution time; they were accurate as of the foundation commit.
