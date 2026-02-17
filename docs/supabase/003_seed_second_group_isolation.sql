-- Seed a second isolated group for multi-group testing
-- Assumes 002 seed already ran and profiles exist.

-- Create second group owned by Diana
insert into public.groups (name, created_by)
select
  'Ops Group',
  p.id
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'diana@mtup.local'
  and not exists (
    select 1 from public.groups g where g.name = 'Ops Group'
  );

-- Add memberships for second group
insert into public.group_memberships (group_id, user_id, role)
select
  g.id as group_id,
  p.id as user_id,
  case
    when u.email = 'diana@mtup.local' then 'owner'
    when u.email = 'eve@mtup.local' then 'admin'
    else 'member'
  end as role
from public.groups g
join public.profiles p on true
join auth.users u on u.id = p.id
where g.name = 'Ops Group'
  and u.email in (
    'diana@mtup.local',
    'eve@mtup.local',
    'charlie@mtup.local'
  )
on conflict (group_id, user_id) do update
set role = excluded.role;

-- Membership overview across both groups
select
  g.name as group_name,
  p.display_name,
  gm.role
from public.group_memberships gm
join public.groups g on g.id = gm.group_id
join public.profiles p on p.id = gm.user_id
where g.name in ('Core Group', 'Ops Group')
order by g.name, case gm.role when 'owner' then 1 when 'admin' then 2 else 3 end, p.display_name;
