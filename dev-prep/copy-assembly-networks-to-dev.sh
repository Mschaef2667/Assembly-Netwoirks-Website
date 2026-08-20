#!/usr/bin/env bash
# ============================================================================
# Copy Assembly Networks' worked data from PRODUCTION → DEV (dev sandbox).
# ============================================================================
# Why a script (not the Cowork connector): the connector caps how much data it
# returns per call, and Assembly Networks' journey content is large nested JSON.
# psql streams each table directly prod→dev with no cap and perfect escaping.
#
# Safe: reads from prod, writes only to dev. Idempotent-ish — run against a dev
# where Assembly Networks does NOT yet exist (the org was intentionally left out;
# a prior partial insert was reverted, so dev currently has only Apex).
#
# Prereq: psql installed. Get both connection strings from
#   Supabase Dashboard → <project> → Connect → "psql" (session pooler is fine).
# ============================================================================
set -euo pipefail

# ---- fill these in (or export before running) ------------------------------
PROD_URL="${PROD_URL:?set PROD_URL to the production psql connection string}"
DEV_URL="${DEV_URL:?set DEV_URL to the Assembly-AI-dev psql connection string}"

AN='35e0e4b7-9427-448a-b4df-9d9f0bde1873'        # Assembly Networks org id
DEV_USER='729f3eef-1e46-4467-9dcf-44030fde8cd4'  # dev user mschaef+apex@gmail.com

copy() {  # copy "<select from prod>" "<target table (cols)>"
  echo "  → $2"
  psql "$PROD_URL" -v ON_ERROR_STOP=1 -c "\copy ($1) to stdout with (format csv)" \
  | psql "$DEV_URL" -v ON_ERROR_STOP=1 -c "\copy $2 from stdin with (format csv)"
}

echo "Copying Assembly Networks ($AN) prod → dev ..."

# 1. organization (must exist before its child rows)
copy "select id,name,slug,industry,website,logo_url,status,created_at,updated_at,preferred_model,plan from public.organizations where id='$AN'" \
     "public.organizations (id,name,slug,industry,website,logo_url,status,created_at,updated_at,preferred_model,plan)"

# 2. journey content (last_updated_by omitted → defaults null, avoids user FK)
copy "select id,workspace_id,step_id,version,status,content,copilot_assisted,last_saved_at,last_updated_at,original_confidence,last_reviewed_at,created_at from public.step_output where workspace_id='$AN'" \
     "public.step_output (id,workspace_id,step_id,version,status,content,copilot_assisted,last_saved_at,last_updated_at,original_confidence,last_reviewed_at,created_at)"

# 3. survey links (before responses — FK)
copy "select id,org_id,segment_slug,segment_name,audience,token,questions,is_active,created_at,expires_at from public.survey_links where org_id='$AN'" \
     "public.survey_links (id,org_id,segment_slug,segment_name,audience,token,questions,is_active,created_at,expires_at)"

# 4. survey responses
copy "select id,survey_link_id,org_id,segment_slug,audience,respondent_name,respondent_title,respondent_company,respondent_size,respondent_industry,answers,submitted_at,decision_role,source,customer_category from public.survey_link_responses where org_id='$AN'" \
     "public.survey_link_responses (id,survey_link_id,org_id,segment_slug,audience,respondent_name,respondent_title,respondent_company,respondent_size,respondent_industry,answers,submitted_at,decision_role,source,customer_category)"

# 5. ICP baseline profiles (ICP Calibrator Step 1)
copy "select id,org_id,category,profile_type,customer_name,contact_name,contact_title,segment_index,segment_name,industry,company_size,why_fits,additional_context,created_at,updated_at from public.icp_baseline_profile where org_id='$AN'" \
     "public.icp_baseline_profile (id,org_id,category,profile_type,customer_name,contact_name,contact_title,segment_index,segment_name,industry,company_size,why_fits,additional_context,created_at,updated_at)"

# 6. ICP definitions
copy "select id,org_id,segment_name,segment_index,buyer_type,job_titles,company_size_range,industry_verticals,decision_making_power,budget_range,buying_motion,primary_challenges,barriers_to_success,the_big_win,success_metrics,buying_triggers,information_sources,preferred_communication,purchase_criteria,buyer_values,common_objections,risk_sensitivities,tech_stack,buying_urgency_trigger,copilot_generated,created_at,updated_at,is_primary from public.icp_definition where org_id='$AN'" \
     "public.icp_definition (id,org_id,segment_name,segment_index,buyer_type,job_titles,company_size_range,industry_verticals,decision_making_power,budget_range,buying_motion,primary_challenges,barriers_to_success,the_big_win,success_metrics,buying_triggers,information_sources,preferred_communication,purchase_criteria,buyer_values,common_objections,risk_sensitivities,tech_stack,buying_urgency_trigger,copilot_generated,created_at,updated_at,is_primary)"

# 7. DCP analysis (approved_by omitted → avoids user FK)
copy "select id,org_id,stage_summaries,overall_confidence,status,submitted_at,approved_at,created_at,updated_at,analysis_version from public.dcp_analysis where org_id='$AN'" \
     "public.dcp_analysis (id,org_id,stage_summaries,overall_confidence,status,submitted_at,approved_at,created_at,updated_at,analysis_version)"

# 8. Point the dev login at Assembly Networks so it's what you see after login.
#    (Reversible: set org_id back to Apex 'f2515586-4e1e-4e8a-999f-40c82da1786e'.)
psql "$DEV_URL" -v ON_ERROR_STOP=1 -c \
  "update public.users set org_id='$AN' where id='$DEV_USER';"

echo "Done. Verifying row counts in dev:"
psql "$DEV_URL" -c \
  "select 'step_output' t, count(*) from public.step_output where workspace_id='$AN'
   union all select 'survey_link_responses', count(*) from public.survey_link_responses where org_id='$AN'
   union all select 'icp_baseline_profile', count(*) from public.icp_baseline_profile where org_id='$AN';"
