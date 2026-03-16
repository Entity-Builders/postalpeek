#!/bin/bash
# Backfill visual_tags for existing postcards using Gemini Vision API
# Usage: ./backfill-visual-tags.sh [country]
# Default: Argentina
#
# Prerequisites: GEMINI_API_KEY must be set or it will read from eb-infra/.env

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
COUNTRY="${1:-Argentina}"

# Read GEMINI_API_KEY from env or from eb-infra/.env
if [ -z "$GEMINI_API_KEY" ]; then
  GEMINI_API_KEY=$(grep 'GEMINI_API_KEY=' "$REPO_ROOT/eb-infra/.env" | cut -d'=' -f2)
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ GEMINI_API_KEY not found. Set it or ensure eb-infra/.env has it."
  exit 1
fi

echo "🏷️  Backfilling visual_tags for postcards in: $COUNTRY"
echo "🔑 Using Gemini API key: ${GEMINI_API_KEY:0:10}..."

# Get postcards that need tagging
POSTCARDS=$(psql "$SUPABASE_DB_URL" -t -A -F'|' -c "
  SELECT id, original_image_url
  FROM postalpeek_postcards
  WHERE country = '$COUNTRY'
    AND (visual_tags IS NULL OR visual_tags = '[]'::jsonb)
    AND original_image_url IS NOT NULL
  ORDER BY created_at DESC;
")

if [ -z "$POSTCARDS" ]; then
  echo "✅ No postcards need tagging for $COUNTRY"
  exit 0
fi

TOTAL=$(echo "$POSTCARDS" | wc -l | tr -d ' ')
echo "📸 Found $TOTAL postcards to process"
echo ""

COUNT=0
SUCCESS=0
FAILED=0

while IFS='|' read -r ID IMAGE_URL; do
  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] Processing $ID..."
  echo "  📷 URL: ${IMAGE_URL:0:60}..."

  # Download the image
  TMPFILE=$(mktemp /tmp/postal_XXXXXX.jpg)
  HTTP_CODE=$(curl -s -o "$TMPFILE" -w "%{http_code}" "$IMAGE_URL")

  if [ "$HTTP_CODE" != "200" ]; then
    echo "  ⚠️  Failed to download image (HTTP $HTTP_CODE), skipping"
    rm -f "$TMPFILE"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Convert to base64
  IMAGE_B64=$(base64 < "$TMPFILE")
  rm -f "$TMPFILE"

  # Call Gemini Vision API
  PROMPT='Analyze this street view image carefully. Return a JSON object with a single key: "visual_tags" — an array of 5-15 English lowercase tags describing EVERYTHING visible in the image. Include: objects (car, bus, colectivo, bicycle, motorcycle, statue, fountain), building types (colonial_building, skyscraper, church, apartment_building, house), nature (tree, park, river, mountain, garden), scene elements (sidewalk_cafe, graffiti, cobblestone, streetlight, crosswalk), vehicles (taxi, colectivo, truck, van), food/commerce (restaurant, pizzeria, kiosk, pharmacy). Be SPECIFIC: use "colectivo" not just "bus", "obelisco" not just "monument". Include both specific and general tags.'

  GEMINI_RESPONSE=$(curl -s --max-time 20 \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "$(cat <<PAYLOAD
{
  "contents": [{
    "parts": [
      {"inline_data": {"mime_type": "image/jpeg", "data": "$IMAGE_B64"}},
      {"text": "$PROMPT"}
    ]
  }],
  "generationConfig": {"responseMimeType": "application/json"}
}
PAYLOAD
)")

  # Extract visual_tags from response
  TAGS=$(echo "$GEMINI_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    text = data['candidates'][0]['content']['parts'][0]['text']
    parsed = json.loads(text)
    tags = parsed.get('visual_tags', [])
    # Normalize to lowercase
    tags = [t.lower().strip() for t in tags if isinstance(t, str)]
    print(json.dumps(tags))
except Exception as e:
    print('ERROR:' + str(e), file=sys.stderr)
    print('[]')
" 2>/dev/null)

  if [ "$TAGS" = "[]" ] || [ -z "$TAGS" ]; then
    echo "  ⚠️  No tags extracted, skipping"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Update DB
  psql "$SUPABASE_DB_URL" -q -c "
    UPDATE postalpeek_postcards
    SET visual_tags = '$TAGS'::jsonb
    WHERE id = '$ID';
  "

  TAG_COUNT=$(echo "$TAGS" | python3 -c "import sys,json; print(len(json.loads(sys.stdin.read())))")
  echo "  ✅ Tagged with $TAG_COUNT tags: $(echo "$TAGS" | python3 -c "import sys,json; tags=json.loads(sys.stdin.read()); print(', '.join(tags[:5]) + ('...' if len(tags)>5 else ''))")"
  SUCCESS=$((SUCCESS + 1))

  # Rate limiting — 1 second between calls
  sleep 1

done <<< "$POSTCARDS"

echo ""
echo "🏁 Done! $SUCCESS/$TOTAL postcards tagged successfully ($FAILED failed)"
