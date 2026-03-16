-- PostalPeek Collectibles Phase 2: Albums & Challenges

-- 1. Albums table
CREATE TABLE IF NOT EXISTS postalpeek_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  category TEXT NOT NULL,
  country TEXT,
  city TEXT,
  reward_claims INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- 2. Album slots
CREATE TABLE IF NOT EXISTS postalpeek_album_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES postalpeek_albums(id) ON DELETE CASCADE,
  postcard_id UUID REFERENCES postalpeek_postcards(id),
  slot_label TEXT NOT NULL,
  slot_order INT NOT NULL,
  UNIQUE (album_id, slot_order)
);

-- 3. Album progress
CREATE TABLE IF NOT EXISTS postalpeek_album_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id UUID REFERENCES postalpeek_albums(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, album_id)
);

-- RLS
ALTER TABLE postalpeek_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE postalpeek_album_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE postalpeek_album_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Albums are public" ON postalpeek_albums FOR SELECT USING (true);
CREATE POLICY "Slots are public" ON postalpeek_album_slots FOR SELECT USING (true);
CREATE POLICY "Users read own album progress" ON postalpeek_album_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own album progress" ON postalpeek_album_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own album progress" ON postalpeek_album_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS postalpeek_album_slots_album_idx ON postalpeek_album_slots (album_id);
CREATE INDEX IF NOT EXISTS postalpeek_album_slots_postcard_idx ON postalpeek_album_slots (postcard_id);

-- 4. RPC: Get all albums with user progress
CREATE OR REPLACE FUNCTION postalpeek_get_albums_with_progress()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(jsonb_agg(album_row ORDER BY created_at DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', a.id, 'title', a.title, 'description', a.description,
      'cover_image_url', a.cover_image_url, 'category', a.category,
      'country', a.country, 'city', a.city, 'reward_claims', a.reward_claims,
      'total_slots', (SELECT count(*) FROM postalpeek_album_slots WHERE album_id = a.id),
      'collected_slots', (
        SELECT count(*) FROM postalpeek_album_slots s
        JOIN postalpeek_postcards p ON p.id = s.postcard_id
        WHERE s.album_id = a.id AND p.owner_id = auth.uid()
      ),
      'completed_at', ap.completed_at
    ) AS album_row, a.created_at
    FROM postalpeek_albums a
    LEFT JOIN postalpeek_album_progress ap ON ap.album_id = a.id AND ap.user_id = auth.uid()
    WHERE a.is_active = true
  ) sub;
$$;

-- 5. RPC: Get album detail with per-slot ownership
CREATE OR REPLACE FUNCTION postalpeek_get_album_detail(p_album_id UUID)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'album', jsonb_build_object(
      'id', a.id, 'title', a.title, 'description', a.description,
      'cover_image_url', a.cover_image_url, 'category', a.category,
      'country', a.country, 'city', a.city, 'reward_claims', a.reward_claims
    ),
    'slots', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'slot_label', s.slot_label, 'slot_order', s.slot_order,
        'postcard_id', s.postcard_id,
        'illustration_url', p.illustration_url,
        'city', p.city, 'country', p.country, 'category', p.category,
        'is_owned', (p.owner_id = auth.uid()),
        'is_claimed', (p.owner_id IS NOT NULL)
      ) ORDER BY s.slot_order), '[]'::jsonb)
      FROM postalpeek_album_slots s
      LEFT JOIN postalpeek_postcards p ON p.id = s.postcard_id
      WHERE s.album_id = a.id
    ),
    'completed_at', ap.completed_at
  )
  FROM postalpeek_albums a
  LEFT JOIN postalpeek_album_progress ap ON ap.album_id = a.id AND ap.user_id = auth.uid()
  WHERE a.id = p_album_id;
$$;
