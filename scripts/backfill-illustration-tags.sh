#!/bin/bash
# Backfill illustration_tags for postcards that have an illustration but no tags.
# Uses Gemini Vision — same strategy as the pipeline's analyzeIllustration().
#
# Usage:
#   ./backfill-illustration-tags.sh [--env local|prod] [--dry-run] [--limit N]
#
# Options:
#   --env local   Use local Supabase DB (default)
#   --env prod    Use production Supabase DB (reads from .env.production)
#   --dry-run     Analyze images but do NOT write to DB
#   --limit N     Process at most N postcards (default: all)
#
# Prerequisites: GEMINI_API_KEY must be set or readable from eb-infra/.env

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$(dirname "$APP_DIR")")"

# ── Defaults ──────────────────────────────────────────────────────────────
ENV="local"
DRY_RUN=false
LIMIT=0
APP_URL="https://postal-peek.juanobrach.workers.dev"

# ── Parse args ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)     ENV="$2";   shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --limit)   LIMIT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── DB URL ────────────────────────────────────────────────────────────────
if [ "$ENV" = "prod" ]; then
  ENV_FILE="$APP_DIR/.env.production"
  if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env.production not found at $ENV_FILE"
    exit 1
  fi
  SUPABASE_URL=$(grep 'VITE_SUPABASE_URL=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
  SUPABASE_SERVICE_KEY=$(grep 'SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"')
  # Derive DB direct URL from project ref
  PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | cut -d'.' -f1)
  DB_PASSWORD=$(grep 'SUPABASE_DB_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"')
  SUPABASE_DB_URL="postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  echo "🌐 Mode: PRODUCTION (${PROJECT_REF})"
else
  SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  echo "🏠 Mode: LOCAL"
fi

# ── Gemini API Key ────────────────────────────────────────────────────────
if [ -z "$GEMINI_API_KEY" ]; then
  GEMINI_API_KEY=$(grep 'GEMINI_API_KEY=' "$REPO_ROOT/eb-infra/.env" 2>/dev/null | cut -d'=' -f2)
fi
if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ GEMINI_API_KEY not found. Set it or add to eb-infra/.env"
  exit 1
fi
echo "🔑 Gemini key: ${GEMINI_API_KEY:0:12}..."
$DRY_RUN && echo "🧪 DRY RUN — no DB writes"
echo ""

# ── Query postcards that need illustration_tags ───────────────────────────
LIMIT_CLAUSE=""
[ "$LIMIT" -gt 0 ] 2>/dev/null && LIMIT_CLAUSE="LIMIT $LIMIT"

POSTCARDS=$(/opt/homebrew/bin/psql "$SUPABASE_DB_URL" -t -A -F'|' -c "
  SELECT id, illustration_url, city, country
  FROM postalpeek_postcards
  WHERE illustration_url IS NOT NULL
    AND (illustration_tags IS NULL OR illustration_tags = '[]'::jsonb)
  ORDER BY created_at DESC
  $LIMIT_CLAUSE;
")

if [ -z "$POSTCARDS" ]; then
  echo "✅ All postcards already have illustration_tags. Nothing to do."
  exit 0
fi

TOTAL=$(echo "$POSTCARDS" | grep -c '|' || echo "0")
# Each row has 3 pipes (4 fields), count rows properly
TOTAL=$(echo "$POSTCARDS" | wc -l | tr -d ' ')
echo "📸 Found $TOTAL postcards missing illustration_tags"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

COUNT=0
SUCCESS=0
FAILED=0

# Gemini prompt — identical strategy to analyzeIllustration() in the pipeline
PROMPT='You are analyzing an AI-generated illustration of a location (postcard art style). Return ONLY a JSON object with key "illustration_tags": an array of 5-15 lowercase English tags describing the VISUAL STYLE and CONTENT of THIS ILLUSTRATION. Include: art style (watercolor, sketch, oil_painting, flat_design, comic_style), mood (vibrant, moody, serene, dramatic, nostalgic), colors (warm_tones, cool_tones, muted_palette, colorful), content (architecture, nature, street_scene, people, vehicles, water, mountains), and prominent visual elements. Focus on what a user would see in this ARTISTIC ILLUSTRATION, not a photo.'

while IFS='|' read -r ID ILLUSTRATION_URL CITY COUNTRY; do
  [ -z "$ID" ] && continue
  COUNT=$((COUNT + 1))

  echo "[$COUNT/$TOTAL] 🎨 Postcard: $ID"
  echo "  📍 Location : $CITY, $COUNTRY"
  echo "  🖼️  URL       : ${ILLUSTRATION_URL:0:70}..."
  echo "  🔗 Link      : $APP_URL/?postcard=$ID"

  # Download illustration
  TMPFILE=$(mktemp /tmp/illus_XXXXXX.jpg)
  HTTP_CODE=$(curl -s -o "$TMPFILE" -w "%{http_code}" "$ILLUSTRATION_URL")

  if [ "$HTTP_CODE" != "200" ]; then
    echo "  ⚠️  Download failed (HTTP $HTTP_CODE) — skipping"
    rm -f "$TMPFILE"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Encode to base64 — write to file to avoid "Argument list too long"
  B64_FILE=$(mktemp /tmp/illus_b64_XXXXXX.txt)
  base64 < "$TMPFILE" > "$B64_FILE"
  rm -f "$TMPFILE"

  # Build JSON payload via Python reading b64 from file
  PAYLOAD_FILE=$(mktemp /tmp/illus_payload_XXXXXX.json)
  PROMPT_ESCAPED="$PROMPT"
  python3 - "$B64_FILE" > "$PAYLOAD_FILE" << PYEOF
import sys, json

with open(sys.argv[1]) as f:
    image_b64 = f.read().strip()

prompt = """You are analyzing a stylized illustration (postcard artwork, not a real photograph).
List up to 25 visual elements that are clearly depicted in this illustration.

Be SPECIFIC and GRANULAR. Include ALL of these categories if visible:
- Subjects: people, cyclists, dog, cat, street vendor, musician, tourists
- Vehicles: car, bicycle, motorcycle, bus, colectivo, taxi, truck, tram, scooter
- Architecture: colonial_building, church, skyscraper, apartment_block, balcony, archway, fountain, statue
- Random urban objects: air_conditioner, trash_can, fire_hydrant, bench, streetlight, traffic_cone, mailbox, payphone, scaffolding, awning, neon_sign, graffiti
- Nature: tree, palm_tree, flower_stall, park, garden, river, mountain, lake, grass, ivy
- Commerce: restaurant, cafe, kiosk, pharmacy, market_stall, bakery, bar, shop_window
- Scene details: cobblestone, puddle, shadow, mural, flag, pedestrian_crossing, fence, gate
- Style/mood: watercolor, oil_painting, sketch, flat_design, vibrant, moody, nostalgic, warm_tones, cool_tones, muted_palette
- Time/weather: golden_hour, night, overcast, sunny, rainy

Only include elements CLEARLY VISIBLE in the illustration — do NOT infer from context.
Return ONLY a JSON array of lowercase English strings, no explanation.
Example: ["cathedral", "cobblestone", "bicycle", "flower_stall", "air_conditioner", "watercolor", "warm_tones", "street_vendor", "balcony"]"""

payload = {
    "contents": [{"parts": [
        {"inline_data": {"mime_type": "image/jpeg", "data": image_b64}},
        {"text": prompt}
    ]}],
    "generationConfig": {"responseMimeType": "application/json"}
}
print(json.dumps(payload))
PYEOF

  rm -f "$B64_FILE"

  # Call Gemini — POST the payload file
  RESPONSE_FILE=$(mktemp /tmp/illus_resp_XXXXXX.json)
  HTTP_GEMINI=$(curl -s --max-time 30 -w "%{http_code}" \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    --data-binary "@$PAYLOAD_FILE" \
    -o "$RESPONSE_FILE")
  rm -f "$PAYLOAD_FILE"

  if [ "$HTTP_GEMINI" != "200" ]; then
    echo "  ⚠️  Gemini API error (HTTP $HTTP_GEMINI) — skipping"
    cat "$RESPONSE_FILE" | head -2
    rm -f "$RESPONSE_FILE"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  # Extract tags from response
  TAGS=$(python3 - "$RESPONSE_FILE" << 'PYEOF'
import sys, json

with open(sys.argv[1]) as f:
    data = json.load(f)
try:
    text = data['candidates'][0]['content']['parts'][0]['text']
    parsed = json.loads(text)
    # Handle both: direct array OR {"illustration_tags": [...]}
    if isinstance(parsed, list):
        tags = parsed
    else:
        tags = parsed.get('illustration_tags', [])
    tags = [t.lower().strip() for t in tags if isinstance(t, str)]
    print(json.dumps(tags))
except Exception as e:
    import sys as s
    print(f'PARSE_ERROR: {e}', file=s.stderr)
    print('[]')
PYEOF
)
  rm -f "$RESPONSE_FILE"

  if [ "$TAGS" = "[]" ] || [ -z "$TAGS" ]; then
    echo "  ❌ No tags extracted — skipping"
    FAILED=$((FAILED + 1))
    echo ""
    continue
  fi

  TAGS_FILE=$(mktemp /tmp/illus_tags_XXXXXX.json)
  echo "$TAGS" > "$TAGS_FILE"
  TAG_INFO=$(python3 - "$TAGS_FILE" << 'PYEOF'
import sys, json
with open(sys.argv[1]) as f:
    tags = json.load(f)
print(f"{len(tags)}|{', '.join(tags)}")
PYEOF
)
  rm -f "$TAGS_FILE"
  TAG_COUNT="${TAG_INFO%%|*}"
  TAG_LIST="${TAG_INFO#*|}"
  echo "  🏷️  Tags ($TAG_COUNT): $TAG_LIST"

  if $DRY_RUN; then
    echo "  🧪 DRY RUN — not writing to DB"
  else
    # Write SQL to temp file — avoids apostrophe injection (e.g. "coquito's")
    SQL_FILE=$(mktemp /tmp/illus_sql_XXXXXX.sql)
    python3 - "$SQL_FILE" "$ID" "$TAGS" << 'PYEOF'
import sys, json

sql_file = sys.argv[1]
postcard_id = sys.argv[2]
tags_json = sys.argv[3]

# Validate JSON
tags = json.loads(tags_json)
safe_json = json.dumps(tags)

# Use dollar-quoting to safely embed JSON with single quotes
sql = f"UPDATE postalpeek_postcards SET illustration_tags = $tags${safe_json}$tags$::jsonb WHERE id = '{postcard_id}';\n"
with open(sql_file, 'w') as f:
    f.write(sql)
PYEOF
    /opt/homebrew/bin/psql "$SUPABASE_DB_URL" -q -f "$SQL_FILE"
    rm -f "$SQL_FILE"
    echo "  ✅ Saved to DB"
  fi

  SUCCESS=$((SUCCESS + 1))
  echo ""

  # Rate limit — avoid hammering Gemini
  sleep 1

done <<< "$POSTCARDS"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏁 Done! $SUCCESS/$TOTAL tagged successfully | $FAILED failed"
$DRY_RUN && echo "🧪 DRY RUN — no DB changes were made"
