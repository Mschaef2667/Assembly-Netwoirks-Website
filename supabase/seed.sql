-- Seed: test organization and user for local/staging development.
-- Safe to run multiple times — ON CONFLICT DO NOTHING.

insert into organizations (id, name, slug, website, status)
values (
  '35e0e4b7-9427-448a-b4df-9d9f0bde1873',
  'Assembly Networks',
  'assembly-networks',
  'https://assemblynetworks.net',
  'active'
)
on conflict (id) do nothing;

insert into users (id, org_id, role, email, is_active)
values (
  '35e0e4b7-9427-448a-b4df-9d9f0bde1873',
  '35e0e4b7-9427-448a-b4df-9d9f0bde1873',
  'org_admin',
  'mschaef@gmail.com',
  true
)
on conflict (id) do nothing;
