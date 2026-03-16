#!/bin/bash
# Seed test albums with dynamic match_rules
# Usage: ./seed-album.sh
# Creates several albums with different difficulties

SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

psql "$SUPABASE_DB_URL" <<SQL
DO \$\$
DECLARE
  v_album_id UUID;
  v_country TEXT;
  v_postcard RECORD;
  v_slot_order INT;
BEGIN
  -- Pick most common country
  SELECT country INTO v_country
  FROM postalpeek_postcards
  WHERE country IS NOT NULL
  GROUP BY country
  ORDER BY count(*) DESC
  LIMIT 1;

  RAISE NOTICE 'Using country: %', v_country;

  -- ============================
  -- ALBUM 1: Easy — Country collection
  -- ============================
  INSERT INTO postalpeek_albums (title, description, category, country, difficulty, reward_claims, match_rules)
  VALUES (
    'Postales de ' || v_country,
    'Coleccioná todas las postales de ' || v_country,
    'country_collection',
    v_country,
    'easy',
    3,
    jsonb_build_object('country', v_country)
  ) RETURNING id INTO v_album_id;

  -- Add up to 8 postcards as slots
  v_slot_order := 1;
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

  UPDATE postalpeek_albums SET cover_image_url = (
    SELECT p.illustration_url
    FROM postalpeek_album_slots s
    JOIN postalpeek_postcards p ON p.id = s.postcard_id
    WHERE s.album_id = v_album_id AND p.illustration_url IS NOT NULL
    ORDER BY s.slot_order LIMIT 1
  ) WHERE id = v_album_id;

  RAISE NOTICE 'Created EASY album: Postales de % (%)', v_country, v_album_id;

  -- ============================
  -- ALBUM 2: Hard — Colectivos (dynamic, tag-based)
  -- ============================
  INSERT INTO postalpeek_albums (title, description, category, country, city, difficulty, reward_claims, match_rules)
  VALUES (
    'Colectivos de Buenos Aires',
    'Encontrá todas las postales donde aparezca un colectivo en Buenos Aires. ¡Son difíciles de conseguir!',
    'urban_transport',
    v_country,
    'Buenos Aires',
    'hard',
    10,
    '{"city": "Buenos Aires", "required_tags": ["colectivo"], "any_tags": ["bus", "transport"]}'::jsonb
  ) RETURNING id INTO v_album_id;

  RAISE NOTICE 'Created HARD album: Colectivos de Buenos Aires (%)', v_album_id;

  -- ============================
  -- ALBUM 3: Medium — Monuments
  -- ============================
  INSERT INTO postalpeek_albums (title, description, category, country, difficulty, reward_claims, match_rules)
  VALUES (
    'Monumentos de ' || v_country,
    'Descubrí los monumentos y esculturas más impresionantes del país',
    'monuments',
    v_country,
    'medium',
    5,
    jsonb_build_object('country', v_country, 'any_tags', '["monument", "statue", "sculpture", "obelisco", "memorial"]'::jsonb)
  ) RETURNING id INTO v_album_id;

  RAISE NOTICE 'Created MEDIUM album: Monumentos de % (%)', v_country, v_album_id;

  -- ============================
  -- ALBUM 4: Epic — Pizzerías de La Boca
  -- ============================
  INSERT INTO postalpeek_albums (title, description, category, country, city, difficulty, reward_claims, match_rules)
  VALUES (
    'Pizzerías de La Boca',
    'El desafío más difícil: encontrá pizzerías en el mítico barrio de La Boca',
    'gastronomic',
    v_country,
    'Buenos Aires',
    'epic',
    25,
    '{"city": "Buenos Aires", "required_tags": ["pizza", "restaurant", "la_boca"]}'::jsonb
  ) RETURNING id INTO v_album_id;

  RAISE NOTICE 'Created EPIC album: Pizzerías de La Boca (%)', v_album_id;

END;
\$\$;
SQL

echo "✅ Albums seeded (easy, medium, hard, epic)"
