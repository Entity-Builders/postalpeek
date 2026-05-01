-- ============================================================================
-- PostalPeek: "World Wonders" MVP Album
-- Seed a curated album with 10 iconic city landmarks for the Globe Explorer
-- ============================================================================

-- 1. Insert the album (fixed UUID for frontend reference)
INSERT INTO postalpeek_albums (id, title, description, category, reward_claims, target_slots, is_active)
VALUES (
  '11111111-aaaa-4000-a000-000000000001',
  '{"en": "World Wonders", "es": "Maravillas del Mundo"}',
  '{"en": "Discover 10 iconic landmarks around the globe", "es": "Descubre 10 monumentos icónicos alrededor del mundo"}',
  'landmarks',
  10,
  10,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 2. Link 10 real postcards as album slots (one per iconic city)
-- Uses DISTINCT ON to pick exactly one postcard per city
INSERT INTO postalpeek_album_slots (album_id, postcard_id, slot_label, slot_order)
SELECT
  '11111111-aaaa-4000-a000-000000000001',
  sub.id,
  sub.label,
  sub.rn::int
FROM (
  SELECT DISTINCT ON (p.city)
    p.id,
    p.city,
    p.country,
    CASE p.city
      WHEN 'Paris' THEN '🗼 Eiffel Tower'
      WHEN 'New York' THEN '🗽 Statue of Liberty'
      WHEN 'Rome' THEN '🏛️ Colosseum'
      WHEN 'London' THEN '🏰 Tower Bridge'
      WHEN 'Buenos Aires' THEN '🎭 Obelisco'
      WHEN 'Rio de Janeiro' THEN '🗻 Cristo Redentor'
      WHEN 'Barcelona' THEN '⛪ Sagrada Familia'
      WHEN 'Mexico City' THEN '🏛️ Palacio de Bellas Artes'
      WHEN 'Cape Town' THEN '⛰️ Table Mountain'
      WHEN 'Prague' THEN '🏰 Charles Bridge'
    END AS label,
    row_number() OVER (ORDER BY
      CASE p.city
        WHEN 'Paris' THEN 1
        WHEN 'New York' THEN 2
        WHEN 'Rome' THEN 3
        WHEN 'London' THEN 4
        WHEN 'Buenos Aires' THEN 5
        WHEN 'Rio de Janeiro' THEN 6
        WHEN 'Barcelona' THEN 7
        WHEN 'Mexico City' THEN 8
        WHEN 'Cape Town' THEN 9
        WHEN 'Prague' THEN 10
      END
    ) AS rn
  FROM postalpeek_postcards p
  WHERE p.illustration_url IS NOT NULL
    AND p.lat IS NOT NULL
    AND p.city IN (
      'Paris', 'New York', 'Rome', 'London', 'Buenos Aires',
      'Rio de Janeiro', 'Barcelona', 'Mexico City', 'Cape Town', 'Prague'
    )
  ORDER BY p.city, p.created_at DESC
) sub
ON CONFLICT (album_id, slot_order) DO UPDATE SET
  postcard_id = EXCLUDED.postcard_id,
  slot_label = EXCLUDED.slot_label;
