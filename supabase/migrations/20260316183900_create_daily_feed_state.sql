-- Create daily feed state table
CREATE TABLE IF NOT EXISTS public.postalpeek_daily_feed_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_pack UUID[] NOT NULL DEFAULT '{}',
  last_refill_at TIMESTAMPTZ DEFAULT now(),
  extra_refills_available INT DEFAULT 0
);

ALTER TABLE public.postalpeek_daily_feed_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feed state"
  ON public.postalpeek_daily_feed_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own feed state"
  ON public.postalpeek_daily_feed_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feed state"
  ON public.postalpeek_daily_feed_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RPC to get or generate the daily pack
CREATE OR REPLACE FUNCTION public.postalpeek_get_daily_pack(
  p_limit INT DEFAULT 15,
  p_country TEXT DEFAULT NULL
)
RETURNS SETOF public.postalpeek_postcards
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_state public.postalpeek_daily_feed_state;
  v_new_pack UUID[];
  v_needs_refill BOOLEAN := FALSE;
  v_album_ids UUID[];
  v_remaining_limit INT;
BEGIN
  -- 1. Check if user is logged in
  IF v_user_id IS NULL THEN
    -- For guests, just return a random pack of 5 based on the region
    RETURN QUERY
    SELECT *
    FROM public.postalpeek_postcards
    WHERE (p_country IS NULL OR country = p_country)
      AND illustration_url IS NOT NULL
      AND (trip_id IS NULL OR EXISTS (
        SELECT 1 FROM public.postalpeek_trips t
        WHERE t.id = trip_id AND t.status = 'completed'
      ))
    ORDER BY random()
    LIMIT 5;
    RETURN;
  END IF;

  -- 2. Get user's current feed state
  SELECT * INTO v_state FROM public.postalpeek_daily_feed_state WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    v_needs_refill := TRUE;
  ELSIF array_length(v_state.active_pack, 1) > 0 THEN
    -- Has active pack, return it
    RETURN QUERY
    SELECT p.* FROM public.postalpeek_postcards p
    JOIN unnest(v_state.active_pack) WITH ORDINALITY t(id, ord) USING (id)
    ORDER BY t.ord;
    RETURN;
  ELSIF v_state.last_refill_at < now() - interval '24 hours' OR v_state.extra_refills_available > 0 THEN
    v_needs_refill := TRUE;
  END IF;

  -- 3. Generate new pack if needed
  IF v_needs_refill THEN
    -- Deduct extra refill if used before 24h
    IF FOUND AND v_state.last_refill_at >= now() - interval '24 hours' AND v_state.extra_refills_available > 0 THEN
       UPDATE public.postalpeek_daily_feed_state
       SET extra_refills_available = extra_refills_available - 1,
           last_refill_at = now()
       WHERE user_id = v_user_id;
    END IF;

    -- Pick up to 2 random UNCLAIMED album postcards
    SELECT ARRAY(
      SELECT s.postcard_id
      FROM postalpeek_album_slots s
      JOIN postalpeek_postcards p ON p.id = s.postcard_id
      WHERE p.owner_id IS NULL
        AND p.illustration_url IS NOT NULL
        AND p.trip_id IS NULL
        AND (p_country IS NULL OR p.country = p_country)
      ORDER BY random()
      LIMIT 2
    ) INTO v_album_ids;

    v_remaining_limit := p_limit - COALESCE(array_length(v_album_ids, 1), 0);

    -- Get random postcards
    SELECT ARRAY(
      SELECT id FROM (
        SELECT id FROM public.postalpeek_postcards
        WHERE (p_country IS NULL OR country = p_country)
          AND illustration_url IS NOT NULL
          AND id != ALL(COALESCE(v_album_ids, '{}'))
          -- Don't show already owned (unless they are unclaimed, handled by owner_id logic usually, but here owner_id is on postcard? Wait, postcards are unique per item? No, in PostalPeek postcards have an owner_id if claimed. Let's make sure it's NULL)
          AND owner_id IS NULL
          AND (trip_id IS NULL OR EXISTS (
            SELECT 1 FROM public.postalpeek_trips t
            WHERE t.id = trip_id AND t.status = 'completed'
          ))
        ORDER BY random()
        LIMIT v_remaining_limit
      ) as sub
    ) INTO v_new_pack;
    
    -- Combine
    v_new_pack := array_cat(v_album_ids, v_new_pack);

    -- Shuffle the combined array
    SELECT ARRAY(
      SELECT unnest(v_new_pack) ORDER BY random()
    ) INTO v_new_pack;

    -- Upsert state
    INSERT INTO public.postalpeek_daily_feed_state (user_id, active_pack, last_refill_at)
    VALUES (v_user_id, v_new_pack, now())
    ON CONFLICT (user_id) DO UPDATE
    SET active_pack = EXCLUDED.active_pack,
        last_refill_at = EXCLUDED.last_refill_at;

    -- Return the new pack
    -- Note: IF the pack is empty (e.g. no postcards left matching criteria), it will return empty array
    IF array_length(v_new_pack, 1) > 0 THEN
      RETURN QUERY
      SELECT p.* FROM public.postalpeek_postcards p
      JOIN unnest(v_new_pack) WITH ORDINALITY t(id, ord) USING (id)
      ORDER BY t.ord;
    END IF;
  END IF;

  -- If empty and no refills, returns nothing
  RETURN;
END;
$$;


-- RPC to pop from the pack
CREATE OR REPLACE FUNCTION public.postalpeek_remove_from_pack(p_postcard_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.postalpeek_daily_feed_state
  SET active_pack = array_remove(active_pack, p_postcard_id)
  WHERE user_id = auth.uid();
END;
$$;
