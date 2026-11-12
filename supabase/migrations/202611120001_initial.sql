create extension if not exists pgcrypto;
create schema if not exists private;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(btrim(nickname)) between 1 and 30),
  rank_tier text not null check (rank_tier in ('UNRANKED','IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER')),
  rank_division text check (rank_division in ('I','II','III','IV')),
  rank_lp integer check (rank_lp between 0 and 5000),
  custom_skill numeric(5,2) not null check (custom_skill between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_rank_shape check (
    (rank_tier in ('UNRANKED','MASTER','GRANDMASTER','CHALLENGER') and rank_division is null)
    or (rank_tier not in ('UNRANKED','MASTER','GRANDMASTER','CHALLENGER') and rank_division is not null)
  ),
  constraint unranked_has_no_lp check (rank_tier <> 'UNRANKED' or rank_lp is null)
);
create unique index players_nickname_ci_unique on public.players (lower(btrim(nickname)));
create index players_active_nickname_idx on public.players (is_active, nickname);

create table public.player_role_skills (
  player_id uuid primary key references public.players(id) on delete cascade,
  top smallint not null check (top between 0 and 5),
  jungle smallint not null check (jungle between 0 and 5),
  mid smallint not null check (mid between 0 and 5),
  adc smallint not null check (adc between 0 and 5),
  support smallint not null check (support between 0 and 5),
  constraint at_least_one_playable_role check (greatest(top, jungle, mid, adc, support) > 0)
);

create table public.player_separation_rules (
  id uuid primary key default gen_random_uuid(),
  player_a_id uuid not null references public.players(id) on delete cascade,
  player_b_id uuid not null references public.players(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint separation_distinct_players check (player_a_id <> player_b_id),
  constraint separation_canonical_order check (player_a_id < player_b_id),
  unique (player_a_id, player_b_id)
);
create index separation_a_idx on public.player_separation_rules(player_a_id) where is_active;
create index separation_b_idx on public.player_separation_rules(player_b_id) where is_active;

create table public.match_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  status text not null default 'DRAFT' check (status in ('DRAFT','GENERATED','CONFIRMED','ARCHIVED')),
  share_token text unique,
  share_enabled boolean not null default false,
  published_at timestamptz
);

create table public.match_participants (
  match_session_id uuid not null references public.match_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id),
  selection_order smallint not null check (selection_order between 1 and 10),
  primary key (match_session_id, player_id),
  unique (match_session_id, selection_order)
);

create table public.match_assignment_snapshots (
  match_session_id uuid primary key references public.match_sessions(id) on delete cascade,
  metrics jsonb not null,
  scoring_config jsonb not null,
  created_at timestamptz not null default now()
);

create table public.team_assignments (
  match_session_id uuid not null references public.match_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id),
  team text not null check (team in ('BLUE','RED')),
  assigned_role text not null check (assigned_role in ('TOP','JUNGLE','MID','ADC','SUPPORT')),
  role_strength numeric(6,2) not null,
  role_proficiency smallint not null check (role_proficiency between 1 and 5),
  nickname_snapshot text not null,
  rank_tier_snapshot text not null,
  rank_division_snapshot text,
  custom_skill_snapshot numeric(5,2) not null,
  primary key (match_session_id, player_id),
  unique (match_session_id, team, assigned_role)
);

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger players_touch_updated_at before update on public.players
for each row execute function private.touch_updated_at();

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.players enable row level security;
alter table public.player_role_skills enable row level security;
alter table public.player_separation_rules enable row level security;
alter table public.match_sessions enable row level security;
alter table public.match_participants enable row level security;
alter table public.match_assignment_snapshots enable row level security;
alter table public.team_assignments enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.players, public.player_role_skills, public.player_separation_rules, public.match_sessions, public.match_participants, public.match_assignment_snapshots, public.team_assignments to authenticated;

create policy admin_users_read_self on public.admin_users for select to authenticated using (user_id = (select auth.uid()));

create policy admins_select_players on public.players for select to authenticated using ((select private.is_admin()));
create policy admins_insert_players on public.players for insert to authenticated with check ((select private.is_admin()));
create policy admins_update_players on public.players for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admins_delete_players on public.players for delete to authenticated using ((select private.is_admin()));

create policy admins_select_role_skills on public.player_role_skills for select to authenticated using ((select private.is_admin()));
create policy admins_insert_role_skills on public.player_role_skills for insert to authenticated with check ((select private.is_admin()));
create policy admins_update_role_skills on public.player_role_skills for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admins_delete_role_skills on public.player_role_skills for delete to authenticated using ((select private.is_admin()));

create policy admins_select_separation on public.player_separation_rules for select to authenticated using ((select private.is_admin()));
create policy admins_insert_separation on public.player_separation_rules for insert to authenticated with check ((select private.is_admin()));
create policy admins_update_separation on public.player_separation_rules for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admins_delete_separation on public.player_separation_rules for delete to authenticated using ((select private.is_admin()));

create policy admins_all_matches on public.match_sessions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admins_all_participants on public.match_participants for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admins_all_snapshots on public.match_assignment_snapshots for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admins_all_assignments on public.team_assignments for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function public.confirm_match_assignment(
  p_session_id uuid,
  p_assignments jsonb,
  p_metrics jsonb,
  p_scoring_config jsonb,
  p_publish boolean default false,
  p_share_token text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then raise exception 'forbidden'; end if;
  if jsonb_array_length(p_assignments) <> 10 then raise exception 'exactly 10 assignments required'; end if;
  delete from public.team_assignments where match_session_id = p_session_id;
  insert into public.team_assignments (
    match_session_id, player_id, team, assigned_role, role_strength, role_proficiency,
    nickname_snapshot, rank_tier_snapshot, rank_division_snapshot, custom_skill_snapshot
  )
  select p_session_id, (x->>'playerId')::uuid, x->>'team', x->>'role',
    (x->>'roleStrength')::numeric, (x->>'roleProficiency')::smallint,
    x->>'nickname', x->>'rankTier', nullif(x->>'rankDivision',''), (x->>'customSkill')::numeric
  from jsonb_array_elements(p_assignments) x;
  insert into public.match_assignment_snapshots(match_session_id, metrics, scoring_config)
  values (p_session_id, p_metrics, p_scoring_config)
  on conflict (match_session_id) do update set metrics = excluded.metrics, scoring_config = excluded.scoring_config, created_at = now();
  update public.match_sessions set status = 'CONFIRMED', share_enabled = p_publish,
    share_token = case when p_publish then p_share_token else share_token end,
    published_at = case when p_publish then now() else published_at end
  where id = p_session_id;
end $$;
revoke all on function public.confirm_match_assignment(uuid,jsonb,jsonb,jsonb,boolean,text) from public;
grant execute on function public.confirm_match_assignment(uuid,jsonb,jsonb,jsonb,boolean,text) to authenticated;

