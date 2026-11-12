-- Snapshot of the lineup the commenter was looking at:
-- [{ "role": "TOP", "blue": "이름", "red": "이름" }, ...]
alter table public.feedback_comments add column lineup jsonb
  check (lineup is null or (jsonb_typeof(lineup) = 'array' and jsonb_array_length(lineup) <= 5));
