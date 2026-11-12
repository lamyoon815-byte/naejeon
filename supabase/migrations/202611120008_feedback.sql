-- Free-text feedback from anyone (e.g. "세훈이랑 동완 바꾸는 게 맞음").
-- Written and read only through server routes using the service role;
-- no direct table access for anonymous or signed-in clients.
create table public.feedback_comments (
  id uuid primary key default gen_random_uuid(),
  match_session_id uuid references public.match_sessions(id) on delete set null,
  author_name text check (author_name is null or char_length(btrim(author_name)) between 1 and 20),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index feedback_comments_match_idx on public.feedback_comments(match_session_id, created_at desc);
create index feedback_comments_created_idx on public.feedback_comments(created_at desc);

alter table public.feedback_comments enable row level security;
