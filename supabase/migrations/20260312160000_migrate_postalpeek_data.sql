-- 1. Data Migration from postalpeek_feed to postalpeek_postcards
INSERT INTO public.postalpeek_postcards (
    id,
    country,
    city,
    location_name,
    lat,
    lng,
    original_image_url,
    illustration_url,
    category,
    description,
    streetview_pov,
    generation_metadata,
    created_at
)
SELECT 
    id,
    -- Extract country (usually the last part after the comma)
    TRIM(SPLIT_PART(location_name, ',', array_length(string_to_array(location_name, ','), 1))) as country,
    -- Extract city (usually the first part before the comma)
    -- Also remove 'en ' prefix if it exists
    REPLACE(TRIM(SPLIT_PART(location_name, ',', 1)), 'en ', '') as city,
    location_name,
    lat,
    lng,
    original_image_url,
    illustration_url,
    category,
    description,
    metadata->'streetview_pov' as streetview_pov,
    metadata->'generation_metadata' as generation_metadata,
    created_at
FROM public.postalpeek_feed;

-- 2. Clean up old table
DROP TABLE IF EXISTS public.postalpeek_feed;
