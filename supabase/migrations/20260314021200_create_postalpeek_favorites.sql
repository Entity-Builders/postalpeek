-- PostalPeek Favorites: stores which postcards a user has favorited
CREATE TABLE public.postalpeek_favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  postcard_id UUID NOT NULL REFERENCES public.postalpeek_postcards(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, postcard_id)
);

ALTER TABLE public.postalpeek_favorites ENABLE ROW LEVEL SECURITY;

-- Users can only see their own favorites
CREATE POLICY "Users read own favorites"
  ON public.postalpeek_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users insert own favorites"
  ON public.postalpeek_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users delete own favorites"
  ON public.postalpeek_favorites FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX postalpeek_favorites_user_idx ON public.postalpeek_favorites (user_id);
