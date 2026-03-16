#!/bin/bash
# Reset a PostalPeek user's collection (dev only)
# Usage: ./reset-collection.sh [email]
# If no email provided, resets ALL claims

SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

EMAIL="${1:-}"

if [ -n "$EMAIL" ]; then
  echo "🗑️  Resetting collection for: $EMAIL"
  psql "$SUPABASE_DB_URL" <<SQL
    UPDATE postalpeek_postcards
    SET owner_id = NULL, claimed_at = NULL
    WHERE owner_id = (SELECT id FROM auth.users WHERE email = '$EMAIL');

    DELETE FROM postalpeek_claim_limits
    WHERE user_id = (SELECT id FROM auth.users WHERE email = '$EMAIL');

    DELETE FROM postalpeek_favorites
    WHERE user_id = (SELECT id FROM auth.users WHERE email = '$EMAIL');

    DELETE FROM postalpeek_album_progress
    WHERE user_id = (SELECT id FROM auth.users WHERE email = '$EMAIL');

    DELETE FROM postalpeek_daily_feed_state
    WHERE user_id = (SELECT id FROM auth.users WHERE email = '$EMAIL');
SQL
else
  echo "🗑️  Resetting ALL claims"
  psql "$SUPABASE_DB_URL" <<SQL
    UPDATE postalpeek_postcards SET owner_id = NULL, claimed_at = NULL WHERE owner_id IS NOT NULL;
    DELETE FROM postalpeek_claim_limits;
    DELETE FROM postalpeek_favorites;
    DELETE FROM postalpeek_album_progress;
    DELETE FROM postalpeek_daily_feed_state;
SQL
fi

echo "✅ Done — collection reset"
