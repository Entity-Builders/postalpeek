#!/bin/bash
#
# backfill-metadata.sh
#
# Backfills storytelling metadata (did_you_know + fact_type) for postcards
# that don't have generation_metadata.storytelling yet.
#
# Calls the postalpeek-enrich-metadata edge function for each postcard.
#
# Usage:
#   ./scripts/backfill-metadata.sh          # dry run (just lists)
#   ./scripts/backfill-metadata.sh --run     # actually enrich
#   ./scripts/backfill-metadata.sh --run 50  # only first 50

set -euo pipefail

# Standard Supabase local dev service_role key
LOCAL_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$LOCAL_SERVICE_ROLE_KEY}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY not found."
  exit 1
fi

MODE="${1:-dry}"
LIMIT="${2:-9999}"
DELAY=3  # seconds between calls

echo "📖 Backfill Metadata (Storytelling Enrichment)"
echo "   Supabase: $SUPABASE_URL"
echo "   Mode: $([ "$MODE" = "--run" ] && echo "🚀 LIVE" || echo "👀 DRY RUN")"
echo "   Limit: $LIMIT"
echo ""

# Use temp files to avoid shell quoting issues with JSON
TMPDIR_BF=$(mktemp -d)
trap "rm -rf $TMPDIR_BF" EXIT

# Fetch postcards where generation_metadata->storytelling IS NULL
curl -s "${SUPABASE_URL}/rest/v1/postalpeek_postcards?illustration_url=not.is.null&generation_metadata-%3E%3Estorytelling=is.null&select=id,city,country&order=created_at.desc&limit=${LIMIT}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" > "$TMPDIR_BF/a.json"

# Also fetch postcards where generation_metadata itself is null
curl -s "${SUPABASE_URL}/rest/v1/postalpeek_postcards?illustration_url=not.is.null&generation_metadata=is.null&select=id,city,country&order=created_at.desc&limit=${LIMIT}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" > "$TMPDIR_BF/b.json"

# Merge both lists (deduplicate by id)
python3 - "$TMPDIR_BF/a.json" "$TMPDIR_BF/b.json" "$LIMIT" "$TMPDIR_BF/merged.json" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as f: a = json.load(f)
with open(sys.argv[2]) as f: b = json.load(f)
limit = int(sys.argv[3])
seen = set()
result = []
for pc in a + b:
    if pc['id'] not in seen:
        seen.add(pc['id'])
        result.append(pc)
with open(sys.argv[4], 'w') as f: json.dump(result[:limit], f)
PYEOF

COUNT=$(python3 -c "import json; print(len(json.load(open('$TMPDIR_BF/merged.json'))))")
echo "📋 Found $COUNT postcards without storytelling metadata"
echo ""

if [ "$COUNT" = "0" ]; then
  echo "✅ All postcards already have storytelling metadata!"
  exit 0
fi

if [ "$MODE" != "--run" ]; then
  python3 - "$TMPDIR_BF/merged.json" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as f: data = json.load(f)
for i, pc in enumerate(data[:20]):
    print(f"  {i+1}. {pc['id'][:8]}... — {pc.get('city','?')}, {pc.get('country','?')}")
if len(data) > 20:
    print(f"  ... and {len(data) - 20} more")
PYEOF
  echo ""
  echo "👀 Dry run complete. Run with --run to enrich:"
  echo "   $0 --run"
  exit 0
fi

# Process each postcard
SUCCESS=0
FAIL=0
SKIP=0
i=0

python3 -c "import json; [print(p['id']) for p in json.load(open('$TMPDIR_BF/merged.json'))]" | while read -r POSTCARD_ID; do
  i=$((i + 1))
  echo ""
  echo "[$i/$COUNT] 🖼️  $POSTCARD_ID"

  RESULT=$(curl -s -w "\n%{http_code}" "${SUPABASE_URL}/functions/v1/postalpeek-enrich-metadata" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -d "{\"postcard_id\": \"${POSTCARD_ID}\"}")

  HTTP_CODE=$(echo "$RESULT" | tail -1)
  BODY=$(echo "$RESULT" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    # Parse the response with Python for rich output
    echo "$BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
msg = d.get('message', 'ok')

if 'skipped' in msg.lower():
    print('  ⏭️  Already has storytelling — skipped')
else:
    # BEFORE: show existing metadata keys
    before = d.get('before', [])
    print('  📦 BEFORE: ' + (', '.join(before) if before else '(empty)'))

    # AFTER: show new storytelling
    st = d.get('storytelling', {})
    ft = st.get('fact_type', '?')
    dyk = st.get('did_you_know', {})
    es = dyk.get('es', '')[:80]
    en = dyk.get('en', '')[:80]
    print(f'  ✨ AFTER:  + storytelling.{ft}')
    print(f'     🇪🇸 {es}...')
    print(f'     🇬🇧 {en}...')
" 2>/dev/null

    MSG=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message','ok'))" 2>/dev/null || echo "ok")
    if echo "$MSG" | grep -qi "skipped"; then
      SKIP=$((SKIP + 1))
    else
      SUCCESS=$((SUCCESS + 1))
    fi
  else
    ERROR=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error', 'unknown'))" 2>/dev/null || echo "$HTTP_CODE")
    echo "  ❌ $ERROR"
    FAIL=$((FAIL + 1))
  fi

  # Rate limit protection
  sleep $DELAY
done

echo ""
echo "🏁 Done! ✅ $SUCCESS enriched, ⏭️ $SKIP skipped, ❌ $FAIL failed"

