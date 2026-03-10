create table if not exists public.proposal_contributions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('affirmation', 'availability', 'field_change', 'comment')),
  field text check (field in ('date', 'time', 'place', 'requirements', 'general')),
  value_json jsonb not null default '{}'::jsonb,
  provenance text not null check (provenance in ('implicit_proposer', 'explicit_click', 'inferred_from_delta', 'manual_entry')),
  created_at timestamptz not null default now()
);

create index if not exists proposal_contributions_group_idx
on public.proposal_contributions (group_id, proposal_id, created_at);

alter table public.proposal_contributions enable row level security;

create policy "proposal_contributions_select_members"
on public.proposal_contributions for select
using (public.is_group_member(group_id));

create policy "proposal_contributions_insert_self"
on public.proposal_contributions for insert
with check (
  public.is_group_member(group_id)
  and user_id = auth.uid()
);

create policy "proposal_contributions_delete_self_or_group_admin"
on public.proposal_contributions for delete
using (
  user_id = auth.uid()
  or public.is_group_admin_or_owner(group_id)
);
