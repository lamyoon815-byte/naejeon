-- Make a person's real/display name the primary identity while retaining an
-- optional League summoner nickname as secondary information.
alter table public.players add column name text;
update public.players set name = nickname;
alter table public.players alter column name set not null;
alter table public.players add constraint players_name_length
  check (char_length(btrim(name)) between 1 and 30);
alter table public.players alter column nickname drop not null;

drop index if exists public.players_nickname_ci_unique;
create unique index players_nickname_ci_unique
  on public.players (lower(btrim(nickname))) where nickname is not null;
create index players_active_name_idx on public.players (is_active, name);

alter table public.team_assignments add column player_name_snapshot text;
update public.team_assignments set player_name_snapshot = nickname_snapshot;
alter table public.team_assignments alter column player_name_snapshot set not null;
alter table public.team_assignments alter column nickname_snapshot drop not null;

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
    player_name_snapshot, nickname_snapshot, rank_tier_snapshot, rank_division_snapshot, custom_skill_snapshot
  )
  select p_session_id, (x->>'playerId')::uuid, x->>'team', x->>'role',
    (x->>'roleStrength')::numeric, (x->>'roleProficiency')::smallint,
    x->>'name', nullif(x->>'nickname',''), x->>'rankTier', nullif(x->>'rankDivision',''), (x->>'customSkill')::numeric
  from jsonb_array_elements(p_assignments) x;
  insert into public.match_assignment_snapshots(match_session_id, metrics, scoring_config)
  values (p_session_id, p_metrics, p_scoring_config)
  on conflict (match_session_id) do update set metrics = excluded.metrics, scoring_config = excluded.scoring_config, created_at = now();
  update public.match_sessions set status = 'CONFIRMED', share_enabled = p_publish,
    share_token = case when p_publish then p_share_token else share_token end,
    published_at = case when p_publish then now() else published_at end
  where id = p_session_id;
end $$;
