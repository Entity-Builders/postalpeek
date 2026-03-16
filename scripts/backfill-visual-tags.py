#!/usr/bin/env python3
"""
Backfill visual_tags for existing postcards using Gemini Vision API.

Usage:
  Local:  python3 backfill-visual-tags.py --country Argentina
  Prod:   python3 backfill-visual-tags.py --country Argentina --db-url "postgresql://user:pass@host:5432/postgres"
  Dry:    python3 backfill-visual-tags.py --country Argentina --dry-run
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.request
import subprocess

LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Synced with eb-infra/supabase/functions/_shared/walker/ai-generator.ts
PROMPT = (
    "Analyze this street view image carefully. Return a JSON object with a single key: "
    '"visual_tags" — an array of English lowercase tags describing EVERYTHING visible '
    "in the image. Include: objects (car, bus, colectivo, bicycle, motorcycle, statue, fountain), "
    "building types (colonial_building, skyscraper, church, apartment_building, house), "
    "nature (tree, park, river, mountain, garden), scene elements (sidewalk_cafe, graffiti, "
    "cobblestone, streetlight, crosswalk), vehicles (taxi, colectivo, truck, van), "
    'food/commerce (restaurant, pizzeria, kiosk, pharmacy). Be SPECIFIC: use "colectivo" not '
    'just "bus", "obelisco" not just "monument". Include both specific and general tags.'
)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


def get_gemini_key():
    """Read GEMINI_API_KEY from env or eb-infra/.env"""
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key

    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, "..", "..", "..", "eb-infra", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    return line.strip().split("=", 1)[1]
    return None


def db_query(sql, db_url):
    """Run a psql query and return rows as list of tuples."""
    result = subprocess.run(
        ["psql", db_url, "-t", "-A", "-F", "|", "-c", sql],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  DB Error: {result.stderr}", file=sys.stderr)
        return []
    rows = [line.split("|") for line in result.stdout.strip().split("\n") if line.strip()]
    return rows


def db_execute(sql, db_url):
    """Run a psql command (no output expected)."""
    subprocess.run(
        ["psql", db_url, "-q", "-c", sql],
        capture_output=True, text=True
    )


def download_image(url):
    """Download image and return bytes."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "PostalPeek-Backfill/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read()
    except Exception as e:
        print(f"  ⚠️  Download failed: {e}")
        return None


def extract_tags(image_bytes, api_key):
    """Send image to Gemini and extract visual_tags."""
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": "image/jpeg", "data": image_b64}},
                {"text": PROMPT}
            ]
        }],
        "generationConfig": {"responseMimeType": "application/json"}
    }

    url = f"{GEMINI_URL}?key={api_key}"
    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        text = result["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        tags = parsed.get("visual_tags", [])
        # Normalize (synced with ai-generator.ts)
        tags = [t.lower().strip() for t in tags if isinstance(t, str)]
        return tags
    except Exception as e:
        print(f"  ⚠️  Gemini API error: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(description="Backfill visual_tags for postcards")
    parser.add_argument("--country", default="Argentina", help="Country to process")
    parser.add_argument("--limit", type=int, default=0, help="Max postcards to process (0=all)")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to DB")
    parser.add_argument(
        "--db-url",
        default=None,
        help="Postgres connection string. Defaults to local Supabase (127.0.0.1:54322)"
    )
    args = parser.parse_args()

    db_url = args.db_url or LOCAL_DB_URL
    is_prod = args.db_url is not None

    api_key = get_gemini_key()
    if not api_key:
        print("❌ GEMINI_API_KEY not found")
        sys.exit(1)

    env_label = "🔴 PRODUCTION" if is_prod else "🟢 LOCAL"
    print(f"🏷️  Backfilling visual_tags for: {args.country}")
    print(f"🔑 API key: {api_key[:10]}...")
    print(f"🗄️  DB: {env_label}")

    if is_prod and not args.dry_run:
        print("\n⚠️  You are about to write to PRODUCTION. Press Enter to continue or Ctrl+C to abort.")
        input()

    limit_clause = f"LIMIT {args.limit}" if args.limit > 0 else ""
    rows = db_query(f"""
        SELECT id, original_image_url
        FROM postalpeek_postcards
        WHERE country = '{args.country}'
          AND (visual_tags IS NULL OR visual_tags = '[]'::jsonb)
          AND original_image_url IS NOT NULL
        ORDER BY created_at DESC
        {limit_clause};
    """, db_url)

    if not rows:
        print("✅ No postcards need tagging")
        return

    total = len(rows)
    print(f"📸 {total} postcards to process\n")

    success = 0
    failed = 0

    for i, row in enumerate(rows, 1):
        postcard_id, image_url = row[0], row[1]
        print(f"[{i}/{total}] {postcard_id}")
        print(f"  📷 {image_url[:70]}...")

        # Download
        image_bytes = download_image(image_url)
        if not image_bytes:
            failed += 1
            continue

        # Extract tags
        tags = extract_tags(image_bytes, api_key)
        if not tags:
            failed += 1
            continue

        # Preview
        preview = ", ".join(tags[:6])
        if len(tags) > 6:
            preview += "..."
        print(f"  ✅ {len(tags)} tags: {preview}")

        # Write to DB
        if not args.dry_run:
            tags_json = json.dumps(tags)
            # Escape single quotes for SQL
            tags_json_escaped = tags_json.replace("'", "''")
            db_execute(f"""
                UPDATE postalpeek_postcards
                SET visual_tags = '{tags_json_escaped}'::jsonb
                WHERE id = '{postcard_id}';
            """, db_url)

        success += 1

        # Rate limit: ~1 req/sec (Gemini free tier is 15 RPM for vision)
        if i < total:
            time.sleep(1.5)

    print(f"\n🏁 Done! {success}/{total} tagged ({failed} failed)")
    if args.dry_run:
        print("⚠️  DRY RUN — no DB changes were made")


if __name__ == "__main__":
    main()
