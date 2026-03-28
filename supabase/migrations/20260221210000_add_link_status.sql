-- Add status column to briefing_links
-- Values: 'pending' (default) | 'completed'
alter table public.briefing_links
  add column status text not null default 'pending';

-- Backfill: mark links that already have a briefing as completed
update public.briefing_links
  set status = 'completed'
  where id in (select distinct link_id from public.briefings);
