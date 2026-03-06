-- mtUp Supabase migration: split proposal authorship from row creator
-- Date: 2026-03-06
-- Purpose:
-- - Keep `created_by` as the authenticated actor / row owner for RLS.
-- - Add `authored_by` as the display/provenance author so Resolver variants can
--   preserve the original proposal author without breaking insert policies.

alter table public.proposals
add column if not exists authored_by uuid references public.profiles(id) on delete restrict;

update public.proposals
set authored_by = created_by
where authored_by is null;

alter table public.proposals
alter column authored_by set not null;

create or replace function public.is_specific_group_member(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = target_user_id
  );
$$;

drop policy if exists "proposals_insert_members" on public.proposals;
create policy "proposals_insert_members"
on public.proposals for insert
with check (
  public.is_group_member(group_id)
  and created_by = auth.uid()
  and public.is_specific_group_member(group_id, authored_by)
);

drop policy if exists "proposals_update_creator_or_group_admin" on public.proposals;
create policy "proposals_update_creator_or_group_admin"
on public.proposals for update
using (
  created_by = auth.uid()
  or public.is_group_admin_or_owner(group_id)
)
with check (
  public.is_specific_group_member(group_id, authored_by)
);
