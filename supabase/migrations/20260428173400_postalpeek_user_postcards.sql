-- PostalPeek Viewfinder MVP: User-created postcards
-- Users can create their own postcards from the Viewfinder at existing system postcard locations.
-- ref #94

-- User-created postcards from the Viewfinder
CREATE TABLE postalpeek_user_postcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Source: which system postcard inspired this
  source_postcard_id UUID REFERENCES postalpeek_postcards(id),
  -- Location
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  city TEXT,
  country TEXT,
  location_name TEXT,
  -- Camera POV the user chose
  heading DOUBLE PRECISION NOT NULL,
  pitch DOUBLE PRECISION NOT NULL,
  fov DOUBLE PRECISION NOT NULL DEFAULT 90,
  -- Generated assets
  original_image_url TEXT NOT NULL,     -- Street View static capture
  illustration_url TEXT,                -- AI-generated illustration
  illustration_style TEXT DEFAULT 'default',
  -- Metadata
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'published',      -- 'draft' | 'published'
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_postcards_user ON postalpeek_user_postcards(user_id);
CREATE INDEX idx_user_postcards_source ON postalpeek_user_postcards(source_postcard_id);
CREATE INDEX idx_user_postcards_location ON postalpeek_user_postcards
  USING gist (point(lng, lat));
CREATE INDEX idx_user_postcards_created ON postalpeek_user_postcards(created_at DESC);

-- RLS
ALTER TABLE postalpeek_user_postcards ENABLE ROW LEVEL SECURITY;

-- Everyone can read public postcards
CREATE POLICY "user_postcards_read_public" ON postalpeek_user_postcards
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- Owner can insert
CREATE POLICY "user_postcards_insert" ON postalpeek_user_postcards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Owner can update their own
CREATE POLICY "user_postcards_update" ON postalpeek_user_postcards
  FOR UPDATE USING (auth.uid() = user_id);

-- Owner can delete their own
CREATE POLICY "user_postcards_delete" ON postalpeek_user_postcards
  FOR DELETE USING (auth.uid() = user_id);
