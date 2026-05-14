@AGENTS.md
# CLAUDE.md — Assembly AI

Read this file before every task. This is the single source of truth.
Full specs and architecture are in CONTEXT.md.

## Project
Multi-tenant C3 Method Operating System for Assembly Networks.
Repo: Mschaef2667/Assembly-AI
Stack: Next.js 14 App Router, TypeScript strict, Supabase, Tailwind, shadcn/ui, Claude API

## Brand Tokens (use exactly)
- Assembly Navy: #0A1628 (sidebar, headers)
- Signal Orange: #E8520A (CTAs, active states, approve buttons)
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

## Sprint 1 — COMPLETE
- [x] Persistent left-nav sidebar (components/layout/sidebar.tsx)
- [x] Dashboard shell with 5 widgets (app/dashboard/page.tsx)
- [x] Company profile wizard Steps 1–3.5 (app/dashboard/company-profile/page.tsx)
- [x] Wire form to Supabase (step_output table, auto-save, save state indicator)
- [x] PostHog telemetry (onboarding.step_completed, onboarding.completed, journey.ttfaj_started)
- [x] Auth pages: login, signup, reset-password (app/auth/)
- [x] Supabase middleware auth guard → /auth/login
- [x] Administration page: users, company settings, company profile link (app/dashboard/administration/)

## Sprint 2 — IN PROGRESS
- [ ] Build resolveContextPacket() in lib/context/resolveContextPacket.ts
- [ ] Build Step 4 Copilot integration (proof-of-concept) in app/dashboard/journeys/step/[stepId]/page.tsx
- [ ] Build Copilot output display component in components/copilot/CopilotOutput.tsx
- [ ] Wire copilot_run Supabase writes after every Claude API call
- [ ] Implement confidence decay calculation at read time in lib/context/confidenceDecay.ts

## Key Routes
- /dashboard → Workspace Dashboard (done)
- /dashboard/company-profile → Company Profile wizard (next)
- /dashboard/icp-offers → ICP & Offers
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

| preferred_model | text                          | NOT NULL | 'claude-sonnet-4-20250514'   |

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
Model: claude-sonnet-4-20250514
Max tokens: 1000
Never hardcode API key
Always write to copilot_run after every call
