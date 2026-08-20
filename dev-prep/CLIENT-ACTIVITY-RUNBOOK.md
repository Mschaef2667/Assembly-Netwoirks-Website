# Client Login Activity + Check-ins — Status & Runbook

Tracks how active Assembly AI clients are and prompts check-ins when they go quiet. **Login data is always read from PRODUCTION** (`Mschaef2667's Project`, project_id `tiqznqmfivtgttmdiqrn`) — the dev project is only for safely testing the frequency-capture migration.

## Already live (built 2026-08-06, no dev needed)

- **Notion "Client Activity (Assembly AI)"** database (under 🏠 Home) — one row per client account. Columns: Client, Account Status, Users, Last Login, Days Since Login (live formula), Activity (live formula: Active ≤14d / At risk 15–30d / Inactive >30d), Last Check-in, Next Step, Notes. Seeded with Assembly Networks (last login 2026-07-15) and Apex Solutions (2026-05-26). "Test Organization" intentionally excluded.
- **Notion "Client Check-ins (Assembly AI)"** database (under 🏠 Home) — follow-up tasks with drafted emails, linked to the client account. First task already created for Assembly Networks (22 days inactive) with a drafted email.
- **Weekly scheduled task** `client-login-activity-checkins` (Mondays ~8am). Each run: reads production login state, refreshes the Client Activity rows, and drafts a check-in (task + email) for any client past the 14-day threshold — skipping clients that already have an open check-in. Drafts only; nothing is sent automatically.

**Tip:** open the scheduled task once and hit "Run now" to pre-approve the Supabase + Notion tools, so future Monday runs don't pause on permission prompts.

## Current snapshot (2026-08-06)

| Client | Status | Users | Last login | Days | Activity |
|---|---|---|---|---|---|
| Assembly Networks | active | 3 | 2026-07-15 | 22 | At risk |
| Apex Solutions | trial | 1 | 2026-05-26 | 72 | Inactive |

## The frequency-history piece (dev-first, then production)

The live setup tracks **recency** (last login → inactivity), which covers the check-in goal. To also track **login frequency/trends** (how often, counts over time), apply `03_login_events_capture.sql`: a `login_events` table plus a trigger on `auth.users` that logs every sign-in. No app code — it's all at the database level, and the trigger is exception-guarded so it can never block a login.

**Order:**
1. **Dev** (`Assembly-AI-dev` / `acykwkvnrqbfnaazinhg`): apply `03_login_events_capture.sql`, then do a test sign-in and confirm a row lands in `login_events` and that signing in still works normally.
2. **Production** (`tiqznqmfivtgttmdiqrn`): apply the same file. This is required — real client logins only happen in production, so the capture has to live there. (Copy it into `supabase/migrations/<timestamp>_login_events.sql` as the canonical migration at apply time.)
3. **Extend the weekly task** to use the new history: add login counts (e.g. logins in the last 30/90 days) from `login_events` to the Client Activity rows. Add a "Logins (30d)" number column to the Client Activity database and populate it in Step 2 of the scheduled task.

## Guardrails & rollback
- `login_events` is additive; nothing else reads it, so it can't affect the app.
- The trigger swallows its own errors — a logging failure never blocks authentication.
- **Rollback:**
  ```sql
  drop trigger if exists on_auth_login on auth.users;
  drop function if exists public.log_login_event();
  drop table if exists public.login_events;
  ```

## Reference (IDs)
- Production Supabase project_id: `tiqznqmfivtgttmdiqrn`
- Dev Supabase project_id: `acykwkvnrqbfnaazinhg`
- Notion "Client Activity" data source: `71125ef8-f55d-45cb-ad0c-c69ec51d5f6d`
- Notion "Client Check-ins" data source: `2dc42c33-2895-4778-9552-618ea1dce661`
- Inactivity threshold: 14 days
