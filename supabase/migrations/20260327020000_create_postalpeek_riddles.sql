-- postalpeek_riddles: Game riddles for Find Objects mini-game.
-- Instead of showing "Find: curb", the game shows a bilingual riddle
-- that hints at the object without naming it.

CREATE TABLE IF NOT EXISTS public.postalpeek_riddles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    postcard_id uuid NOT NULL REFERENCES public.postalpeek_postcards(id) ON DELETE CASCADE,
    object_label text NOT NULL,          -- matches illustration_tag label (EN key)
    riddle      jsonb NOT NULL,          -- { "es": "Me pisan mil...", "en": "A thousand..." }
    difficulty  text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- One riddle per object per postcard
CREATE UNIQUE INDEX IF NOT EXISTS idx_riddles_postcard_label
    ON public.postalpeek_riddles(postcard_id, object_label);

-- Fast lookup by postcard
CREATE INDEX IF NOT EXISTS idx_riddles_postcard_id
    ON public.postalpeek_riddles(postcard_id);

-- RLS: public read, service-role write (edge functions insert)
ALTER TABLE public.postalpeek_riddles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on postalpeek_riddles"
    ON public.postalpeek_riddles
    FOR SELECT
    USING (true);
