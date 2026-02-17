-- mtUp Supabase bootstrap schema (group-aware from day one)
-- Date: 2026-02-17
-- Notes:
-- - This schema is designed for one active group initially, without blocking future multi-group expansion.
-- - UUID generation requires pgcrypto in Supabase (enabled by default).

create extension if not exists pgcrypto;

-- Profiles mirror auth users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Isolated collaboration units
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Membership + role per group
create table if not exists public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  type text not null check (type in ('event', 'sejour')),
  emoji text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  status text not null check (status in ('proposed', 'scheduled', 'confirmed')),
  specifics_json jsonb
);

create table if not exists public.availabilities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  dates_json jsonb not null default '[]'::jsonb,
  time_slots_json jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, proposal_id)
);

create table if not exists public.decision_configs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  dimension text not null check (dimension in ('time', 'place', 'requirement')),
  mode text not null check (mode in ('single', 'multi', 'ranked')),
  status text not null check (status in ('open', 'pending_confirmation', 'confirmed')),
  unique (proposal_id, dimension)
);

create table if not exists public.decision_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  dimension text not null check (dimension in ('time', 'place', 'requirement')),
  label text not null,
  metadata_json jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_votes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  dimension text not null check (dimension in ('time', 'place', 'requirement')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ranked_option_ids_json jsonb,
  selected_option_ids_json jsonb,
  updated_at timestamptz not null default now(),
  unique (proposal_id, dimension, user_id)
);

create table if not exists public.decision_confirmations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  dimension text not null check (dimension in ('time', 'place', 'requirement')),
  option_ids_json jsonb not null default '[]'::jsonb,
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  note text
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- Helper function for policies
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin_or_owner(target_group_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role in ('owner', 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.proposals enable row level security;
alter table public.availabilities enable row level security;
alter table public.decision_configs enable row level security;
alter table public.decision_options enable row level security;
alter table public.decision_votes enable row level security;
alter table public.decision_confirmations enable row level security;
alter table public.comments enable row level security;

-- profiles
create policy "profiles_select_self"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_insert_self"
on public.profiles for insert
with check (id = auth.uid());

create policy "profiles_update_self"
on public.profiles for update
using (id = auth.uid());

-- groups
create policy "groups_select_members"
on public.groups for select
using (public.is_group_member(id));

create policy "groups_insert_authenticated"
on public.groups for insert
with check (auth.uid() = created_by);

create policy "groups_update_admin_or_owner"
on public.groups for update
using (public.is_group_admin_or_owner(id));

-- group_memberships
create policy "memberships_select_self"
on public.group_memberships for select
using (user_id = auth.uid());

-- proposals
create policy "proposals_select_members"
on public.proposals for select
using (public.is_group_member(group_id));

create policy "proposals_insert_members"
on public.proposals for insert
with check (
  public.is_group_member(group_id)
  and created_by = auth.uid()
);

create policy "proposals_update_creator_or_group_admin"
on public.proposals for update
using (
  created_by = auth.uid()
  or public.is_group_admin_or_owner(group_id)
);

create policy "proposals_delete_creator_or_group_admin"
on public.proposals for delete
using (
  created_by = auth.uid()
  or public.is_group_admin_or_owner(group_id)
);

-- availabilities
create policy "availabilities_select_members"
on public.availabilities for select
using (public.is_group_member(group_id));

create policy "availabilities_insert_self"
on public.availabilities for insert
with check (
  public.is_group_member(group_id)
  and user_id = auth.uid()
);

create policy "availabilities_update_self"
on public.availabilities for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "availabilities_delete_self"
on public.availabilities for delete
using (user_id = auth.uid());

-- decision configs
create policy "decision_configs_select_members"
on public.decision_configs for select
using (public.is_group_member(group_id));

create policy "decision_configs_manage_group_admin"
on public.decision_configs for all
using (public.is_group_admin_or_owner(group_id))
with check (public.is_group_admin_or_owner(group_id));

-- decision options
create policy "decision_options_select_members"
on public.decision_options for select
using (public.is_group_member(group_id));

create policy "decision_options_insert_members"
on public.decision_options for insert
with check (
  public.is_group_member(group_id)
  and created_by = auth.uid()
);

create policy "decision_options_delete_creator_or_admin"
on public.decision_options for delete
using (
  created_by = auth.uid()
  or public.is_group_admin_or_owner(group_id)
);

-- decision votes
create policy "decision_votes_select_members"
on public.decision_votes for select
using (public.is_group_member(group_id));

create policy "decision_votes_insert_self"
on public.decision_votes for insert
with check (
  public.is_group_member(group_id)
  and user_id = auth.uid()
);

create policy "decision_votes_update_self"
on public.decision_votes for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "decision_votes_delete_self"
on public.decision_votes for delete
using (user_id = auth.uid());

-- decision confirmations
create policy "decision_confirmations_select_members"
on public.decision_confirmations for select
using (public.is_group_member(group_id));

create policy "decision_confirmations_insert_creator_or_admin"
on public.decision_confirmations for insert
with check (
  public.is_group_member(group_id)
  and confirmed_by = auth.uid()
);

-- comments
create policy "comments_select_members"
on public.comments for select
using (public.is_group_member(group_id));

create policy "comments_insert_self"
on public.comments for insert
with check (
  public.is_group_member(group_id)
  and user_id = auth.uid()
);

create policy "comments_update_self"
on public.comments for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "comments_delete_self_or_group_admin"
on public.comments for delete
using (
  user_id = auth.uid()
  or public.is_group_admin_or_owner(group_id)
);
