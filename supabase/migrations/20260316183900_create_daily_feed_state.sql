-- Reverting the strict Tinder feed state (from migration 20260316183900)
DROP FUNCTION IF EXISTS postalpeek_pop_from_pack(UUID);
DROP FUNCTION IF EXISTS postalpeek_get_daily_pack(TEXT);
DROP TABLE IF EXISTS postalpeek_daily_feed_state;
