-- Seed example profiles + default group memberships for mtUp
-- Prerequisite:
-- 1) Create these auth users first in Supabase Dashboard -> Authentication -> Users:
--    alice@mtup.local, bob@mtup.local, charlie@mtup.local, diana@mtup.local, eve@mtup.local
-- 2) Use the same password for all if desired (dev only).

-- Upsert profiles from existing auth users
insert into public.profiles (id, display_name, is_platform_admin)
select
  u.id,
  case u.email
    when 'alice@mtup.local' then 'Alice'
    when 'bob@mtup.local' then 'Bob'
    when 'charlie@mtup.local' then 'Charlie'
    when 'diana@mtup.local' then 'Diana'
    when 'eve@mtup.local' then 'Eve'
    else split_part(u.email, '@', 1)
  end as display_name,
  case when u.email = 'alice@mtup.local' then true else false end as is_platform_admin
from auth.users u
where u.email in (
  'alice@mtup.local',
  'bob@mtup.local',
  'charlie@mtup.local',
  'diana@mtup.local',
  'eve@mtup.local'
)
on conflict (id) do update
set
  display_name = excluded.display_name,
  is_platform_admin = excluded.is_platform_admin;

-- Create one default group if it does not exist
insert into public.groups (name, created_by)
select
  'Core Group',
  p.id
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'alice@mtup.local'
  and not exists (
    select 1 from public.groups g where g.name = 'Core Group'
  );

-- Add memberships to default group (owner/admin/member)
insert into public.group_memberships (group_id, user_id, role)
select
  g.id as group_id,
  p.id as user_id,
  case
    when u.email = 'alice@mtup.local' then 'owner'
    when u.email = 'bob@mtup.local' then 'admin'
    else 'member'
  end as role
from public.groups g
join public.profiles p on true
join auth.users u on u.id = p.id
where g.name = 'Core Group'
  and u.email in (
    'alice@mtup.local',
    'bob@mtup.local',
    'charlie@mtup.local',
    'diana@mtup.local',
    'eve@mtup.local'
  )
on conflict (group_id, user_id) do update
set role = excluded.role;

-- Verify
select
  g.name as group_name,
  p.display_name,
  gm.role,
  p.is_platform_admin
from public.group_memberships gm
join public.groups g on g.id = gm.group_id
join public.profiles p on p.id = gm.user_id
where g.name = 'Core Group'
order by
  case gm.role when 'owner' then 1 when 'admin' then 2 else 3 end,
  p.display_name;
