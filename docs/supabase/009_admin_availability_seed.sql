-- mtUp Supabase migration: allow group admins to seed availability rows for mock coordination data
-- Date: 2026-03-10
-- Purpose:
-- - Preserve the existing self-write RLS on public.availabilities.
-- - Add one narrow admin-only RPC for server-side mock seeding and diagnostics.

create or replace function public.admin_seed_group_availabilities(
  target_group_id uuid,
  rows_json jsonb
)
returns integer
security definer
set search_path = public, auth
language plpgsql
as $$
declare
  requester_id uuid := auth.uid();
  inserted_count integer := 0;
begin
  if requester_id is null then
    raise exception 'Authentication required';
  end if;

  if target_group_id is null then
    raise exception 'Group is required';
  end if;

  if rows_json is null or jsonb_typeof(rows_json) <> 'array' then
    raise exception 'rows_json must be a JSON array';
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

  with normalized as (
    select
      coalesce(nullif(item->>'id', ''), gen_random_uuid()::text)::uuid as id,
      nullif(item->>'user_id', '')::uuid as user_id,
      nullif(item->>'proposal_id', '')::uuid as proposal_id,
      coalesce(item->'dates', '[]'::jsonb) as dates_json,
      case
        when item ? 'time_slots' then item->'time_slots'
        else null
      end as time_slots_json
    from jsonb_array_elements(rows_json) item
  ), validated as (
    select
      n.id,
      target_group_id as group_id,
      n.user_id,
      n.proposal_id,
      n.dates_json,
      n.time_slots_json
    from normalized n
    join public.group_memberships gm
      on gm.group_id = target_group_id
     and gm.user_id = n.user_id
    join public.proposals p
      on p.id = n.proposal_id
     and p.group_id = target_group_id
    where n.user_id is not null
      and n.proposal_id is not null
      and jsonb_typeof(n.dates_json) = 'array'
  ), upserted as (
    insert into public.availabilities (
      id,
      group_id,
      user_id,
      proposal_id,
      dates_json,
      time_slots_json,
      updated_at
    )
    select
      v.id,
      v.group_id,
      v.user_id,
      v.proposal_id,
      v.dates_json,
      v.time_slots_json,
      now()
    from validated v
    on conflict (user_id, proposal_id) do update
      set dates_json = excluded.dates_json,
          time_slots_json = excluded.time_slots_json,
          updated_at = now()
    returning 1
  )
  select count(*) into inserted_count from upserted;

  return inserted_count;
end;
$$;

revoke all on function public.admin_seed_group_availabilities(uuid, jsonb) from public;
grant execute on function public.admin_seed_group_availabilities(uuid, jsonb) to authenticated;
