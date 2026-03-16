#!/bin/bash
# Seed a test album using existing postcards from the same country
# Usage: ./seed-album.sh [country]
# Default: uses the most common country in the DB

SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
COUNTRY="${1:-}"

psql "$SUPABASE_DB_URL" <<SQL
DO \$\$
DECLARE
  v_country TEXT;
  v_album_id UUID;
  v_postcard RECORD;
  v_slot_order INT := 1;
BEGIN
  -- Pick country
  IF '${COUNTRY}' != '' THEN
    v_country := '${COUNTRY}';
  ELSE
    SELECT country INTO v_country
    FROM postalpeek_postcards
    WHERE country IS NOT NULL
    GROUP BY country
    ORDER BY count(*) DESC
    LIMIT 1;
  END IF;

  RAISE NOTICE 'Creating album for country: %', v_country;

  -- Create album
  INSERT INTO postalpeek_albums (title, description, category, country, reward_claims)
  VALUES (
    'Postales de ' || v_country,
    'Coleccioná todas las postales que Walker encontró en ' || v_country,
    'country_collection',
    v_country,
    5
  ) RETURNING id INTO v_album_id;

  -- Add up to 8 postcards as slots
  FOR v_postcard IN
    SELECT id, COALESCE(city, category, 'Postal #' || row_number() OVER()) AS label
    FROM postalpeek_postcards
    WHERE country = v_country
    ORDER BY created_at DESC
    LIMIT 8
  LOOP
    INSERT INTO postalpeek_album_slots (album_id, postcard_id, slot_label, slot_order)
    VALUES (v_album_id, v_postcard.id, v_postcard.label, v_slot_order);
    v_slot_order := v_slot_order + 1;
  END LOOP;

  RAISE NOTICE 'Created album % with % slots', v_album_id, v_slot_order - 1;

  -- Set cover image from first slot
  UPDATE postalpeek_albums SET cover_image_url = (
    SELECT p.illustration_url
    FROM postalpeek_album_slots s
    JOIN postalpeek_postcards p ON p.id = s.postcard_id
    WHERE s.album_id = v_album_id AND p.illustration_url IS NOT NULL
    ORDER BY s.slot_order LIMIT 1
  ) WHERE id = v_album_id;
END;
\$\$;
SQL

echo "✅ Album seeded"
