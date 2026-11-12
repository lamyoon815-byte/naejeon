-- Organizer-set lane strength for one player on one role, replacing the
-- tier × role-rank estimate (e.g. a one-trick whose main lane is far above
-- what their tier suggests). Admin-only; never sent to public visitors.
create table public.player_role_overrides (
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null check (role in ('TOP','JUNGLE','MID','ADC','SUPPORT')),
  strength numeric(5,2) not null check (strength between 0 and 100),
  note text check (note is null or char_length(note) <= 200),
  primary key (player_id, role)
);

alter table public.player_role_overrides enable row level security;
grant select, insert, update, delete on public.player_role_overrides to authenticated;
create policy admins_all_role_overrides on public.player_role_overrides
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
