-- Invite-only onboarding: org_invites holds reusable, revocable, expiring
-- invitation links. A signup is only possible through a valid invite, which
-- associates the new user with an existing organization.
-- Applied to DEV via the Supabase connector; apply to PRODUCTION before the
-- invite code ships to prod.

create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  role public.user_role not null default 'sales_rep',
  email_domain text,            -- optional allowlist, e.g. 'clientco.com'
  max_uses integer,             -- null = unlimited
  used_count integer not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists org_invites_token_idx on public.org_invites (token);

alter table public.org_invites enable row level security;

drop policy if exists org_invites_super on public.org_invites;
create policy org_invites_super on public.org_invites for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_super_admin))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.is_super_admin));

drop policy if exists org_invites_org_admin on public.org_invites;
create policy org_invites_org_admin on public.org_invites for all
  using (org_id in (select u.org_id from public.users u where u.id = auth.uid() and u.role = 'org_admin'))
  with check (org_id in (select u.org_id from public.users u where u.id = auth.uid() and u.role = 'org_admin'));
