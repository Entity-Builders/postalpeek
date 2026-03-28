-- Business Directory: shared table for local businesses discovered across Entity Builders apps
-- Used for outreach (discount partnerships), discovery, and cross-app enrichment

CREATE TABLE IF NOT EXISTS eb_businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  business_type TEXT,
  google_types TEXT[],
  contact JSONB DEFAULT '{}',
  opening_hours JSONB,
  rating NUMERIC(2,1),
  price_level INT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  city TEXT,
  country TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  postcards_count INT DEFAULT 1,
  source TEXT DEFAULT 'postalpeek',   -- which app discovered it
  outreach_status TEXT DEFAULT 'new'
    CHECK (outreach_status IN ('new','contacted','partner','declined')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: service role only (backend-only data for now)
ALTER TABLE eb_businesses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'eb_businesses' AND policyname = 'Service role full access on businesses'
  ) THEN
    CREATE POLICY "Service role full access on businesses"
      ON eb_businesses
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Index for geo queries and outreach filtering
CREATE INDEX IF NOT EXISTS idx_eb_businesses_city_country ON eb_businesses(city, country);
CREATE INDEX IF NOT EXISTS idx_eb_businesses_outreach ON eb_businesses(outreach_status);
CREATE INDEX IF NOT EXISTS idx_eb_businesses_type ON eb_businesses(business_type);

-- Link postcards to nearby businesses
ALTER TABLE postalpeek_postcards
  ADD COLUMN IF NOT EXISTS nearby_business_id UUID REFERENCES eb_businesses(id);
