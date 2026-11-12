-- Guestbook: short notes anyone can leave. Server routes only (service role).
create table public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(btrim(author_name)) between 1 and 20),
  body text not null check (char_length(btrim(body)) between 1 and 300),
  color smallint not null default 0 check (color between 0 and 4),
  created_at timestamptz not null default now()
);
create index guestbook_entries_created_idx on public.guestbook_entries(created_at desc);
alter table public.guestbook_entries enable row level security;
