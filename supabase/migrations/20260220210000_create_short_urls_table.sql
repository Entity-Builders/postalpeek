-- Create short_urls table for Shrinkle URL shortener
CREATE TABLE short_urls (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_url TEXT NOT NULL,
    short_code   TEXT NOT NULL UNIQUE,
    clicks       INT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by short_code
CREATE INDEX idx_short_urls_short_code ON short_urls (short_code);

-- RLS policies
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;

-- Anyone can create short URLs (anon users)
CREATE POLICY "Anyone can create short URLs"
    ON short_urls FOR INSERT TO anon WITH CHECK (true);

-- Anyone can read short URLs (needed for resolve/redirect)
CREATE POLICY "Anyone can read short URLs"
    ON short_urls FOR SELECT TO anon USING (true);

-- Service role can update clicks (used by Edge Function)
CREATE POLICY "Service role can update short URLs"
    ON short_urls FOR UPDATE TO service_role USING (true);
