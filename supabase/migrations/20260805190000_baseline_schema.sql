-- Baseline schema migration for Assembly AI (public schema).
--
-- Captured from the live PRODUCTION database on 2026-08-05 via the Supabase
-- connector, to make the repo the source of truth after months of changes were
-- applied directly to prod. Reconstructed from the catalog: extensions, enum
-- types, tables, functions, constraints, indexes, RLS + policies, triggers, and
-- grants. Managed schemas (auth, storage, graphql, vault, etc.) are provided by
-- Supabase on a fresh project and are intentionally NOT recreated here.
--
-- NOTE: this is a catalog reconstruction, not a native `supabase db pull`. It has
-- been validated by applying it to a fresh dev project and comparing object
-- counts against prod. Cross-check against a real `db pull` when convenient.

set search_path = public, extensions;

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ── Enum types ────────────────────────────────────────────────────────────────
CREATE TYPE public.asset_status AS ENUM ('draft', 'pending_approval', 'approved', 'archived');
CREATE TYPE public.asset_type AS ENUM ('playbook', 'talk_track', 'objection_handler', 'case_study', 'battle_card', 'email_template', 'messaging_guide', 'action_plan', 'other');
CREATE TYPE public.c3_project_status AS ENUM ('not_started', 'in_progress', 'gate1_pending', 'gate1_approved', 'gate2_pending', 'gate2_approved', 'complete');
CREATE TYPE public.crm_export_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE public.dcp_map_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected');
CREATE TYPE public.org_status AS ENUM ('trial', 'active', 'suspended', 'churned');
CREATE TYPE public.question_type AS ENUM ('text', 'multiple_choice', 'rating', 'ranking', 'yes_no', 'matrix');
CREATE TYPE public.stage_status AS ENUM ('locked', 'in_progress', 'complete');
CREATE TYPE public.survey_audience AS ENUM ('customer', 'employee', 'partner', 'competitor');
CREATE TYPE public.survey_response_mode AS ENUM ('anonymous', 'identified');
CREATE TYPE public.survey_status AS ENUM ('draft', 'active', 'closed', 'archived');
CREATE TYPE public.user_role AS ENUM ('super_admin', 'org_admin', 'ceo', 'coo', 'marketing_leadership', 'sales_leadership', 'cs_leadership', 'product_leadership', 'sales_rep', 'surveyor');

-- ── Tables ────────────────────────────────────────────────────────────────────
CREATE TABLE public.action_plans (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  c3_project_id uuid NOT NULL,
  status stage_status DEFAULT 'locked'::stage_status NOT NULL,
  day_30_goals jsonb,
  day_60_goals jsonb,
  day_90_goals jsonb,
  assigned_owners jsonb,
  kpis jsonb,
  governance_playbook text,
  ai_model_version text,
  completed_by uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.assets (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  c3_project_id uuid,
  asset_type asset_type NOT NULL,
  title text NOT NULL,
  description text,
  content jsonb,
  version integer DEFAULT 1 NOT NULL,
  status asset_status DEFAULT 'draft'::asset_status NOT NULL,
  tags text[],
  persona_ids uuid[],
  published_at timestamp with time zone,
  published_by uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.beta_agreements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  agreed_at timestamp with time zone DEFAULT now(),
  ip_address text,
  agreement_version text DEFAULT 'beta-v1'::text,
  user_agent text
);
CREATE TABLE public.beta_feedback (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  page_url text,
  step_id text,
  type text NOT NULL,
  message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone
);
CREATE TABLE public.c3_projects (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  dcp_map_id uuid,
  name text NOT NULL,
  status c3_project_status DEFAULT 'not_started'::c3_project_status NOT NULL,
  gate2_submitted_at timestamp with time zone,
  gate2_submitted_by uuid,
  gate2_approved_at timestamp with time zone,
  gate2_approved_by uuid,
  gate2_rejection_reason text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.company_formulas (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  c3_project_id uuid NOT NULL,
  status stage_status DEFAULT 'locked'::stage_status NOT NULL,
  value_creation_formula text,
  desired_outcomes text[],
  fit_criteria jsonb,
  anti_fit_criteria jsonb,
  ai_model_version text,
  completed_by uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.company_profiles (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  industry text,
  markets_served text[],
  core_offerings jsonb,
  revenue_range text,
  employee_count_range text,
  geographic_focus text[],
  founded_year integer,
  mission_statement text,
  vision_statement text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.competitive_environments (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  c3_project_id uuid NOT NULL,
  status stage_status DEFAULT 'locked'::stage_status NOT NULL,
  competitors jsonb,
  decision_criteria jsonb,
  positioning_matrix jsonb,
  positioning_stance text,
  ai_model_version text,
  completed_by uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.contacts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  first_name text,
  last_name text,
  email text,
  company_name text,
  job_title text,
  phone text,
  linkedin_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.copilot_run (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  step_id text NOT NULL,
  prompt_version text,
  context_hash text,
  confidence_score integer,
  latency_ms integer,
  assumptions jsonb DEFAULT '[]'::jsonb NOT NULL,
  status text DEFAULT 'success'::text NOT NULL,
  error_code text,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.crm_exports (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  asset_id uuid,
  crm_type text,
  crm_record_id text,
  crm_record_type text,
  payload jsonb,
  status crm_export_status DEFAULT 'pending'::crm_export_status NOT NULL,
  error_message text,
  exported_at timestamp with time zone,
  exported_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.dcp_analysis (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  stage_summaries jsonb,
  overall_confidence integer,
  status text DEFAULT 'draft'::text NOT NULL,
  submitted_at timestamp with time zone,
  approved_at timestamp with time zone,
  approved_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  analysis_version integer DEFAULT 1 NOT NULL
);
CREATE TABLE public.dcp_imports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  raw_csv text,
  parsed_responses jsonb,
  response_count integer,
  imported_at timestamp with time zone DEFAULT now() NOT NULL,
  stage_mapping jsonb,
  batches jsonb DEFAULT '[]'::jsonb NOT NULL
);
CREATE TABLE public.dcp_maps (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  status dcp_map_status DEFAULT 'draft'::dcp_map_status NOT NULL,
  summary text,
  clustered_themes jsonb,
  raw_evidence jsonb,
  ai_model_version text,
  submitted_at timestamp with time zone,
  submitted_by uuid,
  approved_at timestamp with time zone,
  approved_by uuid,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.dcp_questions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  stage_number integer NOT NULL,
  stage_name text NOT NULL,
  question_text text NOT NULL,
  sub_bullets jsonb DEFAULT '[]'::jsonb NOT NULL,
  is_starter boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.demo_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  first_name text,
  last_name text,
  email text NOT NULL,
  company text,
  job_title text,
  goals text,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address text,
  provisioned_at timestamp with time zone,
  provisioned_org_id uuid
);
CREATE TABLE public.endemic_problems (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  c3_project_id uuid NOT NULL,
  problem_statement text NOT NULL,
  priority_rank integer,
  evidence_snippets jsonb,
  catalyst_triggers text[],
  affected_personas uuid[],
  dcp_cluster_ref text,
  ai_generated boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.icp_baseline_profile (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  category text NOT NULL,
  profile_type text DEFAULT 'current'::text NOT NULL,
  customer_name text,
  contact_name text,
  contact_title text,
  segment_index integer,
  segment_name text,
  industry text,
  company_size text,
  why_fits text,
  additional_context text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.icp_definition (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  segment_name text NOT NULL,
  segment_index integer NOT NULL,
  buyer_type text DEFAULT 'economic_buyer'::text NOT NULL,
  job_titles jsonb DEFAULT '[]'::jsonb NOT NULL,
  company_size_range text,
  industry_verticals jsonb DEFAULT '[]'::jsonb NOT NULL,
  decision_making_power text,
  budget_range text,
  buying_motion text,
  primary_challenges jsonb DEFAULT '[]'::jsonb NOT NULL,
  barriers_to_success jsonb DEFAULT '[]'::jsonb NOT NULL,
  the_big_win text,
  success_metrics jsonb DEFAULT '[]'::jsonb NOT NULL,
  buying_triggers jsonb DEFAULT '[]'::jsonb NOT NULL,
  information_sources jsonb DEFAULT '[]'::jsonb NOT NULL,
  preferred_communication text,
  purchase_criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
  buyer_values text,
  common_objections jsonb DEFAULT '[]'::jsonb NOT NULL,
  risk_sensitivities text,
  tech_stack text,
  buying_urgency_trigger text,
  copilot_generated boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_primary boolean DEFAULT false NOT NULL
);
CREATE TABLE public.offer_definition (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  icp_id uuid NOT NULL,
  offer_name text NOT NULL,
  key_outcome text,
  price_range text,
  primary_differentiator text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.organizations (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  industry text,
  website text,
  logo_url text,
  status org_status DEFAULT 'trial'::org_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  preferred_model text DEFAULT 'claude-sonnet-4-5'::text NOT NULL,
  plan text
);
CREATE TABLE public.personas (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  company_profile_id uuid NOT NULL,
  name text NOT NULL,
  role_title text,
  department text,
  buying_role text,
  goals text[],
  pain_points text[],
  decision_criteria text[],
  preferred_channels text[],
  is_icp boolean DEFAULT false NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.questions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  survey_id uuid NOT NULL,
  question_text text NOT NULL,
  question_type question_type DEFAULT 'text'::question_type NOT NULL,
  options jsonb,
  is_required boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  ai_generated boolean DEFAULT false NOT NULL,
  dcp_category text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.response_answers (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  survey_response_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer_text text,
  answer_value jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.stage_company_foundation (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  c3_project_id uuid NOT NULL,
  status stage_status DEFAULT 'locked'::stage_status NOT NULL,
  foundation_brief text,
  icp_summary text,
  persona_ids uuid[],
  ai_model_version text,
  completed_by uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.step_definition (
  id text NOT NULL,
  title text NOT NULL,
  description text,
  section text,
  phase integer
);
CREATE TABLE public.step_dependency (
  step_id text NOT NULL,
  prerequisite_step_id text NOT NULL
);
CREATE TABLE public.step_output (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  step_id text NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  content jsonb DEFAULT '{}'::jsonb NOT NULL,
  copilot_assisted boolean DEFAULT false NOT NULL,
  last_saved_at timestamp with time zone,
  last_updated_at timestamp with time zone,
  last_updated_by uuid,
  original_confidence integer,
  last_reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.strategic_messages (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  c3_project_id uuid NOT NULL,
  status stage_status DEFAULT 'locked'::stage_status NOT NULL,
  activation_win text,
  messaging_architecture jsonb,
  talk_tracks jsonb,
  proof_points jsonb,
  objection_handlers jsonb,
  persona_id uuid,
  ai_model_version text,
  completed_by uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.survey_link_responses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  survey_link_id uuid NOT NULL,
  org_id uuid NOT NULL,
  segment_slug text NOT NULL,
  audience text NOT NULL,
  respondent_name text,
  respondent_title text,
  respondent_company text,
  respondent_size text,
  respondent_industry text,
  answers jsonb,
  submitted_at timestamp with time zone DEFAULT now(),
  decision_role text,
  source text,
  customer_category text
);
CREATE TABLE public.survey_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  segment_slug text NOT NULL,
  segment_name text NOT NULL,
  audience text NOT NULL,
  token uuid DEFAULT gen_random_uuid() NOT NULL,
  questions jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone
);
CREATE TABLE public.survey_responses (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  survey_id uuid NOT NULL,
  contact_id uuid,
  anonymous_token uuid DEFAULT uuid_generate_v4(),
  ip_hash text,
  user_agent text,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  is_complete boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.surveys (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  audience survey_audience NOT NULL,
  response_mode survey_response_mode DEFAULT 'anonymous'::survey_response_mode NOT NULL,
  status survey_status DEFAULT 'draft'::survey_status NOT NULL,
  share_token uuid DEFAULT uuid_generate_v4(),
  opens_at timestamp with time zone,
  closes_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.usage_events (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  user_id uuid,
  event_type text NOT NULL,
  context jsonb,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  org_id uuid NOT NULL,
  role user_role DEFAULT 'sales_rep'::user_role NOT NULL,
  first_name text,
  last_name text,
  email text NOT NULL,
  avatar_url text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_super_admin boolean DEFAULT false NOT NULL
);
CREATE TABLE public.whitepaper_leads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  first_name text,
  last_name text,
  email text NOT NULL,
  company text,
  job_title text,
  situation text,
  downloaded_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address text
);
CREATE TABLE public.workspace_survey (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  selected_question_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  customized_questions jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ── Functions (helpers + trigger fn; created after the tables they read) ───────
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auth_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT org_id FROM users WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role FROM users WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role = 'super_admin' FROM users WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_org_admin_or_above()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role IN ('super_admin', 'org_admin') FROM users WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_leadership()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role IN (
    'super_admin', 'org_admin',
    'ceo', 'coo',
    'marketing_leadership', 'sales_leadership',
    'cs_leadership', 'product_leadership'
  ) FROM users WHERE id = auth.uid();
$function$;

-- ── Primary keys, unique + check constraints ──────────────────────────────────
ALTER TABLE public.action_plans ADD CONSTRAINT action_plans_pkey PRIMARY KEY (id);
ALTER TABLE public.assets ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
ALTER TABLE public.beta_agreements ADD CONSTRAINT beta_agreements_pkey PRIMARY KEY (id);
ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_type_check CHECK ((type = ANY (ARRAY['thumbs_up'::text, 'thumbs_down'::text, 'issue'::text, 'idea'::text])));
ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_pkey PRIMARY KEY (id);
ALTER TABLE public.c3_projects ADD CONSTRAINT c3_projects_pkey PRIMARY KEY (id);
ALTER TABLE public.c3_projects ADD CONSTRAINT c3_projects_org_id_key UNIQUE (org_id);
ALTER TABLE public.company_formulas ADD CONSTRAINT company_formulas_pkey PRIMARY KEY (id);
ALTER TABLE public.company_profiles ADD CONSTRAINT company_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.company_profiles ADD CONSTRAINT company_profiles_org_id_key UNIQUE (org_id);
ALTER TABLE public.competitive_environments ADD CONSTRAINT competitive_environments_pkey PRIMARY KEY (id);
ALTER TABLE public.contacts ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.copilot_run ADD CONSTRAINT copilot_run_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_exports ADD CONSTRAINT crm_exports_pkey PRIMARY KEY (id);
ALTER TABLE public.dcp_analysis ADD CONSTRAINT dcp_analysis_pkey PRIMARY KEY (id);
ALTER TABLE public.dcp_analysis ADD CONSTRAINT dcp_analysis_org_id_key UNIQUE (org_id);
ALTER TABLE public.dcp_imports ADD CONSTRAINT dcp_imports_pkey PRIMARY KEY (id);
ALTER TABLE public.dcp_maps ADD CONSTRAINT dcp_maps_pkey PRIMARY KEY (id);
ALTER TABLE public.dcp_questions ADD CONSTRAINT dcp_questions_pkey PRIMARY KEY (id);
ALTER TABLE public.demo_requests ADD CONSTRAINT demo_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.endemic_problems ADD CONSTRAINT endemic_problems_pkey PRIMARY KEY (id);
ALTER TABLE public.icp_baseline_profile ADD CONSTRAINT icp_baseline_profile_pkey PRIMARY KEY (id);
ALTER TABLE public.icp_definition ADD CONSTRAINT icp_definition_buyer_type_check CHECK ((buyer_type = ANY (ARRAY['economic_buyer'::text, 'champion'::text])));
ALTER TABLE public.icp_definition ADD CONSTRAINT icp_definition_segment_index_check CHECK (((segment_index >= 1) AND (segment_index <= 3)));
ALTER TABLE public.icp_definition ADD CONSTRAINT icp_definition_pkey PRIMARY KEY (id);
ALTER TABLE public.icp_definition ADD CONSTRAINT icp_definition_org_segment_buyer_uniq UNIQUE (org_id, segment_index, buyer_type);
ALTER TABLE public.offer_definition ADD CONSTRAINT offer_definition_pkey PRIMARY KEY (id);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
ALTER TABLE public.personas ADD CONSTRAINT personas_pkey PRIMARY KEY (id);
ALTER TABLE public.questions ADD CONSTRAINT questions_pkey PRIMARY KEY (id);
ALTER TABLE public.response_answers ADD CONSTRAINT response_answers_pkey PRIMARY KEY (id);
ALTER TABLE public.stage_company_foundation ADD CONSTRAINT stage_company_foundation_pkey PRIMARY KEY (id);
ALTER TABLE public.step_definition ADD CONSTRAINT step_definition_pkey PRIMARY KEY (id);
ALTER TABLE public.step_dependency ADD CONSTRAINT step_dependency_pkey PRIMARY KEY (step_id, prerequisite_step_id);
ALTER TABLE public.step_output ADD CONSTRAINT step_output_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text])));
ALTER TABLE public.step_output ADD CONSTRAINT step_output_pkey PRIMARY KEY (id);
ALTER TABLE public.step_output ADD CONSTRAINT step_output_workspace_step_uniq UNIQUE (workspace_id, step_id);
ALTER TABLE public.strategic_messages ADD CONSTRAINT strategic_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.survey_link_responses ADD CONSTRAINT survey_link_responses_pkey PRIMARY KEY (id);
ALTER TABLE public.survey_links ADD CONSTRAINT survey_links_pkey PRIMARY KEY (id);
ALTER TABLE public.survey_links ADD CONSTRAINT survey_links_token_key UNIQUE (token);
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);
ALTER TABLE public.surveys ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);
ALTER TABLE public.surveys ADD CONSTRAINT surveys_share_token_key UNIQUE (share_token);
ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.whitepaper_leads ADD CONSTRAINT whitepaper_leads_pkey PRIMARY KEY (id);
ALTER TABLE public.workspace_survey ADD CONSTRAINT workspace_survey_pkey PRIMARY KEY (id);
ALTER TABLE public.workspace_survey ADD CONSTRAINT workspace_survey_org_id_key UNIQUE (org_id);

-- ── Foreign keys ──────────────────────────────────────────────────────────────
ALTER TABLE public.action_plans ADD CONSTRAINT action_plans_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES users(id);
ALTER TABLE public.action_plans ADD CONSTRAINT action_plans_c3_project_id_fkey FOREIGN KEY (c3_project_id) REFERENCES c3_projects(id) ON DELETE CASCADE;
ALTER TABLE public.action_plans ADD CONSTRAINT action_plans_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.assets ADD CONSTRAINT assets_published_by_fkey FOREIGN KEY (published_by) REFERENCES users(id);
ALTER TABLE public.assets ADD CONSTRAINT assets_c3_project_id_fkey FOREIGN KEY (c3_project_id) REFERENCES c3_projects(id);
ALTER TABLE public.assets ADD CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.assets ADD CONSTRAINT assets_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.beta_agreements ADD CONSTRAINT beta_agreements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.c3_projects ADD CONSTRAINT c3_projects_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.c3_projects ADD CONSTRAINT c3_projects_gate2_approved_by_fkey FOREIGN KEY (gate2_approved_by) REFERENCES users(id);
ALTER TABLE public.c3_projects ADD CONSTRAINT c3_projects_dcp_map_id_fkey FOREIGN KEY (dcp_map_id) REFERENCES dcp_maps(id);
ALTER TABLE public.c3_projects ADD CONSTRAINT c3_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.c3_projects ADD CONSTRAINT c3_projects_gate2_submitted_by_fkey FOREIGN KEY (gate2_submitted_by) REFERENCES users(id);
ALTER TABLE public.company_formulas ADD CONSTRAINT company_formulas_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES users(id);
ALTER TABLE public.company_formulas ADD CONSTRAINT company_formulas_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.company_formulas ADD CONSTRAINT company_formulas_c3_project_id_fkey FOREIGN KEY (c3_project_id) REFERENCES c3_projects(id) ON DELETE CASCADE;
ALTER TABLE public.company_profiles ADD CONSTRAINT company_profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.company_profiles ADD CONSTRAINT company_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.competitive_environments ADD CONSTRAINT competitive_environments_c3_project_id_fkey FOREIGN KEY (c3_project_id) REFERENCES c3_projects(id) ON DELETE CASCADE;
ALTER TABLE public.competitive_environments ADD CONSTRAINT competitive_environments_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES users(id);
ALTER TABLE public.competitive_environments ADD CONSTRAINT competitive_environments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_exports ADD CONSTRAINT crm_exports_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.crm_exports ADD CONSTRAINT crm_exports_exported_by_fkey FOREIGN KEY (exported_by) REFERENCES users(id);
ALTER TABLE public.crm_exports ADD CONSTRAINT crm_exports_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id);
ALTER TABLE public.dcp_maps ADD CONSTRAINT dcp_maps_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.dcp_maps ADD CONSTRAINT dcp_maps_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id);
ALTER TABLE public.dcp_maps ADD CONSTRAINT dcp_maps_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id);
ALTER TABLE public.demo_requests ADD CONSTRAINT demo_requests_provisioned_org_id_fkey FOREIGN KEY (provisioned_org_id) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE public.endemic_problems ADD CONSTRAINT endemic_problems_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.endemic_problems ADD CONSTRAINT endemic_problems_c3_project_id_fkey FOREIGN KEY (c3_project_id) REFERENCES c3_projects(id) ON DELETE CASCADE;
ALTER TABLE public.endemic_problems ADD CONSTRAINT endemic_problems_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.icp_baseline_profile ADD CONSTRAINT icp_baseline_profile_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.icp_definition ADD CONSTRAINT icp_definition_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.offer_definition ADD CONSTRAINT offer_definition_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.offer_definition ADD CONSTRAINT offer_definition_icp_id_fkey FOREIGN KEY (icp_id) REFERENCES icp_definition(id) ON DELETE CASCADE;
ALTER TABLE public.personas ADD CONSTRAINT personas_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.personas ADD CONSTRAINT personas_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.personas ADD CONSTRAINT personas_company_profile_id_fkey FOREIGN KEY (company_profile_id) REFERENCES company_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.questions ADD CONSTRAINT questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
ALTER TABLE public.questions ADD CONSTRAINT questions_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.questions ADD CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.response_answers ADD CONSTRAINT response_answers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.response_answers ADD CONSTRAINT response_answers_survey_response_id_fkey FOREIGN KEY (survey_response_id) REFERENCES survey_responses(id) ON DELETE CASCADE;
ALTER TABLE public.response_answers ADD CONSTRAINT response_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
ALTER TABLE public.stage_company_foundation ADD CONSTRAINT stage_company_foundation_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.stage_company_foundation ADD CONSTRAINT stage_company_foundation_c3_project_id_fkey FOREIGN KEY (c3_project_id) REFERENCES c3_projects(id) ON DELETE CASCADE;
ALTER TABLE public.stage_company_foundation ADD CONSTRAINT stage_company_foundation_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES users(id);
ALTER TABLE public.strategic_messages ADD CONSTRAINT strategic_messages_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES personas(id);
ALTER TABLE public.strategic_messages ADD CONSTRAINT strategic_messages_c3_project_id_fkey FOREIGN KEY (c3_project_id) REFERENCES c3_projects(id) ON DELETE CASCADE;
ALTER TABLE public.strategic_messages ADD CONSTRAINT strategic_messages_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES users(id);
ALTER TABLE public.strategic_messages ADD CONSTRAINT strategic_messages_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.survey_link_responses ADD CONSTRAINT survey_link_responses_survey_link_id_fkey FOREIGN KEY (survey_link_id) REFERENCES survey_links(id);
ALTER TABLE public.survey_links ADD CONSTRAINT survey_links_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
ALTER TABLE public.surveys ADD CONSTRAINT surveys_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.surveys ADD CONSTRAINT surveys_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.workspace_survey ADD CONSTRAINT workspace_survey_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_strategic_messages_c3_project ON public.strategic_messages USING btree (c3_project_id);
CREATE INDEX idx_dcp_maps_org_id ON public.dcp_maps USING btree (org_id);
CREATE INDEX idx_surveys_share_token ON public.surveys USING btree (share_token);
CREATE INDEX icp_baseline_profile_org_idx ON public.icp_baseline_profile USING btree (org_id, category);
CREATE INDEX idx_contacts_org_id ON public.contacts USING btree (org_id);
CREATE INDEX idx_endemic_problems_c3_project ON public.endemic_problems USING btree (c3_project_id);
CREATE INDEX idx_surveys_org_id ON public.surveys USING btree (org_id);
CREATE INDEX idx_response_answers_response_id ON public.response_answers USING btree (survey_response_id);
CREATE INDEX idx_survey_responses_contact_id ON public.survey_responses USING btree (contact_id);
CREATE INDEX demo_requests_submitted_at_idx ON public.demo_requests USING btree (submitted_at DESC);
CREATE INDEX idx_contacts_email ON public.contacts USING btree (org_id, email);
CREATE INDEX idx_assets_status ON public.assets USING btree (org_id, status);
CREATE INDEX idx_assets_org_id ON public.assets USING btree (org_id);
CREATE INDEX idx_usage_events_org_id ON public.usage_events USING btree (org_id);
CREATE INDEX idx_c3_projects_org_id ON public.c3_projects USING btree (org_id);
CREATE INDEX whitepaper_leads_email_idx ON public.whitepaper_leads USING btree (email);
CREATE INDEX idx_personas_org_id ON public.personas USING btree (org_id);
CREATE INDEX idx_usage_events_asset_id ON public.usage_events USING btree (asset_id);
CREATE UNIQUE INDEX icp_definition_one_primary_per_org ON public.icp_definition USING btree (org_id) WHERE is_primary;
CREATE INDEX whitepaper_leads_downloaded_at_idx ON public.whitepaper_leads USING btree (downloaded_at DESC);
CREATE INDEX idx_usage_events_occurred_at ON public.usage_events USING btree (org_id, occurred_at DESC);
CREATE INDEX idx_crm_exports_org_id ON public.crm_exports USING btree (org_id);
CREATE INDEX idx_survey_responses_survey_id ON public.survey_responses USING btree (survey_id);
CREATE INDEX idx_questions_survey_id ON public.questions USING btree (survey_id);
CREATE INDEX step_output_workspace_step_version_idx ON public.step_output USING btree (workspace_id, step_id, version DESC);
CREATE INDEX idx_users_org_id ON public.users USING btree (org_id);
CREATE INDEX demo_requests_email_idx ON public.demo_requests USING btree (email);
CREATE INDEX idx_assets_type ON public.assets USING btree (org_id, asset_type);

-- ── Row Level Security: enable ────────────────────────────────────────────────
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.c3_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitive_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcp_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcp_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcp_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dcp_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endemic_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_baseline_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_company_foundation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_dependency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_output ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_link_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitepaper_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_survey ENABLE ROW LEVEL SECURITY;

-- ── Policies ──────────────────────────────────────────────────────────────────
CREATE POLICY ap_select ON public.action_plans FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY ap_write ON public.action_plans FOR ALL TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY assets_select ON public.assets FOR SELECT TO public USING ((((org_id = auth_org_id()) AND (status = 'approved'::asset_status)) OR ((org_id = auth_org_id()) AND is_leadership()) OR is_super_admin()));
CREATE POLICY assets_write ON public.assets FOR ALL TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY beta_agreements_insert_own_user ON public.beta_agreements FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY beta_agreements_select_own_user ON public.beta_agreements FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY beta_feedback_insert_own_org ON public.beta_feedback FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY beta_feedback_select_own_rows ON public.beta_feedback FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY c3_insert ON public.c3_projects FOR INSERT TO public WITH CHECK (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY c3_select ON public.c3_projects FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY c3_update ON public.c3_projects FOR UPDATE TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY cf_select ON public.company_formulas FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY cf_write ON public.company_formulas FOR ALL TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY cp_insert ON public.company_profiles FOR INSERT TO public WITH CHECK (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY cp_select ON public.company_profiles FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY cp_update ON public.company_profiles FOR UPDATE TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY ce_select ON public.competitive_environments FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY ce_write ON public.competitive_environments FOR ALL TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY contacts_insert ON public.contacts FOR INSERT TO public WITH CHECK ((org_id = auth_org_id()));
CREATE POLICY contacts_select ON public.contacts FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY contacts_update ON public.contacts FOR UPDATE TO public USING ((org_id = auth_org_id()));
CREATE POLICY copilot_run_insert_own_org ON public.copilot_run FOR INSERT TO public WITH CHECK ((workspace_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY copilot_run_select_own_org ON public.copilot_run FOR SELECT TO public USING ((workspace_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY crm_select ON public.crm_exports FOR SELECT TO public USING ((((org_id = auth_org_id()) AND is_leadership()) OR is_super_admin()));
CREATE POLICY crm_write ON public.crm_exports FOR ALL TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY dcp_analysis_delete_own_org ON public.dcp_analysis FOR DELETE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_analysis_insert_own_org ON public.dcp_analysis FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_analysis_select_own_org ON public.dcp_analysis FOR SELECT TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_analysis_update_own_org ON public.dcp_analysis FOR UPDATE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_imports_delete_own_org ON public.dcp_imports FOR DELETE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_imports_insert_own_org ON public.dcp_imports FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_imports_select_own_org ON public.dcp_imports FOR SELECT TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_imports_update_own_org ON public.dcp_imports FOR UPDATE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_insert ON public.dcp_maps FOR INSERT TO public WITH CHECK (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY dcp_maps_insert_own_org ON public.dcp_maps FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_maps_select_own_org ON public.dcp_maps FOR SELECT TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_maps_update_own_org ON public.dcp_maps FOR UPDATE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY dcp_select ON public.dcp_maps FOR SELECT TO public USING ((((org_id = auth_org_id()) AND is_leadership()) OR is_super_admin()));
CREATE POLICY dcp_update ON public.dcp_maps FOR UPDATE TO public USING (((org_id = auth_org_id()) AND is_org_admin_or_above()));
CREATE POLICY dcp_questions_select_authenticated ON public.dcp_questions FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY ep_select ON public.endemic_problems FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY ep_write ON public.endemic_problems FOR ALL TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY icp_baseline_profile_delete ON public.icp_baseline_profile FOR DELETE TO public USING ((org_id = ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY icp_baseline_profile_insert ON public.icp_baseline_profile FOR INSERT TO public WITH CHECK ((org_id = ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY icp_baseline_profile_select ON public.icp_baseline_profile FOR SELECT TO public USING ((org_id = ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY icp_baseline_profile_update ON public.icp_baseline_profile FOR UPDATE TO public USING ((org_id = ( SELECT users.org_id FROM users WHERE (users.id = auth.uid())))) WITH CHECK ((org_id = ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY icp_definition_delete_own_org ON public.icp_definition FOR DELETE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY icp_definition_insert_own_org ON public.icp_definition FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY icp_definition_select_own_org ON public.icp_definition FOR SELECT TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY icp_definition_update_own_org ON public.icp_definition FOR UPDATE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY offer_definition_delete_own_org ON public.offer_definition FOR DELETE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY offer_definition_insert_own_org ON public.offer_definition FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY offer_definition_select_own_org ON public.offer_definition FOR SELECT TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY offer_definition_update_own_org ON public.offer_definition FOR UPDATE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY org_admin_select_own_org ON public.organizations FOR SELECT TO public USING ((id IN ( SELECT users.org_id FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'org_admin'::user_role)))));
CREATE POLICY org_admin_update_own_org ON public.organizations FOR UPDATE TO public USING ((id IN ( SELECT users.org_id FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'org_admin'::user_role))))) WITH CHECK ((id IN ( SELECT users.org_id FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'org_admin'::user_role)))));
CREATE POLICY organizations_select_own_org ON public.organizations FOR SELECT TO public USING ((id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY organizations_update_own_org ON public.organizations FOR UPDATE TO public USING ((id IN ( SELECT users.org_id FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'org_admin'::user_role))))) WITH CHECK ((id IN ( SELECT users.org_id FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'org_admin'::user_role)))));
CREATE POLICY orgs_insert ON public.organizations FOR INSERT TO public WITH CHECK (is_super_admin());
CREATE POLICY orgs_select ON public.organizations FOR SELECT TO public USING ((is_super_admin() OR (id = auth_org_id())));
CREATE POLICY orgs_update ON public.organizations FOR UPDATE TO public USING ((is_super_admin() OR (id = auth_org_id()))) WITH CHECK ((is_super_admin() OR (id = auth_org_id())));
CREATE POLICY personas_insert ON public.personas FOR INSERT TO public WITH CHECK (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY personas_select ON public.personas FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY personas_update ON public.personas FOR UPDATE TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY questions_insert ON public.questions FOR INSERT TO public WITH CHECK (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY questions_select ON public.questions FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY questions_update ON public.questions FOR UPDATE TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY answers_insert ON public.response_answers FOR INSERT TO public WITH CHECK (true);
CREATE POLICY answers_select ON public.response_answers FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY answers_update ON public.response_answers FOR UPDATE TO public USING ((org_id = auth_org_id()));
CREATE POLICY s1_select ON public.stage_company_foundation FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY s1_write ON public.stage_company_foundation FOR ALL TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY step_definition_select_authenticated ON public.step_definition FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY step_dependency_select_own_org ON public.step_dependency FOR SELECT TO public USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Users can insert own step outputs" ON public.step_output FOR INSERT TO public WITH CHECK ((workspace_id = ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY "Users can read own step outputs" ON public.step_output FOR SELECT TO public USING ((workspace_id = ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY "Users can update own step outputs" ON public.step_output FOR UPDATE TO public USING ((workspace_id = ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY step_output_delete_own_org ON public.step_output FOR DELETE TO public USING ((workspace_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY step_output_insert_own_org ON public.step_output FOR INSERT TO public WITH CHECK ((workspace_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY step_output_select_own_org ON public.step_output FOR SELECT TO public USING ((workspace_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY step_output_update_own_org ON public.step_output FOR UPDATE TO public USING ((workspace_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid())))) WITH CHECK ((workspace_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY sm_insert ON public.strategic_messages FOR INSERT TO public WITH CHECK (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY sm_select ON public.strategic_messages FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY sm_update ON public.strategic_messages FOR UPDATE TO public USING (((org_id = auth_org_id()) AND (is_org_admin_or_above() OR (auth_user_role() = 'sales_leadership'::user_role) OR (auth_user_role() = ANY (ARRAY['ceo'::user_role, 'coo'::user_role])))));
CREATE POLICY survey_link_responses_insert_anon ON public.survey_link_responses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY survey_link_responses_select_own_org ON public.survey_link_responses FOR SELECT TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY survey_links_insert_own_org ON public.survey_links FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY survey_links_select_own_org ON public.survey_links FOR SELECT TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY survey_links_update_own_org ON public.survey_links FOR UPDATE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY responses_insert ON public.survey_responses FOR INSERT TO public WITH CHECK (true);
CREATE POLICY responses_select ON public.survey_responses FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY responses_update ON public.survey_responses FOR UPDATE TO public USING ((org_id = auth_org_id()));
CREATE POLICY survey_responses_insert_own_org ON public.survey_responses FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY survey_responses_select_own_org ON public.survey_responses FOR SELECT TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY surveys_insert ON public.surveys FOR INSERT TO public WITH CHECK (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY surveys_public_select ON public.surveys FOR SELECT TO public USING (((status = 'active'::survey_status) AND (share_token IS NOT NULL)));
CREATE POLICY surveys_select ON public.surveys FOR SELECT TO public USING (((org_id = auth_org_id()) OR is_super_admin()));
CREATE POLICY surveys_update ON public.surveys FOR UPDATE TO public USING (((org_id = auth_org_id()) AND is_leadership()));
CREATE POLICY usage_insert ON public.usage_events FOR INSERT TO public WITH CHECK ((org_id = auth_org_id()));
CREATE POLICY usage_select ON public.usage_events FOR SELECT TO public USING ((((org_id = auth_org_id()) AND is_leadership()) OR is_super_admin()));
CREATE POLICY "Users can read own record" ON public.users FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY users_delete ON public.users FOR DELETE TO public USING ((is_super_admin() OR ((org_id = auth_org_id()) AND is_org_admin_or_above())));
CREATE POLICY users_insert ON public.users FOR INSERT TO public WITH CHECK ((is_super_admin() OR ((org_id = auth_org_id()) AND is_org_admin_or_above())));
CREATE POLICY users_select ON public.users FOR SELECT TO public USING ((is_super_admin() OR (org_id = auth_org_id())));
CREATE POLICY users_select_own_org ON public.users FOR SELECT TO public USING ((id = auth.uid()));
CREATE POLICY users_update ON public.users FOR UPDATE TO public USING ((is_super_admin() OR ((org_id = auth_org_id()) AND is_org_admin_or_above()) OR (id = auth.uid()))) WITH CHECK ((is_super_admin() OR ((org_id = auth_org_id()) AND is_org_admin_or_above()) OR ((id = auth.uid()) AND (org_id = ( SELECT u.org_id FROM users u WHERE (u.id = auth.uid()))) AND (role = ( SELECT u.role FROM users u WHERE (u.id = auth.uid()))))));
CREATE POLICY workspace_survey_insert_own_org ON public.workspace_survey FOR INSERT TO public WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY workspace_survey_select_own_org ON public.workspace_survey FOR SELECT TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));
CREATE POLICY workspace_survey_update_own_org ON public.workspace_survey FOR UPDATE TO public USING ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid())))) WITH CHECK ((org_id IN ( SELECT users.org_id FROM users WHERE (users.id = auth.uid()))));

-- ── Triggers ──────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_dcp_maps_updated_at BEFORE UPDATE ON public.dcp_maps FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_company_profiles_updated_at BEFORE UPDATE ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_personas_updated_at BEFORE UPDATE ON public.personas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_surveys_updated_at BEFORE UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_c3_projects_updated_at BEFORE UPDATE ON public.c3_projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_stage1_updated_at BEFORE UPDATE ON public.stage_company_foundation FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_endemic_problems_updated_at BEFORE UPDATE ON public.endemic_problems FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_company_formulas_updated_at BEFORE UPDATE ON public.company_formulas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_competitive_environments_updated_at BEFORE UPDATE ON public.competitive_environments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_strategic_messages_updated_at BEFORE UPDATE ON public.strategic_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_action_plans_updated_at BEFORE UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Grants (RLS is the actual gate; broad grants match Supabase defaults) ──────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
