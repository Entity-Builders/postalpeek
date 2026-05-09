ALTER TABLE postalpeek_postcards
ADD COLUMN ig_media_id TEXT UNIQUE,
ADD COLUMN ig_published_at TIMESTAMPTZ;
