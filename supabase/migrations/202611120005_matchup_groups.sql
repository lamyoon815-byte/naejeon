-- Players who should be laned against each other whenever two or more of them
-- join the same match (e.g. a group of similarly-skilled newer players).
create table public.player_matchup_groups (
  group_name text not null check (char_length(btrim(group_name)) between 1 and 30),
  player_id uuid not null references public.players(id) on delete cascade,
  primary key (group_name, player_id)
);
create index player_matchup_groups_player_idx on public.player_matchup_groups(player_id);

alter table public.player_matchup_groups enable row level security;
grant select, insert, update, delete on public.player_matchup_groups to authenticated;
create policy admins_all_matchup_groups on public.player_matchup_groups
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
