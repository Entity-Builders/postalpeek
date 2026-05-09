-- Add category and generation_metadata columns to postalpeek_user_postcards
-- category: stores the AI-assigned category (e.g., "🏛️ Ancient Ruins")
-- generation_metadata: stores enriched data (storytelling, stats, trivia)

ALTER TABLE postalpeek_user_postcards
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS generation_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common';
