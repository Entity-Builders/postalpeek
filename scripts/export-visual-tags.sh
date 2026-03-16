#!/bin/bash
# Export visual_tags from LOCAL Supabase and generate SQL to apply in PROD.
#
# Usage:
#   ./export-visual-tags.sh                     # Export all
#   ./export-visual-tags.sh --country Argentina # Export by country
#
# Output: visual_tags_export.sql (ready to run against prod)

set -euo pipefail

LOCAL_DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
OUTPUT_FILE="$(dirname "$0")/visual_tags_export.sql"

COUNTRY_FILTER=""
if [[ "${1:-}" == "--country" && -n "${2:-}" ]]; then
  COUNTRY_FILTER="AND country = '${2}'"
fi

echo "🔍 Querying local DB for postcards with visual_tags..."

# Export illustration_url + visual_tags as SQL UPDATE statements
psql "$LOCAL_DB" -t -A -F '|' -c "
  SELECT illustration_url, visual_tags::text
  FROM postalpeek_postcards
  WHERE visual_tags IS NOT NULL
    AND visual_tags != '[]'::jsonb
    ${COUNTRY_FILTER}
  ORDER BY created_at DESC;
" | while IFS='|' read -r url tags; do
  # Escape single quotes in tags JSON and URL
  escaped_tags=$(echo "$tags" | sed "s/'/''/g")
  escaped_url=$(echo "$url" | sed "s/'/''/g")
  echo "UPDATE postalpeek_postcards SET visual_tags = '${escaped_tags}'::jsonb WHERE illustration_url = '${escaped_url}';"
done > "$OUTPUT_FILE"

COUNT=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
echo "✅ Exported ${COUNT} postcards to: $OUTPUT_FILE"
echo ""
echo "To apply in PROD:"
echo "  psql \"postgresql://postgres.[ref]:password@host:6543/postgres\" -f $OUTPUT_FILE"
