-- Migration: Support for 2 images in Potlink diagnosis

ALTER TABLE public.potlink_diagnosis_logs 
  RENAME COLUMN image_url TO general_image_url;

ALTER TABLE public.potlink_diagnosis_logs 
  ADD COLUMN soil_image_url text;
