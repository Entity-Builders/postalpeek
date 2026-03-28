-- Migration: Add Chat History to Diagnosis Logs

ALTER TABLE public.potlink_diagnosis_logs 
  ADD COLUMN chat_history jsonb not null default '[]'::jsonb;
