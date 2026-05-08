# Assembly AI — Claude Code Context File

> Read this file at the start of every Claude Code session before writing any code.
> This is the single source of truth for architecture, brand, specs, and build rules.

---

## Project Overview

**Product:** Assembly AI — a multi-tenant, AI-powered C3 Method Operating System for Assembly Networks.
**Mission:** Turn customer decision intelligence into orchestrated Sales + Marketing execution with governance, measurement, and an implementation plan.
**Repo:** `Mschaef2667/Assembly-AI`
**Current status:** Schema complete, auth working, dashboard not yet built.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict mode) |
| Database | Supabase (Postgres + Realtime + Auth) |
| UI Library | shadcn/ui + Tailwind CSS |
| Background Jobs | Temporal or Inngest (TBD) |
| Error Tracking | Sentry |
| Analytics | PostHog |
| AI | Claude API (claude-sonnet-4-20250514) |
| Notifications | Zapier (Gmail + Slack webhooks) |

---

## Brand Tokens

Use these exactly. Never substitute generic Tailwind colors for brand colors.

| Token | Hex | Usage |
|---|---|---|
| Assembly Navy | `#0A1628` | Primary H2, global backgrounds, nav containers |
| Signal Orange | `#E8520A` | CTAs, active step states, Approve buttons, highlights |
| Paper White | `#F8F6F1` | Content backgrounds, cards |
| Logic Grey | `#6B7280` | Secondary text, inactive tabs, locked gate backgrounds |
| Rich Black | `#0D0D0D` | Primary body copy |

**Typography:**
- H1: Serif font
- H2–H4 + body: Sans-serif
- Minimum 24pt padding above all headers

**UX Principles:**
- Hick's Law: limit options per screen
- Fitts's Law: minimum 44×44px hit areas on all interactive elements
- Immediate feedback on every action
- Clear error states (never silent failures)

---

## Global Layout

**Persistent left-hand navigation sidebar** anchoring all pages.

Navigation sections (in order):
1. Workspace
2. ICP & Offers
3. Playbooks
4. Journeys
5. Assets Studio
6. Activation
7. Performance
8. Integrations

Sidebar background: Assembly Navy. Active item: Signal Orange. Inactive: Logic Grey text.

**File location:** `components/layout/Sidebar.tsx`

---

## RBAC Roles

| Role | Permissions |
|---|---|
| Admin | Billing, assignments, integration admin, override (logged), all modules |
| Contributor | Inputs + generates drafts. Cannot unlock gated phases. |
| Approver | Validates outputs, clears approval gates |

---

## Approval Gates

| Gate | Trigger | Unlocks |
|---|---|---|
| Gate 1 | DCP Map Approval (Phase 1) | Phase 2 |
| Gate 2 | Post-Company Formulas (after Step 16) | Stage 4 |
| Gate 3 | Sales Leadership Approval (after Step 30) | Stage 6 |
| Gate 4 | Action Plan Approval (after Step 38) | Phase 3 |
| Gate 5 | Final GTM Strategy Compilation | Export/publish |

**Gate UI rules:**
- Locked: Logic Grey background + padlock icon
- Pending: "Pending Approval" badge
- Approved: Signal Orange "Approve" CTA → confirmation check on click
- Gates control progression, not drafting. Users may draft freely; progression is blocked until approved.

---

## Three-Phase System

### Phase 1: Decision Intelligence
- Step 1: Company profile capture
- Step 2: AI generates DCP survey questions
- Step 4: Import results + normalize/tag → DCP Map
- **Gate 1** after DCP Map

### Phase 2: C3 Processing (Wizard UI, 38 Steps)
- Stage 1: Company Foundation (Steps 1–3.5)
- Stage 2: Endemic Problems (Steps 4–9)
- Stage 3: Company Formulas (Steps 10–16) → **Gate 2**
- Stage 4: Competitive Environments (Steps 17–26)
- Stage 5: Strategic Messages (Steps 27–30) → **Gate 3**
- Stage 6: Action Plan (Steps 31–38) → **Gate 4**

### Phase 3: Outputs & Operationalization
- Asset library publishing/versioning
- CRM export
- Usage tracking dashboard

---

## Step Dependency Map (canonical — do not modify)

```
1  Product/Service Profile        -> []
2  Top Three Target Market Segments -> []
3  Key Decision Makers Per Segment  -> []
3.5 Buying Center Evaluation        -> [3]
4  The Problem                    -> [1,3]
5  The Cause                      -> [1,3]
6  The Effect                     -> [1,3]
7  The Realization                 -> [3,4]
8  The Solution                   -> [3,4]
9  The Search                     -> [3,8]
10 The Promise                    -> [3,8]
11 Compelling Value Propositions   -> [1,4,6]
12 Critical Success Factors        -> [11]
13 Critical Success Formulas       -> [12]
14 Core Competencies               -> [13]
15 Key Selling Points              -> [11,13,14]
16 Acid Test                       -> [3,11,13,14]
[GATE 2]
17 Target Competition              -> [11]
18 Competitive Differentiators     -> [13,4,17]
19 Competitive Advantages          -> [17,18]
20 Competitive Threats             -> [11]
21 Acid Test                       -> [11]
22 Competitive Evaluation          -> [3,17]
23 Decision Process                -> []
24 Competitive Retaliation         -> []
25 Competitive Opportunities       -> [14]
26 Competitive Strength/Weaknesses -> [14]
27 The Set-Up                      -> [5,6]
28 The Jab                         -> [11,14]
29 Knock-Out                       -> [18]
30 Clean-Up                        -> [19,6]
[GATE 3]
31 Create Opportunities            -> [4,5,6,7]
32 Get Into Position               -> [9]
33 Grow Support                    -> [9,22]
34 Close The Sale                  -> [14,15,17,18]
35 Pat Them On The Back            -> []
36 Retrench                        -> [14,15,17,18]
37 Resources and Tools             -> [32,33,34,35,36]
38 Opportunity Evaluation          -> []
[GATE 4]
```

---

## Step Copilot: Behavior Rules

Every step includes an embedded Copilot with 4 actions:

1. **Draft** — generate first-pass output using prerequisite step outputs + user inputs
2. **Verify** — consistency checks against prerequisites, flag contradictions/gaps
3. **Improve** — rewrite for clarity + Assembly voice without changing meaning
4. **Explain** — show which fields were used from which prerequisite steps

**Every Copilot run must output:**
- Proposed Draft
- Confidence score (0–100)
- Sources Used (step_id + specific fields)
- Assumptions made
- Open questions (what user must answer next)
- Verification checks (pass/fail, severity, fix recommendations)

**Copilot rules:**
- Never silently overwrite user content. Propose drafts and diffs only.
- If prerequisites are missing: list them, produce "Incomplete Draft," provide "to complete" checklist.
- Always pull latest draft (highest version) regardless of approval status.
- Label output "Provisional (uses unapproved inputs)" if any prerequisite is unapproved.

---

## Dependency Resolution Policy

- Default prerequisite source = **Latest Draft** (highest version), regardless of approval status.
- Context Packet per prerequisite must include: `step_id`, `step_title`, `version`, `status`, `last_updated_at`, `last_updated_by`
- If a prerequisite changes after a dependent step was drafted: flag dependent as "Needs Review (Upstream Changed)" + offer one-click "Regenerate Draft with Latest Inputs"

**Badge rules:**
- 🟢 Green: all prerequisites approved
- 🟡 Yellow: uses latest drafts (unapproved inputs)
- 🔴 Red: missing prerequisites (partial draft)

---

## Confidence Decay Rules

Decay is calculated at **read time**, never stored. Original score is immutable.

| Trigger | Penalty |
|---|---|
| Direct prerequisite updated (unapproved) | -15 per prereq |
| Direct prerequisite updated (was approved, now changed) | -20 per prereq |
| Indirect prerequisite updated (2 hops) | -7 per prereq |
| Approver rejected a direct prerequisite | -25 per prereq |
| Not reviewed in 30 days | -5 flat |
| Not reviewed in 60 days | -10 flat |

Floor: 5. Displayed score = max(5, original - penalties).

**Badge thresholds:**
- 75–100: Green "High Confidence"
- 50–74: Yellow "Moderate Confidence"
- 25–49: Orange "Low Confidence"
- 5–24: Red "Needs Regeneration"

---

## Activated Journey Definition

**An Activated Journey** = workspace that has:
1. Completed onboarding (Steps 1, 2, 3, 3.5 saved)
2. Gate 1 approved by an Approver
3. At least one Phase 2 Copilot draft with confidence ≥ 60

**TTFAJ formula:**
```
TTFAJ = timestamp(journey.activated) - timestamp(journey.ttfaj_started)
```

`journey.ttfaj_started` fires on first dashboard load post-onboarding.
`journey.activated` fires when all three conditions are simultaneously true.

Activation status field on `workspace`: `incomplete` → `onboarding_complete` → `gate_1_approved` → `activated`

---

## Error Recovery Rules

### Claude API Failures
- Max 3 auto-retries: wait 2s → 5s → surface error
- No auto-retry on 429 (rate limit) or 401 (auth)
- On all retries failed: unlock manual draft fallback with banner
- Manual drafts flagged `copilot_assisted: false` on `step_output`

### Auto-Save
- Save on blur + every 30 seconds if field is active
- Save state indicator in step header: "Saved" / "Saving..." / "Save failed + Retry"
- On browser close: flush to `localStorage` as backup
- On next load: check `localStorage`, offer "Restore" or "Discard" if newer than Supabase

### Concurrent Edits
- Soft lock via Supabase Realtime: show "Mike is currently editing this step"
- Last write wins with diff modal on conflict
- User chooses: "Keep Mine" / "Keep Theirs" / "Merge Manually"
- Every save increments `version` on `step_output`. Never overwrite.

---

## Rate Limiting + Cost Guardrails

### Plan Tiers
| Plan | Daily Runs | Monthly Tokens | Overage |
|---|---|---|---|
| Starter | 50 | 500k | Hard block |
| Pro | 200 | 2M | Warn at 80%, block at 100% |
| Enterprise | Unlimited | Custom | Alert only |

### Token Budgets Per Run
- `max_tokens`: 1000
- Context packet max: 3000 tokens (trim if exceeded)
- System prompt max: 500 tokens
- Total input ceiling: 6000 tokens

### Cost Formula (Claude Sonnet 4)
```
input_cost  = input_tokens  / 1_000_000 * 3.00
output_cost = output_tokens / 1_000_000 * 15.00
```

Write to `workspace_usage` after every successful run.

---

## Onboarding Flow

```
Sign Up / Login → Create Workspace → Company Profile (Steps 1-3) → Buying Center (Step 3.5) → Invite Team → Dashboard
```

- Workspace creator is always Admin
- Steps 1–3.5 auto-save on blur
- Copilot is NOT active during onboarding (these are raw inputs)
- On completion: creates `step_output` records for Steps 1, 2, 3, 3.5 with `status: draft`
- `journey.ttfaj_started` fires on first dashboard load post-onboarding
- Abandoned onboarding: auto-save + "Continue Setup" banner on next login

---

## Key Supabase Tables (must exist before building UI)

### Core Business Objects
- `workspace` (id, name, industry, plan_tier, daily_run_limit, monthly_token_budget, activation_status, created_at)
- `users` (id, workspace_id, role: admin|contributor|approver, email)
- `step_definition` (id, step_number, step_title, validation_rules JSON)
- `step_dependency` (step_id, prerequisite_step_id)
- `step_output` (id, workspace_id, step_id, version, status: draft|pending_approval|approved, content JSON, original_confidence, last_reviewed_at, last_saved_at, copilot_assisted, last_updated_by, last_updated_at)
- `approval_gate` (id, workspace_id, gate_number, status: locked|pending|approved, approved_by, approved_at)

### Copilot + Validation
- `copilot_run` (id, workspace_id, step_id, prompt_version, context_hash, confidence_score, latency_ms, assumptions JSON, status: success|failed, error_code, created_at)
- `validation_check` (id, copilot_run_id, rule_id, pass, severity, fix_recommendation)
- `upstream_change_flag` (id, workspace_id, dependent_step_id, changed_prerequisite_id, flagged_at, resolved_at)

### Governance + Audit
- `audit_log` (id, workspace_id, actor_id, action_type, entity_type, entity_id, diff JSON, timestamp)
- `step_output_conflict` (id, step_output_id, workspace_id, version_a, version_b, resolved_by, resolution, resolved_at)
- `rate_limit_event` (id, workspace_id, event_type, step_id, triggered_at)

### Usage + Cost
- `workspace_usage` (id, workspace_id, date, runs_used, tokens_used, estimated_cost_usd, updated_at)
- `confidence_decay_log` (id, step_output_id, workspace_id, trigger_type, prerequisite_id, penalty, logged_at)

---

## PostHog Events (canonical list)

| Event | When |
|---|---|
| `workspace.created` | Workspace creation submit |
| `onboarding.step_completed` | Each of Steps 1, 2, 3, 3.5 saved |
| `onboarding.completed` | User lands on dashboard post-onboarding |
| `team.invite_sent` | Each team invite |
| `journey.ttfaj_started` | First dashboard load post-onboarding |
| `journey.gate1_submitted` | Gate 1 submitted for approval |
| `journey.gate1_approved` | Gate 1 approved |
| `journey.first_copilot_draft` | First Phase 2 Copilot run completes |
| `journey.activated` | All 3 activation conditions met |
| `confidence.decayed` | Score drops below a new threshold band |
| `confidence.regenerated` | User clicks Regenerate |
| `confidence.critical` | Score drops below 25 |
| `rate_limit.warning_80` | Workspace hits 80% of daily runs |
| `rate_limit.hard_block` | Workspace hits 100% of daily runs |
| `rate_limit.api_429` | Anthropic returns 429 |
| `cost.daily_logged` | Daily usage written to workspace_usage |

---

## Claude API Call Template

```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // API key injected by environment, never hardcoded
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: SYSTEM_PROMPT, // max 500 tokens, version-controlled
    messages: [
      { role: "user", content: buildCopilotPrompt(stepId, contextPacket, userInputs) }
    ],
  })
});
```

**Always write to `copilot_run` after every call** (success or failure).

---

## Copilot Output Schema (TypeScript)

```typescript
interface CopilotOutput {
  proposed_draft: string;
  confidence_score: number;          // 0–100
  sources_used: {
    step_id: string;
    step_title: string;
    fields_used: string[];
    version: number;
    status: 'draft' | 'pending_approval' | 'approved';
  }[];
  assumptions: string[];
  open_questions: string[];
  verification_checks: {
    rule: string;
    pass: boolean;
    severity: 'info' | 'warning' | 'error';
    fix_recommendation: string;
  }[];
  is_provisional: boolean;           // true if any prerequisite is unapproved
  is_incomplete: boolean;            // true if prerequisites are missing
  missing_prerequisites: string[];   // step_ids of missing prereqs
}
```

---

## resolveContextPacket() — Function Spec

```typescript
async function resolveContextPacket(
  stepId: string,
  workspaceId: string
): Promise<ContextPacket> {
  // 1. Look up step dependencies from step_dependency table
  // 2. Fetch latest step_output (highest version) for each prerequisite
  // 3. If any prerequisite missing: add to missing_prerequisites list
  // 4. Check approval status of each prerequisite
  // 5. Set is_provisional = true if any prerequisite is not approved
  // 6. Trim context if total tokens > 3000:
  //    a. Summarize indirect prerequisites (2+ hops) to 2 sentences
  //    b. If still over: drop indirect prerequisites, log omission
  //    c. If still over: truncate direct prerequisites to 300 tokens each
  // 7. Return structured ContextPacket
}

interface ContextPacket {
  step_id: string;
  prerequisites: {
    step_id: string;
    step_title: string;
    version: number;
    status: 'draft' | 'pending_approval' | 'approved';
    last_updated_at: string;
    last_updated_by: string;
    content: Record<string, unknown>;
    was_trimmed: boolean;
  }[];
  is_provisional: boolean;
  missing_prerequisites: string[];
  total_token_estimate: number;
}
```

---

## Sprint Plan

### Sprint 1: Dashboard + Company Profile
- [ ] Scaffold persistent left-nav sidebar (all 8 sections)
- [ ] Build dashboard shell with empty state widgets
- [ ] Build gate status widget (hardcoded states first, wire to DB after)
- [ ] Build company profile form (Steps 1–3 inputs)
- [ ] Wire company profile form to Supabase writes
- [ ] Add auto-save with save state indicator
- [ ] Fire onboarding telemetry events to PostHog

### Sprint 2: Step Copilot Foundation
- [ ] Implement `resolveContextPacket()` with unit tests
- [ ] Build Step 4 Copilot integration (proof-of-concept)
- [ ] Build Copilot output display component (confidence badge, sources, provisional label)
- [ ] Wire `copilot_run` and `step_output` Supabase writes
- [ ] Implement confidence decay calculation at read time

### Sprint 3: Phase 1 Full Flow + Gate 1
- [ ] Steps 1–4 wired end-to-end
- [ ] DCP Map table view (survey import + normalize/tag)
- [ ] Gate 1 UI: locked state, Pending Approval badge, Approver CTA
- [ ] TTFAJ tracking event fired when Gate 1 approved
- [ ] Zapier webhook for Gate 1 approval notification

---

## Code Quality Rules

- TypeScript strict mode. No `any` types.
- Every Supabase write wrapped in try/catch with Sentry capture on error.
- Every Claude API call writes to `copilot_run` regardless of success or failure.
- Never hardcode API keys. Use environment variables only.
- Auto-save must never block the UI thread. Use debounced async writes.
- All interactive elements: minimum 44×44px hit area.
- Copilot never overwrites user content silently. Always propose + diff.
- Gate actions (approve/reject) always write to `audit_log`.

---

## Default Assumptions (use if user has not specified)

- CRM: HubSpot default, optional Salesforce bi-directional sync
- Buyer complexity: 6–10 stakeholders, consensus decisioning
- ACV: $10k–$100k
- Sales cycle: 3–9 months
- Plan tier: Starter (50 runs/day, 500k tokens/month)

---

*Last updated: May 2026. Update this file whenever a new spec is finalized.*
