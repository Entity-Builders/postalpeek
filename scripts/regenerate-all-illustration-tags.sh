#!/bin/bash
#
# regenerate-all-illustration-tags.sh
#
# Regenerates illustration_tags for ALL postcards by calling
# the postalpeek-semantic-segment edge function (now bilingual).
#
# Usage:
#   ./scripts/regenerate-all-illustration-tags.sh          # dry run (just lists)
#   ./scripts/regenerate-all-illustration-tags.sh --run     # actually regenerate
#   ./scripts/regenerate-all-illustration-tags.sh --run 5   # only first 5

set -euo pipefail

# Standard Supabase local dev service_role key
LOCAL_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$LOCAL_SERVICE_ROLE_KEY}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY not found. Set it or add to eb-infra/.env"
  exit 1
fi

MODE="${1:-dry}"
LIMIT="${2:-999}"
DELAY=3  # seconds between calls to avoid rate limiting

echo "🔄 Regenerate All Illustration Tags"
echo "   Supabase: $SUPABASE_URL"
echo "   Mode: $([ "$MODE" = "--run" ] && echo "🚀 LIVE" || echo "👀 DRY RUN")"
echo "   Limit: $LIMIT"
echo ""

# Fetch all postcard IDs that have an illustration_url
POSTCARDS=$(curl -s "${SUPABASE_URL}/rest/v1/postalpeek_postcards?illustration_url=not.is.null&select=id,city,country&order=created_at.desc&limit=${LIMIT}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")

COUNT=$(echo "$POSTCARDS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "📋 Found $COUNT postcards with illustrations"
echo ""

if [ "$MODE" != "--run" ]; then
  echo "$POSTCARDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, pc in enumerate(data):
    print(f\"  {i+1}. {pc['id'][:8]}... — {pc.get('city','?')}, {pc.get('country','?')}\")
"
  echo ""
  echo "👀 Dry run complete. Run with --run to regenerate:"
  echo "   $0 --run"
  exit 0
fi

# Process each postcard
SUCCESS=0
FAIL=0
i=0

echo "$POSTCARDS" | python3 -c "import sys,json; [print(p['id']) for p in json.load(sys.stdin)]" | while read -r POSTCARD_ID; do
  i=$((i + 1))
  echo -n "[$i/$COUNT] $POSTCARD_ID ... "

  RESULT=$(curl -s -w "\n%{http_code}" "${SUPABASE_URL}/functions/v1/postalpeek-semantic-segment" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -d "{\"postcard_id\": \"${POSTCARD_ID}\"}")

  HTTP_CODE=$(echo "$RESULT" | tail -1)
  BODY=$(echo "$RESULT" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    TAG_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count', '?'))" 2>/dev/null || echo "?")
    echo "✅ $TAG_COUNT tags"
    SUCCESS=$((SUCCESS + 1))
  else
    ERROR=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error', 'unknown'))" 2>/dev/null || echo "$HTTP_CODE")
    echo "❌ $ERROR"
    FAIL=$((FAIL + 1))
  fi

  # Rate limit protection
  sleep $DELAY
done

echo ""
echo "🏁 Done! Success: $SUCCESS, Failed: $FAIL"
