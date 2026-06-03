@AGENTS.md
# CLAUDE.md — Assembly AI

Read this file before every task. This is the single source of truth.
Full specs and architecture are in CONTEXT.md.

## Project
Multi-tenant C3 Method Operating System for Assembly Networks.
Repo: Mschaef2667/Assembly-AI
Stack: Next.js 14 App Router, TypeScript strict, Supabase, Tailwind, shadcn/ui, Claude API

## C3 Method Sequence
The correct order of work in the platform is:
1. **Phase 1 — Company Profile (Steps 1–3.5)**: Product/service profile, target market segments, buying center evaluation. Completed during Onboarding.
2. **Intelligence (DCP Survey → Response Manager → DCP Map → Gate 1)**: Build the buyer research survey, collect responses, generate the Decision Clarity Profile, submit for Gate 1 approval.
3. **ICP Development (unlocks after Gate 1 approval)**: Build validated Ideal Customer Profiles per segment, grounded in buyer research rather than assumptions. Define aligned offers per ICP.
4. **Phase 2 — Journeys (Steps 4–38)**: Endemic Problems → CVPs → Key Selling Points → Competitive Analysis → Strategic Messages → Strategic Plan → Deal Scorecard.

Rationale: ICP profiles must be grounded in real buyer decision-making patterns (Intelligence output), not initial assumptions. Sidebar ordering and route gating enforce this sequence — `/dashboard/target-markets` is locked until `dcp_analysis.status = 'approved'`.

## C3 Method Step Formulas
The correct formula and dependencies for each Phase 2 step. Copilot prompts and dependency warnings must follow these formulas exactly.

- **Step 4 — The Problem**: Endemic problem statement from buyer perspective. Pulls from DCP Stages 1+2. Auto-populated by Copilot.
- **Step 5 — The Cause**: What structurally creates the problem. Pulls from DCP Stage 1. Requires Step 4.
- **Step 6 — The Effect**: Business consequence if problem goes unsolved. Pulls from DCP Stage 2. Requires Step 4.
- **Step 7 — The Realization**: The moment buyers recognize they have the problem. Pulls from DCP Stage 2. Requires Step 4.
- **Step 8 — The Solution Criteria**: What the ideal solution must do. Pulls from DCP Stage 4. Requires Steps 4 and 6.
- **Step 9 — The Search**: How buyers find and evaluate solutions. Pulls from DCP Stage 3. Requires Step 4.
- **Step 10 — The Formula**: If you do [Solution - Step 8] it will solve [Problem - Step 4] thereby reducing [Effect - Step 6]. Requires Steps 4, 6, 8.
- **Step 11 — Compelling Value Propositions**: One CVP per pain point connecting problem to solution to outcome. Requires Steps 4, 5, 6, 10.
- **Step 14 — Core Competencies**: The internal capabilities that make the solution possible. Requires Steps 4, 11.
- **Step 17 — Target Competition**: Competitors organized by relevance to ICP and pain points. Requires Steps 4, 11.
- **Step 18 — Competitive Differentiators**: What makes the company uniquely better. Requires Step 17.
- **Step 19 — Competitive Advantages**: Specific advantages per competitor. Requires Steps 17, 18.
- **Step 27 — The Set-Up**: Does your company experience [Effect - Step 6] because of [Cause - Step 5]? Requires Steps 4, 5, 6.
- **Step 28 — The Jab**: Our solution will [CVP - Step 11] because of our commitment to [Core Competency - Step 14]. Requires Steps 11, 14.
- **Step 29 — Knock-Out**: We are unique because of [Competitive Differentiator - Step 18]. Requires Step 18.
- **Step 30 — Clean-Up**: [Competitive Advantage - Step 19] will solve [Effect - Step 6] because... Requires Steps 6, 19.

## Brand Tokens (use exactly)
- Assembly Navy: #0A1628 (sidebar, headers, card headers, dark panels)
- Signal Orange: #E8520A (CTAs, active states, approve buttons, progress fills)
- Assembly Blue: #0EA5E9 (highlights, active nav, links, hover states — hover darkens to #0284C7)
- Paper White: #F8F6F1 (content backgrounds, cards)
- Logic Grey: #6B7280 (secondary text, inactive, locked states)
- Rich Black: #0D0D0D (body copy)

## File Structure Rules
- Pages: app/[route]/page.tsx
- Components: components/[category]/[Name].tsx
- Never edit .next/ (build cache, auto-generated)
- Never commit .next/ to git

## Code Rules
- TypeScript strict mode, zero any types
- Every Supabase write wrapped in try/catch
- Every Claude API call writes to copilot_run table (success or failure)
- Never hardcode API keys, use environment variables
- Auto-save must never block UI thread (debounced async)
- All interactive elements: minimum 44x44px hit areas
- Copilot never overwrites user content silently, always propose + diff
- Gate actions always write to audit_log
- All inline edit textareas and input fields must pre-populate with existing content when opened for editing. Never open an edit field blank when existing content is available.
- All textarea and input elements must explicitly set color: '#0D0D0D' and backgroundColor: '#FFFFFF' (or equivalent Tailwind classes) to prevent inherited white-on-white or unreadable text color issues. Use controlled components (value + onChange) not defaultValue for any editable field that displays existing content.

## Sprint 1 — COMPLETE
- [x] Persistent left-nav sidebar (components/layout/sidebar.tsx)
- [x] Dashboard shell with 5 widgets (app/dashboard/page.tsx)
- [x] Company profile wizard Steps 1–3.5 (app/dashboard/company-profile/page.tsx)
- [x] Wire form to Supabase (step_output table, auto-save, save state indicator)
- [x] PostHog telemetry (onboarding.step_completed, onboarding.completed, journey.ttfaj_started)
- [x] Auth pages: login, signup, reset-password (app/auth/)
- [x] Supabase middleware auth guard → /auth/login
- [x] Administration page: users, company settings, company profile link (app/dashboard/administration/)

## Sprint 2 — COMPLETE
- [x] Build resolveContextPacket() in lib/context/resolveContextPacket.ts
- [x] Intelligence section: survey builder, response import, Decision Clarity Profile + Gate 1 (app/dashboard/intelligence/)
- [x] AI model selector in Administration page (org_admin only, stored in organizations.preferred_model)
- [x] Stage label export: survey CSV prefixes questions with [Stage X - Stage Name] for auto-mapping
- [x] Stage auto-mapping on import: extractStageMappings() detects prefix in response column headers
- [x] Cumulative response imports: dcp_imports.batches jsonb array, append-on-save, import history UI
- [x] Decision Clarity Profile re-analysis versioning: dcp_analysis.analysis_version increments on each re-run
- [x] Step 4 Copilot prompt rewrite: drafts directly from Decision Clarity Stage 1 + company profile, no qualifying questions
- [x] Wire copilot_run Supabase writes after every Claude API call
- [x] Build Step 4 Copilot integration in app/dashboard/journeys/step/[stepId]/page.tsx
- [x] Journeys index page (app/dashboard/journeys/page.tsx) — lists all 38 steps by section
- [x] Step page navigation: previous / next step links on step/[stepId] page
- [x] Build Copilot output display component in components/copilot/CopilotOutput.tsx
- [x] Implement confidence decay calculation at read time in lib/context/confidenceDecay.ts

## Sprint 3 — COMPLETE
- [x] Target Markets & Offers section (app/dashboard/target-markets/)
- [x] ICP definition per target market segment
- [x] Offer alignment per ICP
- [x] Wire ICP + offer context into PainPointStepEditor Copilot prompts
- [x] Message blending step (end of Journeys)
- [x] DCP Infographic generator (Phase 3)
- [x] Steps 19–26 wired into PainPointStepEditor
- [x] Step 21 Acid Test 2 placeholder built
- [x] BlendEditor component for Steps 27–30 (components/journeys/BlendEditor.tsx)
- [x] ActionPlanEditor component for Steps 31–37 (components/journeys/ActionPlanEditor.tsx)
- [x] DealScorecard component for Step 38 (components/journeys/DealScorecard.tsx)
- [x] Full 38-step journey complete

Sprint 3 COMPLETE as of 2026-05-18

## Sprint 4 — Acid Tests, CRM Upload & Prospecting (PLANNED)

### Acid Test System
Three structured checkpoint cards that appear at key moments in the journey:

Acid Test 1 — Offer Alignment (Step 16, Company Formulas)
- Checks: Does our current product/service deliver on our Critical Success Formulas?
- User scores alignment per CSF (1-5)
- Copilot surfaces gaps and recommends adjustments to offer definition
- Links back to Step 13 (Critical Success Formulas) and Target Markets & Offers if gaps found

Acid Test 2 — Competitive Gap (Step 21, Competitive Environments)
- Checks: Can each competitor in Step 17 deliver on our Critical Success Formulas?
- User scores each competitor against each CSF (Yes / Partial / No)
- Gaps = competitive opportunities, fed forward into Step 25 (Competitive Opportunities)
- Output: competitor gap matrix (competitor vs CSF grid)

Acid Test 3 — ICP Alignment (after Step 25, before Strategic Messages)
- Checks: Do our generated ICPs match our most valuable/profitable real customers?
- User uploads a CSV export from their CRM (HubSpot or other)
- CSV fields: company name, industry, company size, deal value, close rate, contact title
- Copilot analyzes uploaded customers against icp_definition records
- Scores alignment per ICP (High / Partial / Low)
- Surfaces patterns and suggests ICP refinements
- User chooses: Proceed or Go back and refine (with direct links)
- Result logged to a new acid_test_result table

### CRM Upload (Acid Test 3)
- File upload component accepting CSV
- Parser extracts: company name, industry, size, deal value, close rate, contact title
- Copilot compares each row against icp_definition firmographics and pain points
- Alignment score computed per ICP
- Default CRM assumption: HubSpot (per CLAUDE.md defaults)

### Prospecting Mod

## Sprint 5 — UX, Intelligence & Reporting — COMPLETE as of 2026-05-19
- [x] Empty state on Journeys index with "Start Here" guidance
- [x] Confidence decay indicators on Journeys index page
- [x] Competitive Discovery on Step 17 (web search powered)
- [x] C3 Method Output Report (PDF/Word export of all approved steps)
- [x] Dark Navy theme across all pages
- [x] Dashboard rebuilt with 4 new widgets (Journey Progress, What's Next, Gate Status, Performance Score)
- [x] Strategic Plan rename from Action Plan (migration + client-side normalisation)

## Sprint 6 — Activation, Gates & Polish (IN PROGRESS)
- [x] Beta test with Apex Solutions workspace
- [x] Dark theme applied to auth pages
- [x] Assembly AI logo committed to repo
- [x] assemblyai.net live on Vercel with custom domain
- [x] Supabase auth configured for live domain
- [x] Strategic Plan report fully populated (all sections)
- [x] Step 26 fix in report (by_pain_point content detection)
- [x] Org name showing in sidebar footer
- [ ] Activation Playbook (/dashboard/activation/playbook)
- [ ] Gate enforcement (configurable per org)
- [ ] Company logo upload at setup
- [ ] Copilot Assistant widget on Dashboard
- [ ] Acid Test system (Sprint 4 carry-forward)
- [ ] Navattic interactive demo build
- [ ] Assembly Networks client run-through
- [ ] Loom demo recording
- [ ] Beta client recruitment (3-4 clients)
- [ ] Vercel Pro upgrade for production
- [ ] PostHog analytics verification on live domain

## Product Improvements Backlog

### UX & Activation
- [ ] Empty state on Journeys index — "Start Here" guided onboarding for users with zero steps completed
- [ ] Progress accountability widget on Dashboard — "X% complete, last activity Y days ago" with continue nudge
- [ ] Confidence decay visible on Journeys index — flag low-confidence approved steps with amber/red indicator

### Methodology Integrity
- [ ] Gate enforcement — Gates 2, 3, 4 should optionally block progression until approved (configurable per org)
- [ ] Acid Test system — Sprint 4 (already documented)

### Output & Reporting
- [ ] C3 Method Output Report — exportable PDF/Word doc compiling all approved steps at journey completion
- [ ] Prompt library — versioned Copilot prompt templates stored in database, improvable without code deploys

### Collaboration
- [ ] Team collaboration — assign steps to roles, multi-user editing, role-based gate approvals (schema already supports this)

### Copilot Quality
- [ ] Prompt engineering pass — tune system prompts for CVPs, Key Selling Points, and Strategic Messages for higher output quality

### Competitive Intelligence
- [ ] Competitive Discovery on Step 17 (Target Competition) — Copilot "Discover Competitors" button that analyzes company profile, ICP firmographics, and pain points to surface: known competitors (validation), adjacent competitors (same problem, different approach), and emerging threats (newer players). Use Claude API web search tool to find competitors beyond training data. Results presented as cards user can accept or dismiss before saving to step output.

### Engagement & Gamification
- [ ] Performance Score tips — Copilot suggests specific actions to improve score based on low-scoring areas
- [ ] Performance Score benchmarking — "You rank in the top X% of Assembly AI clients" — requires anonymized aggregate scoring
- [ ] Performance Score leaderboard — opt-in ranking among clients, appeals to competitive nature
- [ ] Daily words of encouragement on Dashboard — personalized to user's current progress stage (just started / halfway / nearly complete)
- [ ] Copilot Assistant widget on Dashboard — text input where users can ask marketing questions or request term definitions. Two modes: (1) Term definitions — explains C3 Method concepts in context, e.g. "What is a core competency?"; (2) Contextual coaching — analyzes user's actual journey data and gives specific improvement advice, e.g. "How do I improve my CVP?" pulls their Step 11 content and critiques it.

### Workspace Personalization
- [ ] Client logo upload — stored in Supabase storage, displayed in sidebar alongside Assembly AI logo
- [ ] Workspace theme — allow orgs to pick an accent color to complement Assembly AI branding
- [ ] Company logo upload at setup — stored in Supabase Storage, displayed in top left of Dashboard page alongside Assembly AI logo, and included on the cover page of the C3 Method Output Report.

## Key Routes
- /dashboard → Workspace Dashboard (done)
- /dashboard/company-profile → Company Profile wizard (done)
- /dashboard/icp-offers → ICP & Offers
- /dashboard/intelligence → Intelligence hub (done)
- /dashboard/intelligence/survey → Survey Builder (done)
- /dashboard/intelligence/responses → Response Import (done)
- /dashboard/intelligence/dcp-map → Decision Clarity Profile + Gate 1 (done)
- /dashboard/playbooks → Playbooks
- /dashboard/journeys → Journeys
- /dashboard/assets → Assets Studio
- /dashboard/activation → Activation
- /dashboard/performance → Performance
- /dashboard/integrations → Integrations

## Onboarding Flow
Sign Up → Create Workspace → Company Profile (Steps 1-3) → Buying Center (Step 3.5) → Invite Team → Dashboard

## Company Profile Steps (Steps 1-3, no Copilot during onboarding)
Step 1: Product/Service Profile
- What do you sell? (free-form, 3-5 sentences)
- Primary use case or outcome delivered
- Key industries served

Step 2: Top 3 Target Market Segments
- Segment name + description (3 rows, min 1 required)

Step 3: Key Decision Makers Per Segment
- For each segment: buying roles (title, influence level, primary concern)
- Min 1 role per segment to continue

Step 3.5: Buying Center Evaluation
- Stakeholder count (slider, default 6-10)
- Decision style (consensus/champion-led/committee)
- Sales cycle length (default 3-9 months)
- ACV range (default $10k-$100k)

## Supabase Tables (must exist)
organizations, users, step_definition, step_dependency, step_output,
approval_gate, copilot_run, validation_check, upstream_change_flag,
audit_log, step_output_conflict, rate_limit_event, workspace_usage,
confidence_decay_log

## Verified Schema (queried 2026-05-14)

### organizations
| column     | type                          | nullable | default              |
|------------|-------------------------------|----------|----------------------|
| id         | uuid                          | NOT NULL | uuid_generate_v4()   |
| name       | text                          | NOT NULL | —                    |
| slug       | text                          | NOT NULL | —                    |
| industry   | text                          | nullable | —                    |
| website    | text                          | nullable | —                    |
| logo_url   | text                          | nullable | —                    |
| status     | org_status enum               | NOT NULL | 'trial'              |
| created_at | timestamptz                   | NOT NULL | now()                |
| updated_at | timestamptz                   | NOT NULL | now()                |

| preferred_model | text                          | NOT NULL | 'claude-sonnet-4-5'   |

org_status enum: trial | active | suspended | churned
preferred_model: stores workspace's preferred Claude model string (set in Administration page, org_admin only)

### users
| column     | type            | nullable | default      |
|------------|-----------------|----------|--------------|
| id         | uuid            | NOT NULL | — (= auth.users.id) |
| org_id     | uuid            | NOT NULL | — (FK → organizations.id) |
| role       | user_role enum  | NOT NULL | 'sales_rep'  |
| first_name | text            | nullable | —            |
| last_name  | text            | nullable | —            |
| email      | text            | NOT NULL | —            |
| avatar_url | text            | nullable | —            |
| is_active  | boolean         | NOT NULL | true         |
| created_at | timestamptz     | NOT NULL | now()        |
| updated_at | timestamptz     | NOT NULL | now()        |

user_role enum: super_admin | org_admin | ceo | coo | marketing_leadership |
               sales_leadership | cs_leadership | product_leadership | sales_rep | surveyor

### step_output
| column              | type        | nullable | default               |
|---------------------|-------------|----------|-----------------------|
| id                  | uuid        | NOT NULL | gen_random_uuid()     |
| workspace_id        | uuid        | NOT NULL | — (FK → organizations.id, despite name) |
| step_id             | text        | NOT NULL | —                     |
| version             | integer     | NOT NULL | 1                     |
| status              | text        | NOT NULL | 'draft'               |
| content             | jsonb       | NOT NULL | '{}'                  |
| copilot_assisted    | boolean     | NOT NULL | false                 |
| last_saved_at       | timestamptz | nullable | —                     |
| last_updated_at     | timestamptz | nullable | —                     |
| last_updated_by     | uuid        | nullable | —                     |
| original_confidence | integer     | nullable | —                     |
| last_reviewed_at    | timestamptz | nullable | —                     |
| created_at          | timestamptz | NOT NULL | now()                 |

status CHECK: 'draft' | 'pending_approval' | 'approved'
Note: workspace_id stores organizations.id (matches users.org_id).

### dcp_questions
| column        | type        | nullable | default              |
|---------------|-------------|----------|----------------------|
| id            | uuid        | NOT NULL | gen_random_uuid()    |
| stage_number  | int         | NOT NULL | —                    |
| stage_name    | text        | NOT NULL | —                    |
| question_text | text        | NOT NULL | —                    |
| sub_bullets   | jsonb       | NOT NULL | '[]'                 |
| is_starter    | boolean     | NOT NULL | false                |
| created_at    | timestamptz | nullable | now()                |
System-wide (no org column). RLS: authenticated user exists in users.

### workspace_survey
| column                | type        | nullable | default           |
|-----------------------|-------------|----------|-------------------|
| id                    | uuid        | NOT NULL | gen_random_uuid() |
| org_id                | uuid        | NOT NULL | FK → organizations|
| selected_question_ids | jsonb       | NOT NULL | '[]'              |
| customized_questions  | jsonb       | NOT NULL | '[]'              |
| created_at            | timestamptz | nullable | now()             |
| updated_at            | timestamptz | nullable | now()             |
Unique constraint on org_id (one per org).

### dcp_imports
| column           | type        | nullable | default           |
|------------------|-------------|----------|-------------------|
| id               | uuid        | NOT NULL | gen_random_uuid() |
| org_id           | uuid        | NOT NULL | —                 |
| raw_csv          | text        | nullable | —                 |
| parsed_responses | jsonb       | nullable | —                 |
| response_count   | int         | nullable | —                 |
| imported_at      | timestamptz | NOT NULL | now()             |
NOTE: survey_responses already exists in this project with a different schema. Use dcp_imports for all DCP CSV import storage.

### dcp_analysis
| column            | type        | nullable | default           |
|-------------------|-------------|----------|-------------------|
| id                | uuid        | NOT NULL | gen_random_uuid() |
| org_id            | uuid        | NOT NULL | —                 |
| stage_summaries   | jsonb       | nullable | —                 |
| overall_confidence| int         | nullable | —                 |
| status            | text        | NOT NULL | 'draft'           |
| submitted_at      | timestamptz | nullable | —                 |
| approved_at       | timestamptz | nullable | —                 |
| approved_by       | uuid        | nullable | —                 |
| created_at        | timestamptz | NOT NULL | now()             |
| updated_at        | timestamptz | NOT NULL | now()             |
Unique constraint on org_id (one per org). status: draft | pending_approval | approved.
stage_summaries jsonb array: [{ stage_number, stage_name, summary, confidence_score }]
NOTE: dcp_maps already exists in this project with a different schema. Use dcp_analysis for all DCP Copilot output storage.

### step_dependency
| column               | type | nullable |
|----------------------|------|----------|
| step_id              | text | NOT NULL |
| prerequisite_step_id | text | NOT NULL |
PK: (step_id, prerequisite_step_id)

## RLS Policy Pattern
All Assembly AI RLS policies follow one join chain:
`auth.uid()` → `users.id` → `users.org_id` → target table's org column.

For `step_output` the org column is `workspace_id`.
For `users` the org column is `org_id`.
For `organizations` the org column is `id`.

Copy-paste SQL template (replace `<table>` and `<org_col>`):

```sql
alter table <table> enable row level security;

-- SELECT
drop policy if exists "<table>_select_own_org" on <table>;
create policy "<table>_select_own_org"
  on <table> for select
  using (
    <org_col> in (select org_id from users where id = auth.uid())
  );

-- INSERT
drop policy if exists "<table>_insert_own_org" on <table>;
create policy "<table>_insert_own_org"
  on <table> for insert
  with check (
    <org_col> in (select org_id from users where id = auth.uid())
  );

-- UPDATE
drop policy if exists "<table>_update_own_org" on <table>;
create policy "<table>_update_own_org"
  on <table> for update
  using  (<org_col> in (select org_id from users where id = auth.uid()))
  with check (<org_col> in (select org_id from users where id = auth.uid()));
```

## PostHog Events to Fire
- workspace.created
- onboarding.step_completed (Steps 1, 2, 3, 3.5)
- onboarding.completed
- journey.ttfaj_started (first dashboard load post-onboarding)

## Default Assumptions
- CRM: HubSpot
- Stakeholders: 6-10, consensus decisioning
- ACV: $10k-$100k
- Sales cycle: 3-9 months
- Plan: Starter (50 runs/day, 500k tokens/month)

## Claude API
Model: claude-sonnet-4-5
Max tokens: 1500
Never hardcode API key
Always write to copilot_run after every call

## Parking Lot / Future Features
- Activation Module (removed from nav May 2026): Originally a placeholder for a future module that bridges C3 Method completion and market deployment. Concept: take approved Strategic Plan outputs and convert them into executable GTM assets — email sequences, sales scripts, campaign briefs, social content. Overlaps with Assets Studio and Lead Generation. Should be revisited when both of those modules are built. Do not rebuild as a standalone nav item — fold into Assets Studio or Lead Generation workflow instead.
- Acid Test Copilot Mode (planned): The Acid Test steps (Step 21) should use a different Copilot interaction model than all other steps. Instead of generating a proposed draft, the Acid Test Copilot should act as a strategic challenger. UI changes: replace Confidence Score with a Challenge Score (how well does the strategy hold up under scrutiny). Replace Proposed Draft with 3-5 pointed clarifying questions the user must answer before the step can be approved. Add a Gaps Identified section showing where the strategy has weak spots based on upstream data. Only after the user answers the challenge questions does Copilot generate the final Acid Test output. This makes the Acid Test genuinely differentiated -- no other GTM tool stress-tests its own outputs. Build after Copilot revert button and assumptions cleanup are complete.
- Copilot Simulated Survey Responses (planned): On the Response Import page, add a Generate Simulated Responses with Copilot button. Copilot uses Phase 1 data (segments, decision makers, pain points) to generate realistic synthetic responses for each DCP survey question across all 7 stages. Simulated responses are clearly labeled. Users can mix simulated and real responses for DCP analysis. Useful for bootstrapping and gap analysis.
- DCP Map PDF Download (planned): Once the DCP map is generated and approved, add a Download as PDF button that exports the full Decision Clarity Profile analysis across all 7 stages as a formatted PDF document. Use the existing PDF skill pattern from the Strategic Plan export.
- Segment-Aware Journey Steps (planned): Currently Steps 4-38 are single-instance per workspace. Each target market segment should eventually have its own set of step outputs for Endemic Problems, CVPs, Competitive Analysis, Strategic Messages, and Strategic Plan. Architecture: add segment_id foreign key to step_output table. UI: segment selector on each Journey step page. Strategic Plan compiles all approved segments into one master document. This is a significant schema change -- design carefully before building. Until built, clients should complete one full segment before starting another.
- Built-in Survey Delivery System (planned - high priority, two phases):

  Phase 1 (build soon): Generate a unique shareable survey link per segment/audience combination using a token. Create a public-facing survey page at /survey/[token] that requires no login. Respondents fill in their profile (name, title, company, how long a customer, reason for leaving) then complete the survey questions. Responses auto-save to Supabase response table tagged with audience type, segment, and respondent profile. Add a Refresh DCP Map button that re-runs analysis when new responses arrive. Remove the need for CSV upload entirely for clients using the built-in survey.

  Phase 2 (future): Automatic DCP map refresh as responses arrive in real time. Follow-up question triggers based on specific answers. Email sending directly from Assembly AI using Resend or SendGrid. Response analytics dashboard showing completion rates per audience and segment. Branching survey logic based on previous answers.

  Why this matters: Removes the biggest friction point in the Intelligence workflow. Higher response rates (one click vs manual Google Forms process). Cleaner data with no CSV formatting issues. Real-time intelligence as DCP maps improve with each new response. Significant competitive differentiator -- no other GTM tool does end-to-end buyer research plus strategy generation in one platform.

  Architecture notes: Survey tokens stored in a survey_links table with columns: id, org_id, segment_slug, audience, token (uuid), created_at, expires_at (optional), is_active. Responses stored in survey_responses table with: id, survey_link_id, org_id, segment_slug, audience, respondent_name, respondent_title, respondent_company, answers (JSONB), created_at.
- Copilot Simulated Survey Responses (planned - Response Manager): On the Response Manager page, add a Generate Simulated Responses tab or button. Copilot uses Phase 1 data to generate realistic synthetic responses for each DCP survey question. User reviews the simulated response before accepting -- show it in the same detail panel as real responses with a Preview banner. User can Accept (saves to survey_link_responses with source=simulated) or Decline (discards). Simulated responses are clearly labeled with a Copilot Simulated badge in the Source column.
- Response Manager View Button Fix (pending): The Actions column View button is still getting cut off on smaller screens. Fix by: making the Name column clickable to open the detail panel (in addition to the View button), and reducing other column widths to give Actions more space. Consider hiding the Company column on smaller viewports.
- Response Manager Source Backfill Timing (pending): The Source column backfill is working but responses still show as dash on initial render because the backfill useEffect may not be firing before the first paint. Investigate and fix source backfill timing issue in the View tab — ensure source values are resolved before the table renders, or apply a fallback display that re-renders reactively once backfill completes.
- Survey Builder Regenerate (planned): Users should be able to click a Regenerate button to completely clear and regenerate all questions via Copilot for a segment/audience combination, even when locked questions are present. Currently locked questions cannot be cleared. Add a Regenerate All button with a confirmation warning that this will replace all current questions including locked ones.
- Future State Strategic Plan (planned - high priority): A second strategic deliverable that lives alongside the existing Strategic Plan at the end of Journeys. Available only after Gate 1 is approved (DCP Map complete). While Plan 1 (Current State Action Plan) is based on Phase 1 data and tells clients what to do now, Plan 2 (Future State Strategic Plan) is based on the Insights module output and tells clients what to build toward over 6-18 months.

  Plan 2 inputs: Insights module output (6 categories -- internal/external gaps, product gaps, key competitors, decision signals, brand perception, segment differences), DCP Map stage signals, Competitive Environment steps (17-26), Brand Perception gaps surfaced in research.

  Plan 2 sections: 1) Market Position Assessment -- where you are vs where the market is going, 2) Strategic Repositioning Plan -- how to close the brand perception gap, 3) Product/Service Evolution -- gaps to address based on buyer research, 4) Competitive Differentiation Strategy -- how to win against the competitive set buyers actually consider, 5) 6-18 Month GTM Roadmap -- sequenced initiatives with leading indicators, 6) Success Metrics -- how to measure progress toward the future state.

  Delivery: Separate PDF report, same branding as Plan 1. Button appears on Journeys page alongside Generate Report button, labeled Generate Future State Plan. Only active when Gate 1 is approved AND Insights have been generated.
- DCP Map to Endemic Problems Auto-Population (planned - core feature): The DCP Map should directly populate Steps 4-9 (Endemic Problems section). Mapping: Step 4 The Problem from DCP Stages 1+2, Step 5 The Cause from DCP Stage 1 root causes, Step 6 The Effect from DCP Stage 2 consequences, Step 7 The Realization from DCP Stage 2 trigger moments, Step 8 The Solution Criteria from DCP Stage 4 evaluation signals, Step 9 The Search from DCP Stage 3 information search patterns. If Copilot struggles to populate these from DCP data, the research is incomplete -- surface this as a data quality signal to the user.
- DCP Quality Feedback Loop (planned - high priority): Three-layer gap detection system that closes the loop between survey design, response quality, and step population.

  Layer 1 - Survey Design Gap Detection (Survey Builder): Before marking survey complete, check if the 15 questions cover all 7 DCP stages adequately for populating Steps 4-9. Specifically check: Stage 1 has questions about what creates the problem (needed for Step 5), Stage 2 has questions about consequences and trigger moments (needed for Steps 6 and 7), Stage 3 has questions about information sources (needed for Step 9), Stage 4 has questions about evaluation criteria (needed for Step 8). If any are missing, show a warning: Your survey may not collect enough data to populate [Step X]. Consider adding a question about [specific topic].

  Layer 2 - Response Quality Gap Detection (Response Manager / DCP Map): After responses are collected, analyze each DCP stage for response depth. Flag stages with fewer than 3 substantive responses or where answers are too short to draw conclusions. Show on the DCP Map page: Stage 3 has thin coverage (1 response, average 8 words per answer). Step 9 population may be unreliable. Recommended actions: [specific suggestions].

  Layer 3 - Step Population Gap Detection (Steps 4-9): When Copilot generates content for Steps 4-9 and the relevant DCP stage data is thin or missing, show a specific gap message instead of a generic draft: We could not find enough buyer research to confidently populate this step. Your DCP Map Stage [X] has insufficient data. To improve: [specific actionable recommendation]. This turns a limitation into a coaching moment.
