-- Visitors without an account may create, generate and confirm matches.
-- Those requests go through server routes that use the service role, so the
-- session has no creator and the confirm RPC must accept the service role.
alter table public.match_sessions alter column created_by drop not null;

create or replace function public.confirm_match_assignment(
  p_session_id uuid,
  p_assignments jsonb,
  p_metrics jsonb,
  p_scoring_config jsonb,
  p_publish boolean default false,
  p_share_token text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Admins, or the server itself (service role) acting for a public visitor.
  if not (select private.is_admin()) and coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  if jsonb_array_length(p_assignments) <> 10 then raise exception 'exactly 10 assignments required'; end if;
  delete from public.team_assignments where match_session_id = p_session_id;
  insert into public.team_assignments (
    match_session_id, player_id, team, assigned_role, role_strength, role_proficiency,
    player_name_snapshot, nickname_snapshot, tagline_snapshot,
    rank_tier_snapshot, rank_division_snapshot, custom_skill_snapshot
  )
  select p_session_id, (x->>'playerId')::uuid, x->>'team', x->>'role',
    (x->>'roleStrength')::numeric, (x->>'roleProficiency')::smallint,
    x->>'name', nullif(x->>'nickname',''), nullif(x->>'tagline',''),
    x->>'rankTier', nullif(x->>'rankDivision',''), (x->>'customSkill')::numeric
  from jsonb_array_elements(p_assignments) x;
  insert into public.match_assignment_snapshots(match_session_id, metrics, scoring_config)
  values (p_session_id, p_metrics, p_scoring_config)
  on conflict (match_session_id) do update set metrics = excluded.metrics, scoring_config = excluded.scoring_config, created_at = now();
  update public.match_sessions set status = 'CONFIRMED', share_enabled = p_publish,
    share_token = case when p_publish then p_share_token else share_token end,
    published_at = case when p_publish then now() else published_at end
  where id = p_session_id;
end $$;

grant execute on function public.confirm_match_assignment(uuid,jsonb,jsonb,jsonb,boolean,text) to service_role;
