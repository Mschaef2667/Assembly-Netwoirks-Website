-- ============================================================================
-- Login frequency capture: login_events table + trigger on auth.users
-- ============================================================================
-- Adds full login history so client activity can show frequency/trends, not
-- just the most recent login. Every sign-in updates auth.users.last_sign_in_at;
-- a trigger turns that into an append-only row in public.login_events.
--
-- No application code required — capture is entirely at the database level.
--
-- >>> TEST IN DEV FIRST (project Assembly-AI-dev / acykwkvnrqbfnaazinhg) to
--     confirm sign-in still works, THEN apply to PRODUCTION
--     (project tiqznqmfivtgttmdiqrn) — production is where real client logins
--     happen, so the capture must ultimately live there. <<<
--
-- SAFETY: the trigger wraps its insert in an exception guard so a logging
-- failure can NEVER block a user from signing in.
-- ============================================================================

-- ---- table ------------------------------------------------------------------
create table if not exists public.login_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  org_id      uuid,
  occurred_at timestamptz not null default now()
);

create index if not exists login_events_org_time_idx
  on public.login_events (org_id, occurred_at desc);
create index if not exists login_events_user_time_idx
  on public.login_events (user_id, occurred_at desc);

-- ---- RLS (hygiene; the weekly sync reads via service role and bypasses it) --
alter table public.login_events enable row level security;

drop policy if exists login_events_org_select on public.login_events;
create policy login_events_org_select on public.login_events
  for select using (
    org_id in (select users.org_id from public.users where users.id = auth.uid())
  );

-- ---- trigger function -------------------------------------------------------
create or replace function public.log_login_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.last_sign_in_at is distinct from OLD.last_sign_in_at
     and NEW.last_sign_in_at is not null then
    begin
      insert into public.login_events (user_id, org_id, occurred_at)
      values (
        NEW.id,
        (select u.org_id from public.users u where u.id = NEW.id),
        NEW.last_sign_in_at
      );
    exception when others then
      -- Logging must never block authentication. Swallow any error.
      null;
    end;
  end if;
  return NEW;
end;
$$;

-- ---- trigger ----------------------------------------------------------------
drop trigger if exists on_auth_login on auth.users;
create trigger on_auth_login
  after update of last_sign_in_at on auth.users
  for each row
  execute function public.log_login_event();

-- ---- baseline backfill (one event per user's current last_sign_in_at) -------
-- Gives an immediate starting data point so history isn't empty on day one.
insert into public.login_events (user_id, org_id, occurred_at)
select au.id, u.org_id, au.last_sign_in_at
from auth.users au
join public.users u on u.id = au.id
where au.last_sign_in_at is not null
  and not exists (
    select 1 from public.login_events le
    where le.user_id = au.id and le.occurred_at = au.last_sign_in_at
  );

-- ---- verification -----------------------------------------------------------
-- select count(*) from public.login_events;
-- After a test sign-in in dev, confirm a new row appears:
-- select * from public.login_events order by occurred_at desc limit 5;
