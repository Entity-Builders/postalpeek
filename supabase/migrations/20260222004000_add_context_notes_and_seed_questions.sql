-- Add context notes and seed questions to briefing_links
-- context_notes: free-form text pasted by admin (WhatsApp, notes, etc.)
-- seed_questions: AI-generated questions array [{id, question, reason}]
alter table public.briefing_links
  add column context_notes text,
  add column seed_questions jsonb;
