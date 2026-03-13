-- mtUp Supabase migration: admin seed function for group availabilities
-- Date: 2026-03-08
-- Purpose:
-- - Allow admins to bulk-insert mock availabilities for seeding.
-- - Uses security definer to bypass strict RLS that only allows self-inserts.

create or replace function public.admin_seed_group_availabilities(
  target_group_id uuid,
  rows_json jsonb
)
returns void
security definer
set search_path = public
language plpgsql
as $$
declare
  requester_id uuid := auth.uid();
  row_data jsonb;
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

  for row_data in select jsonb_array_elements(rows_json)
  loop
    insert into public.availabilities (
      id,
      group_id,
      user_id,
      proposal_id,
      dates_json,
      time_slots_json,
      updated_at
    )
    values (
      (row_data->>'id')::uuid,
      target_group_id,
      (row_data->>'user_id')::uuid,
      (row_data->>'proposal_id')::uuid,
      coalesce(row_data->'dates', '[]'::jsonb),
      row_data->'time_slots',
      now()
    )
    on conflict (user_id, proposal_id) do update
    set dates_json = excluded.dates_json,
        time_slots_json = excluded.time_slots_json,
        updated_at = excluded.updated_at;
  end loop;
end;
$$;

revoke all on function public.admin_seed_group_availabilities(uuid, jsonb) from public;
grant execute on function public.admin_seed_group_availabilities(uuid, jsonb) to authenticated;