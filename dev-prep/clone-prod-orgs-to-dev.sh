#!/usr/bin/env bash
# ============================================================================
# Clone Apex Solutions + Assembly Networks from PRODUCTION → DEV (1:1 data).
# ============================================================================
# Makes the dev database's app data match production for both orgs. Supersedes
# copy-assembly-networks-to-dev.sh (this does Apex too, and re-syncs any drift).
#
# Why a script instead of the Cowork connector: the connector caps how much data
# it can move per call. psql streams table-to-table directly with no cap and
# perfect JSON/array escaping — a true clone in seconds.
#
# What it does, per org, for every data-bearing table:
#   DELETE the org's rows in dev, then COPY the org's rows from prod.
#   (Organizations are UPSERTed, never deleted, to avoid FK cascades.)
# Safe: reads prod, writes only dev. Idempotent — rerun anytime to re-sync.
#
# Prereq: psql installed. Get both connection strings from
#   Supabase → <project> → Connect → psql (session pooler is fine).
# ============================================================================
set -euo pipefail

PROD_URL="${PROD_URL:?set PROD_URL to the production psql connection string}"
DEV_URL="${DEV_URL:?set DEV_URL to the Assembly-AI-dev psql connection string}"

APEX='f2515586-4e1e-4e8a-999f-40c82da1786e'   # Apex Solutions
AN='35e0e4b7-9427-448a-b4df-9d9f0bde1873'      # Assembly Networks
ORGS="'$APEX','$AN'"

# --- 1. organizations: upsert (stream prod rows into a temp table, then merge)
echo "Upserting organizations ..."
ORG_COLS="id,name,slug,industry,website,logo_url,status,created_at,updated_at,preferred_model,plan"
TMP_SQL="$(mktemp)"
cat > "$TMP_SQL" <<SQL
create temp table _stage (like public.organizations including defaults);
\copy _stage ($ORG_COLS) from stdin with (format csv)
insert into public.organizations ($ORG_COLS)
select $ORG_COLS from _stage
on conflict (id) do update set
  name=excluded.name, slug=excluded.slug, industry=excluded.industry,
  website=excluded.website, logo_url=excluded.logo_url, status=excluded.status,
  updated_at=excluded.updated_at, preferred_model=excluded.preferred_model, plan=excluded.plan;
SQL
psql "$PROD_URL" -v ON_ERROR_STOP=1 \
  -c "\copy (select $ORG_COLS from public.organizations where id in ($ORGS)) to stdout with (format csv)" \
| psql "$DEV_URL" -v ON_ERROR_STOP=1 -f "$TMP_SQL"
rm -f "$TMP_SQL"

# --- 2. child tables: delete + copy, in FK-safe order --------------------------
sync() {  # $1=table  $2=keycol  $3=columns
  echo "Syncing $1 ..."
  psql "$DEV_URL" -v ON_ERROR_STOP=1 -c "delete from public.$1 where $2 in ($ORGS);"
  psql "$PROD_URL" -v ON_ERROR_STOP=1 \
    -c "\copy (select $3 from public.$1 where $2 in ($ORGS)) to stdout with (format csv)" \
  | psql "$DEV_URL" -v ON_ERROR_STOP=1 -c "\copy public.$1 ($3) from stdin with (format csv)"
}

# journey content (last_updated_by omitted -> defaults null, avoids user FK)
sync step_output workspace_id \
  "id,workspace_id,step_id,version,status,content,copilot_assisted,last_saved_at,last_updated_at,original_confidence,last_reviewed_at,created_at"

sync survey_links org_id \
  "id,org_id,segment_slug,segment_name,audience,token,questions,is_active,created_at,expires_at"

sync survey_link_responses org_id \
  "id,survey_link_id,org_id,segment_slug,audience,respondent_name,respondent_title,respondent_company,respondent_size,respondent_industry,answers,submitted_at,decision_role,source,customer_category"

sync icp_baseline_profile org_id \
  "id,org_id,category,profile_type,customer_name,contact_name,contact_title,segment_index,segment_name,industry,company_size,why_fits,additional_context,created_at,updated_at"

sync icp_definition org_id \
  "id,org_id,segment_name,segment_index,buyer_type,job_titles,company_size_range,industry_verticals,decision_making_power,budget_range,buying_motion,primary_challenges,barriers_to_success,the_big_win,success_metrics,buying_triggers,information_sources,preferred_communication,purchase_criteria,buyer_values,common_objections,risk_sensitivities,tech_stack,buying_urgency_trigger,copilot_generated,created_at,updated_at,is_primary"

# dcp_analysis (approved_by omitted -> avoids user FK)
sync dcp_analysis org_id \
  "id,org_id,stage_summaries,overall_confidence,status,submitted_at,approved_at,created_at,updated_at,analysis_version"

# AI run telemetry (no user FK)
sync copilot_run workspace_id \
  "id,workspace_id,step_id,prompt_version,context_hash,confidence_score,latency_ms,assumptions,status,error_code,model,input_tokens,output_tokens,created_at"

# --- 3. OPTIONAL: to view Assembly Networks in dev under your existing login,
#        point your dev user at it (reversible — set back to $APEX to see Apex):
# psql "$DEV_URL" -c "update public.users set org_id='$AN' where email='mschaef+apex@gmail.com';"

echo "Done. Verifying dev row counts:"
psql "$DEV_URL" -c "
  select o.name,
    (select count(*) from public.step_output s where s.workspace_id=o.id) as steps,
    (select count(*) from public.survey_link_responses r where r.org_id=o.id) as responses,
    (select count(*) from public.copilot_run c where c.workspace_id=o.id) as copilot_runs
  from public.organizations o where o.id in ($ORGS) order by o.name;"
