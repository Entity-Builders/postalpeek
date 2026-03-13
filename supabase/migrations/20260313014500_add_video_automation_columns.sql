CREATE TYPE public.video_generation_status_enum AS ENUM ('idle', 'processing', 'completed', 'failed');

ALTER TABLE public.postalpeek_postcards
ADD COLUMN video_generation_status public.video_generation_status_enum DEFAULT 'idle',
ADD COLUMN imagine_task_id text,
ADD COLUMN should_animate boolean DEFAULT false;
