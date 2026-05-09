-- ─── postalpeek_scout_progress ────────────────────────────────────────────────
-- Ephemeral table that holds Explorer v2 progress events during scouting.
-- Rows are written by the cron-walker edge function and consumed by the
-- admin via Supabase Realtime. Auto-cleanup: rows expire after 2 hours.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists postalpeek_scout_progress (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null,
  type        text not null,  -- 'phase' | 'ring_point' | 'frame_captured' | 'ranked' | 'refinement' | 'done'
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '2 hours')
);

-- Index for fast session lookups
create index if not exists idx_scout_progress_session_id
  on postalpeek_scout_progress (session_id, created_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table postalpeek_scout_progress enable row level security;

-- Service role can do anything (edge functions)
create policy "service_role_all" on postalpeek_scout_progress
  for all to service_role using (true) with check (true);

-- Anon/authenticated can read (for Realtime subscriptions in the admin)
create policy "anon_read" on postalpeek_scout_progress
  for select to anon, authenticated using (true);

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable Realtime for INSERT notifications (Postgres publication)
alter publication supabase_realtime add table postalpeek_scout_progress;
