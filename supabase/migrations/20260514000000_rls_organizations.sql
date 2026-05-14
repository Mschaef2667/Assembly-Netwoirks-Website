-- Migration: RLS policies for organizations table
-- Allows org_admin users to read and update their own organization row.

alter table organizations enable row level security;

-- org_admin can read their own organization
drop policy if exists "org_admin_select_own_org" on organizations;
create policy "org_admin_select_own_org"
  on organizations
  for select
  using (
    id in (
      select org_id from users
      where id = auth.uid()
        and role = 'org_admin'
    )
  );

-- org_admin can update their own organization
drop policy if exists "org_admin_update_own_org" on organizations;
create policy "org_admin_update_own_org"
  on organizations
  for update
  using (
    id in (
      select org_id from users
      where id = auth.uid()
        and role = 'org_admin'
    )
  )
  with check (
    id in (
      select org_id from users
      where id = auth.uid()
        and role = 'org_admin'
    )
  );
