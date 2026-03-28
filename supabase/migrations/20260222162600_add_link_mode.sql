-- Add mode column to briefing_links
-- 'collect' = client fills in from scratch (default)
-- 'pre-briefed' = brief already generated at link creation

alter table public.briefing_links
  add column if not exists mode text not null default 'collect';
