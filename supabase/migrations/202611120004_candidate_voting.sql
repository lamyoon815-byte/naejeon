alter table public.match_sessions add column voting_token text unique;
alter table public.match_sessions add column voting_enabled boolean not null default false;

create table public.match_candidate_options (
  id uuid primary key default gen_random_uuid(),
  match_session_id uuid not null references public.match_sessions(id) on delete cascade,
  option_index smallint not null check (option_index between 1 and 3),
  candidate jsonb not null,
  metrics jsonb not null,
  created_at timestamptz not null default now(),
  unique (match_session_id, option_index)
);

create table public.match_candidate_votes (
  id uuid primary key default gen_random_uuid(),
  match_session_id uuid not null references public.match_sessions(id) on delete cascade,
  option_id uuid not null references public.match_candidate_options(id) on delete cascade,
  voter_token uuid not null,
  created_at timestamptz not null default now(),
  unique (match_session_id, voter_token)
);
create index match_candidate_votes_option_idx on public.match_candidate_votes(option_id);

alter table public.match_candidate_options enable row level security;
alter table public.match_candidate_votes enable row level security;
revoke all on public.match_candidate_options, public.match_candidate_votes from anon, authenticated;
grant select, insert, update, delete on public.match_candidate_options, public.match_candidate_votes to authenticated;
create policy admins_all_candidate_options on public.match_candidate_options for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admins_all_candidate_votes on public.match_candidate_votes for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
