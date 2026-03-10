-- mtUp Supabase migration: restore admin membership management with safe definer functions
-- Date: 2026-03-08
-- Purpose:
-- - Keep strict table RLS on profiles and group_memberships.
-- - Restore full admin membership CRUD through explicit RPC functions.
-- - Provide a safe member listing function that works for group members without recursive RLS.

create or replace function public.list_group_members(target_group_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  is_platform_admin boolean,
  role text
)
security definer
set search_path = public, auth
language plpgsql
as $$
declare
  requester_id uuid := auth.uid();
  requester_is_member boolean;
  requester_is_admin boolean;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  select exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = target_group_id
        and gm.user_id = requester_id
    ),
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = target_group_id
        and gm.user_id = requester_id
        and gm.role in ('owner', 'admin')
    )
  into requester_is_member, requester_is_admin;

  if not requester_is_member then
    raise exception 'Not a member of this group';
  end if;

  return query
  select
    gm.user_id,
    p.display_name,
    case when requester_is_admin then au.email::text else null end as email,
    p.is_platform_admin,
    gm.role::text
  from public.group_memberships gm
  join public.profiles p on p.id = gm.user_id
  left join auth.users au on au.id = gm.user_id
  where gm.group_id = target_group_id
  order by lower(p.display_name), gm.created_at, gm.user_id;
end;
$$;

create or replace function public.admin_provision_group_member(
  target_group_id uuid,
  target_user_id uuid,
  target_display_name text,
  target_is_admin boolean default false
)
returns void
security definer
set search_path = public, auth
language plpgsql
as $$
declare
  requester_id uuid := auth.uid();
  requested_role text := case when target_is_admin then 'admin' else 'member' end;
  existing_role text;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = requester_id
      and gm.role in ('owner', 'admin')
  ) then
    raise exception 'Admin access required for this group';
  end if;

  if not exists (
    select 1
    from auth.users au
    where au.id = target_user_id
  ) then
    raise exception 'Auth user does not exist';
  end if;

  if btrim(coalesce(target_display_name, '')) = '' then
    raise exception 'Display name is required';
  end if;

  insert into public.profiles (id, display_name, is_platform_admin)
  values (target_user_id, btrim(target_display_name), target_is_admin)
  on conflict (id) do update
    set display_name = excluded.display_name,
        is_platform_admin = excluded.is_platform_admin;

  select gm.role
  into existing_role
  from public.group_memberships gm
  where gm.group_id = target_group_id
    and gm.user_id = target_user_id;

  insert into public.group_memberships (group_id, user_id, role)
  values (
    target_group_id,
    target_user_id,
    coalesce(existing_role, requested_role)
  )
  on conflict (group_id, user_id) do update
    set role = case
      when public.group_memberships.role = 'owner' then 'owner'
      else excluded.role
    end;
end;
$$;

create or replace function public.admin_set_group_member_admin(
  target_group_id uuid,
  target_user_id uuid,
  target_is_admin boolean
)
returns void
security definer
set search_path = public, auth
language plpgsql
as $$
declare
  requester_id uuid := auth.uid();
  existing_role text;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = requester_id
      and gm.role in ('owner', 'admin')
  ) then
    raise exception 'Admin access required for this group';
  end if;

  select role
  into existing_role
  from public.group_memberships gm
  where gm.group_id = target_group_id
    and gm.user_id = target_user_id;

  if existing_role is null then
    raise exception 'Group member does not exist';
  end if;

  update public.profiles
  set is_platform_admin = target_is_admin
  where id = target_user_id;

  update public.group_memberships
  set role = case
    when existing_role = 'owner' then 'owner'
    when target_is_admin then 'admin'
    else 'member'
  end
  where group_id = target_group_id
    and user_id = target_user_id;
end;
$$;

create or replace function public.admin_rename_group_member(
  target_group_id uuid,
  target_user_id uuid,
  target_display_name text
)
returns void
security definer
set search_path = public, auth
language plpgsql
as $$
declare
  requester_id uuid := auth.uid();
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = requester_id
      and gm.role in ('owner', 'admin')
  ) then
    raise exception 'Admin access required for this group';
  end if;

  if not exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = target_user_id
  ) then
    raise exception 'Group member does not exist';
  end if;

  if btrim(coalesce(target_display_name, '')) = '' then
    raise exception 'Display name is required';
  end if;

  update public.profiles
  set display_name = btrim(target_display_name)
  where id = target_user_id;
end;
$$;

create or replace function public.admin_remove_group_member(
  target_group_id uuid,
  target_user_id uuid
)
returns void
security definer
set search_path = public, auth
language plpgsql
as $$
declare
  requester_id uuid := auth.uid();
  existing_role text;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  if requester_id = target_user_id then
    raise exception 'You cannot remove your own account';
  end if;

  if not exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = requester_id
      and gm.role in ('owner', 'admin')
  ) then
    raise exception 'Admin access required for this group';
  end if;

  select role
  into existing_role
  from public.group_memberships gm
  where gm.group_id = target_group_id
    and gm.user_id = target_user_id;

  if existing_role is null then
    raise exception 'Group member does not exist';
  end if;

  if existing_role = 'owner' then
    raise exception 'Owner accounts cannot be removed here';
  end if;

  delete from public.group_memberships
  where group_id = target_group_id
    and user_id = target_user_id;
end;
$$;

revoke all on function public.list_group_members(uuid) from public;
revoke all on function public.admin_provision_group_member(uuid, uuid, text, boolean) from public;
revoke all on function public.admin_set_group_member_admin(uuid, uuid, boolean) from public;
revoke all on function public.admin_rename_group_member(uuid, uuid, text) from public;
revoke all on function public.admin_remove_group_member(uuid, uuid) from public;

grant execute on function public.list_group_members(uuid) to authenticated;
grant execute on function public.admin_provision_group_member(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.admin_set_group_member_admin(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_rename_group_member(uuid, uuid, text) to authenticated;
grant execute on function public.admin_remove_group_member(uuid, uuid) to authenticated;
