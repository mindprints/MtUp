-- HOTFIX: Resolve stack depth recursion on public.group_memberships RLS
-- Symptom:
--   500 + code 54001 "stack depth limit exceeded" when selecting group_memberships
-- Cause:
--   group_memberships select policy called is_group_member(), which queries group_memberships,
--   recursively invoking its own policy.

-- Remove recursive policies
drop policy if exists "memberships_select_members" on public.group_memberships;
drop policy if exists "memberships_manage_admin_or_owner" on public.group_memberships;

-- Non-recursive read policy:
-- users can read only their own membership rows
create policy "memberships_select_self"
on public.group_memberships for select
using (user_id = auth.uid());

-- Optional management policy placeholder (disabled for now to avoid recursive checks)
-- Add back when server-side admin membership management is implemented with safe definer functions.
-- create policy "memberships_manage_disabled"
-- on public.group_memberships for all
-- using (false)
-- with check (false);
