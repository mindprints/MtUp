-- RLS isolation verification helper queries
-- Run these while authenticated as different users in Supabase SQL editor
-- (or via client) to validate group-scoped visibility.

-- 1) Show who you are
select auth.uid() as current_auth_uid;

-- 2) Which groups can I see?
select id, name, created_at
from public.groups
order by name;

-- 3) Which memberships can I see?
select g.name as group_name, p.display_name, gm.role
from public.group_memberships gm
join public.groups g on g.id = gm.group_id
join public.profiles p on p.id = gm.user_id
order by g.name, p.display_name;

-- 4) If proposals exist, I should only see my groups' proposals
select id, group_id, title, created_by, status, created_at
from public.proposals
order by created_at desc
limit 50;

-- 5) If availabilities exist, I should only see my groups' rows
select id, group_id, user_id, proposal_id, updated_at
from public.availabilities
order by updated_at desc
limit 50;
