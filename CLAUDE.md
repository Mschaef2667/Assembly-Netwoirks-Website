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

## Current Sprint: Sprint 1
Completed:
- [x] Persistent left-nav sidebar (components/layout/sidebar.tsx)
- [x] Dashboard shell with 5 widgets (app/dashboard/page.tsx)

In progress:
- [ ] Company profile form (Steps 1-3) at app/dashboard/company-profile/page.tsx
- [ ] Wire form to Supabase
- [ ] Auto-save with save state indicator
- [ ] PostHog telemetry events

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
workspace, users, step_definition, step_dependency, step_output,
Note: `users.org_id` is the workspace foreign key (not `workspace_id`).
approval_gate, copilot_run, validation_check, upstream_change_flag,
audit_log, step_output_conflict, rate_limit_event, workspace_usage,
confidence_decay_log

## Step Output Schema
status: 'draft' | 'pending_approval' | 'approved'
Fields: id, workspace_id, step_id, version, status, content JSON,
original_confidence, last_reviewed_at, last_saved_at,
copilot_assisted, last_updated_by, last_updated_at

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
