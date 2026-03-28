-- Add client-facing summary to briefing_links
-- This is the AI-curated summary shown to clients, NOT the raw context notes

alter table public.briefing_links
  add column if not exists client_summary text;
