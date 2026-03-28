-- Sticker discovery system: tracks objects users find with the loupe
-- and stores the vectorized sticker images generated from those discoveries.

CREATE TABLE postalpeek_discoveries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  postcard_id uuid NOT NULL REFERENCES postalpeek_postcards(id) ON DELETE CASCADE,
  tag_label_en text NOT NULL,
  tag_type text NOT NULL,
  bbox int4[4] NOT NULL,
  sticker_url text,
  sticker_status text NOT NULL DEFAULT 'pending'
    CHECK (sticker_status IN ('pending', 'generating', 'done', 'failed')),
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, postcard_id, tag_label_en)
);

-- Index for fetching a user's inventory
CREATE INDEX idx_discoveries_user ON postalpeek_discoveries(user_id, discovered_at DESC);

-- RLS
ALTER TABLE postalpeek_discoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own discoveries"
  ON postalpeek_discoveries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own discoveries"
  ON postalpeek_discoveries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON postalpeek_discoveries FOR ALL
  USING (auth.role() = 'service_role');
