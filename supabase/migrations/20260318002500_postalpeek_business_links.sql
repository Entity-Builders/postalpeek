-- Multi-business discovery: join table for postcard <-> business links
-- Replaces the single nearby_business_id FK with a many-to-many relationship

-- 1. Create join table
CREATE TABLE IF NOT EXISTS postalpeek_business_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES eb_businesses(id) NOT NULL,
  postcard_id UUID REFERENCES postalpeek_postcards(id) NOT NULL,
  prominence TEXT DEFAULT 'nearby'
    CHECK (prominence IN ('protagonist','featured','nearby')),
  distance_m INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, postcard_id)
);

ALTER TABLE postalpeek_business_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'postalpeek_business_links' AND policyname = 'Service role full access on business links'
  ) THEN
    CREATE POLICY "Service role full access on business links"
      ON postalpeek_business_links
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_biz_links_postcard ON postalpeek_business_links(postcard_id);
CREATE INDEX IF NOT EXISTS idx_biz_links_business ON postalpeek_business_links(business_id);
CREATE INDEX IF NOT EXISTS idx_biz_links_prominence ON postalpeek_business_links(prominence);

-- 2. Drop the old single FK (no longer needed)
ALTER TABLE postalpeek_postcards DROP COLUMN IF EXISTS nearby_business_id;
