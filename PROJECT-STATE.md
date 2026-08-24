# Assembly AI — Project State Primer

**Purpose:** Drop-in context file so any new Claude session (Cowork, Chat, or Code) starts
informed about where Assembly AI stands, how Michael works, and what's open. Keep this next
to CLAUDE.md in the project folder. Update it as things change.

**Last updated:** August 5, 2026

---

## 1. Who / What

- **Founder:** Michael Schaefer, Denver, CO. 20+ years senior marketing executive. Non-programmer
  who builds via Claude Code (in VS Code) with architecture discussed first.
- **Two ventures:**
  - **Assembly Networks** — B2B sales/marketing consulting built on the proprietary **C3 Method™**.
  - **Assembly AI** (assemblyai.net) — multi-tenant B2B SaaS that operationalizes the C3 Method as a
    structured 38-step go-to-market workflow. This primer is about Assembly AI.
- **CSO:** Rocky Faruque — contract CSO (well-respected, serves several companies). Owns
  security/infrastructure. Applied + verified the users-table security fix. Will handle/lead
  magic links, email delivery, dev environment.

## 2. Tech Stack & Deploy Flow

- **Stack:** Next.js, Supabase (Postgres + Auth + RLS), Tailwind, TypeScript, Anthropic API.
- **Hosting:** Vercel — **auto-deploys on push to `main`**. Deployment is effectively a GitHub flow
  (push → Vercel builds automatically). No manual Vercel step.
- **Repo:** GitHub `Mschaef2667/Assembly-Netwoirks-Website` (note: the repo name has an intentional/
  historical typo "Netwoirks" — that's correct, not an error).
- **Domains:** assemblyai.net (the app), assemblynetworks.net (consulting site). Email on
  assemblynetworks.net now runs through **Google Workspace** (migrated off SiteGround; Rocky handled).

## 3. The Standard Workflow (IMPORTANT — follow this)

1. **Discuss architecture in chat first** — agree on the approach before any code.
2. **Diagnose before changing** — for any change, first run a READ-ONLY investigation to understand
   current behavior. Never blind-edit.
3. **One Claude Code prompt at a time** — Claude produces a single, self-contained prompt for Michael
   to paste into Claude Code (in VS Code). Prompts say "report only / no changes" for diagnostics, and
   "do NOT commit — I'll review, then deploy" for edits.
4. **Michael reviews the result**, then commits/pushes separately:
   `git add -A && git commit -m "..." && git push origin main`
5. **Verify on live Vercel** (hard-refresh) after deploy.
- **Database changes: Rocky advises, Michael instructs, Claude executes via the Supabase connector.**
  Rocky (CSO) owns security/infrastructure and advises on approach. Michael is the decision-maker and
  gives the authorization. When Michael explicitly instructs it, Claude MAY run database changes through
  the Supabase connector (schema/DDL, RLS, migrations). Michael's explicit instruction — per change — is
  the authorization. Claude still does NOT act on a third party's relayed say-so in chat ("Rocky said…");
  that becomes actionable only once Michael confirms it as his own instruction.
- **Guardrails still apply to every DB change:**
  1. **Diagnose read-only first** — inspect current schema/RLS before writing. Never blind-change.
  2. **Migrations are the source of truth** — every change is written as a migration file in
     `supabase/migrations/` and committed, so the repo can rebuild the database. No orphan changes that
     exist only in the live DB.
  3. **Dev-first once dev exists** — apply to the dev Supabase project, verify, then apply to production.
     Until the dev project exists, the connector points at PRODUCTION, so pre-dev connector writes hit
     live data directly — treat those with extra care and prefer migration files that a human applies.
  4. **Verify after** — confirm the change and its RLS behave as intended.
- Michael can still run SQL himself in Supabase Studio when he prefers; the connector path is an option,
  not a replacement.

## 4. The C3 Method (product foundation)

- **7 STAGES** = the buyer's universal decision process: 1 Need Recognition → 2 Trigger/Catalyst →
  3 Search/Awareness → 4 Evaluation/Consideration → 5 Select-Set/Shortlist → 6 Decision/Purchase →
  7 Confirmation/Validation. (Shared constant: `lib/c3/decisionStages.ts` → `DECISION_STAGES`.)
- **38 STEPS** = what the Assembly AI *user* works through, organized into **6 PHASES**:
  Company Foundation, Endemic Problems, Company Formulas, Competitive Environments, Strategic Messages,
  Engagement Plan.
- **ACID TESTS** (both about KDM *perception/belief*, a mirror pair):
  - **Acid Test 1 (Step 16):** Do the key decision-makers believe OUR CLIENT has the core competencies
    to deliver on their critical success formulas?
  - **Acid Test 2 (Step 21):** Do the KDMs believe the CLIENT'S COMPETITORS can?
  - Whoever earns KDM confidence in competencies + critical success formulas wins the delivery evaluation.
- **FULL-CIRCLE VISION:** Intelligence + Journeys (strategy) → Lead Generation (find/score leads) →
  Asset Studio (decks/landing pages/emails) → Integrations (CRM/marketing-automation) → Performance
  (measure, feed back to refine strategy). The loop compounds. Lead Gen / Asset Studio / Integrations
  are "coming soon" stubs today.

## 5. Key Architecture Facts (so you don't re-discover them)

- **Insights generation:** `app/api/intelligence/generate-insights/route.ts`. Grounded in 3 internal
  sources: raw survey responses + DCP analysis stage summaries + Phase 1 steps 1-3. NO web data.
  Confidence scores (0-100) are the honesty signal for thin data.
- **ICP generation:** `app/api/copilot/icp-generate/route.ts`; context assembled in
  `app/dashboard/target-markets/page.tsx`. Grounded in Phase 1 + APPROVED DCP analysis (summaries, not
  raw responses) + Journey steps 4-8. NO web data. Depends on DCP being approved.
- **Only web-search feature in the whole app:** Step 17 **Competitor Discovery**
  (`app/api/copilot/competitive-discovery/route.ts`). (Recently relabeled from "Select Set Discovery"
  to "Competitor Discovery" on button + panel heading.)
- **Competitors live in 3 disconnected places** (not cross-referenced): Step 17 editor
  (`CompetitorStepEditor.tsx`, source = dcp|discovery|manual), Insights `key_competitors`, and DCP
  Stage 5. See backlog PRD to unify + add source-based confidence.
- **Demo workspace:** "Assembly Networks" (Michael's own). A fictitious beta client "Apex Solutions"
  was seeded across all 38 steps for demo purposes.
- **7-stage duplication:** `DECISION_STAGES` is the shared constant, but old inline copies still exist
  in `analyze-dcp/route.ts`, `analyze/route.ts`, and `dcp-map/page.tsx` (deliberately left; P2 cleanup
  logged — reconcile naming when consolidating).

## 6. Security Status (as of 6/24/26)

- **RLS enabled on all 36 tables** (verified live). Tenant isolation sound; cross-tenant reads blocked.
- **Signup assigns a unique org_id per account** (verified).
- **users-table UPDATE policy fix: APPLIED + VERIFIED** by Rocky. `users_update` now has a `with_check`
  so a user can't change their own `org_id` or `role` (no tenant pivot, no privilege escalation).
  Normal profile edits still work.
- **Open security items (logged, P2, Rocky owns):** consolidate duplicate/overlapping RLS policies
  (esp. `dcp_maps` where a looser policy undercuts a stricter one); review permissive `with_check:true`
  INSERT policies (`response_answers`, `survey_responses` — confirm org_id set server-side); review
  service_role API routes (each bypasses RLS, needs its own authz check — biggest remaining surface,
  code-level); professional pen test before scale.

## 7. Demo Readiness

- **Demo narrative spine: DONE and validated** (resonated with Rocky in a live run). Five beats:
  (1) Hook = 7-stage universal buyer-decision truth; (2) two blind spots (never measuring how buyers
  decide; answering the wrong question — features vs delivery); (3) three pillars ("Real intelligence.
  Proven principles. The power of AI."); (4) product-walk proof; (5) full-circle horizon. Plus objection
  pre-empts (hallucination; data privacy; "isn't this just ChatGPT").
- **CSG wrapper: DONE** — peer-not-pitch posture for Steve (Communication Strategy Group founder, friend).
  Now it's about having the open conversation.
- **Nonprofit/foundation prospect:** Michael handles the reframing himself.
- **Still unwritten (lower urgency, demos further out):** SaaS-company wrapper (parallel-run bake-off vs
  their hired agency) and engineering/architecture-firm wrapper (multi-stakeholder, "who delivers best").
- **Before demos:** confirm the demo workspace DCP is APPROVED before showing ICP; QA Step 17
  Competitor Discovery (web-search feature, central to the competitor story) before showing it live.

## 8. Pre-Beta Technical Track (with Rocky)

- **Profile page:** users currently have no place to edit their own details (Rocky noticed there may be
  no user-facing self-update of the users row). Plan: Michael + Claude build, Rocky security-reviews.
  Run a read-only diagnostic first (how do users rows get updated; is a profile page needed for betas).
- **Email delivery:** investigate **extending Resend** (already used for white-paper / demo-request
  emails) to handle transactional/auth email BEFORE adding a new vendor like SendGrid. Supabase's
  built-in email is rate-limited / not for production volume.
- **Magic links (passwordless login):** Rocky leads the auth/security decisions. DEPENDS on email
  delivery being solid first (magic links are emails). Sequence: email → magic links (coupled);
  profile page in parallel.
- **Dev/staging environment** before first beta (logged P1).
- **Dashboard "Phase 1 Complete" banner** should align with the 3-step onboarding (Step 3.5 was dropped
  from the onboarding card; drop 3.5 from the `PHASE1_STEPS` constant in `app/dashboard/page.tsx`) —
  logged P1 Bug.

## 9. Backlog Highlights (in Notion — POC Tasks board)

- **Notion POC Tasks data source ID:** `75c65841-b604-4b46-bae0-a8609b241f9d`
  (use `collection://` prefix for SQL queries). Project hub page: "Assembly AI".
  Task props: Status (Backlog/Up Next/In Progress/In Review/Done/Blocked), Priority (P0/P1/P2),
  Module (Deal Intake/Journey Mapper/Alignment Scorer/Gap Detector/Recommendation Engine/Dashboard UI/
  Data Layer/Auth/Other — NOTE: no "Intelligence" option, use "Other"), Type (Polish/Feature/Audit/Bug).
- **PRDs logged:** dependency-aware update propagation; unify competitor sources + source-based
  confidence; per-competitor Acid Test 2 scoring (two scores → threat matrix: "Competition" score =
  how real/legit a threat [survey=high, client-known=med, AI-suggested=low] + "Acid Test" score = KDM
  belief they can deliver); surface upstream context on Step 21; segment-aware onboarding (nonprofit is
  the key case); Lead Generation vision (strategy-grounded lead scoring; rent data / own the scoring;
  investigate extending Resend; let beta feedback inform it).

## 10. Outreach In Motion (founder relationship-building; "want your honest take," not a pitch)

- **Bonnie Krahn** — Strategic Partnership Mgr, River Valley Architects (architecture firm, Denver/Aurora
  office). Met at a charity golf tournament ~2 weeks ago; she encouraged reach-out. Follow-up email sent.
  This is the engineering/architecture-firm demo prospect.
- **Rocky** — three-item plan email sent (profile page / email delivery / magic links).
- **John Raeder** (spelling: **Raeder**) — former boss, Facebook friends, mutual friends; Vice Chairman &
  Head of Software Investments at Bow River Capital (Denver). Serial SaaS CEO/PE investor whose thesis is
  GTM acceleration (340-page growth playbook). LinkedIn reconnect + beer invite sent.
- **Drafts ready, not yet sent:** Mike Biselli (Catalyst HTI president), Mike Mara (CSG Systems VP
  Strategic Accounts — different "CSG" than Communication Strategy Group).
- **Deferred:** Worldpay "Senior Manager, GTM" cover letter (genuine application framing; needs Michael's
  quantified career metrics). PayLogic (paylogicsolutions.com, former client) is only payments-sector
  familiarity — NO connection to Worldpay/Global Payments.

## 11. Style / Working Preferences

- ADHD-friendly: scannable sections, clear headers, tight bullets, bold cues. No em dashes (use commas,
  periods, parentheses).
- Michael values honest pushback, diagnose-before-change discipline, tight scope (avoid sprawl), and
  separating "true today" from "to verify."
- Default to helping Michael keep the demo narrative as the highest-priority pre-demo work vs. endless
  product polish.
