-- Drop old 3-parameter version of postalpeek_get_random_feed to fix overloading function issue
DROP FUNCTION IF EXISTS public.postalpeek_get_random_feed(integer, text, uuid[]);
