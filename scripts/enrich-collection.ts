/**
 * enrich-collection.ts — Backfill script for PostalPeek Prominence Scoring
 *
 * Fetches all postcards without `detailed_tags`, downloads their original image,
 * sends it to Gemini for structured visual analysis, and updates the row.
 *
 * Shows a cost preview before processing and asks for confirmation.
 *
 * Usage:
 *   npx tsx apps/PostalPeek/scripts/enrich-collection.ts
 *
 * Optional args:
 *   --limit N    Process only the first N postcards (default: all)
 *   --dry-run    Print what would be updated without writing to DB
 *   --yes, -y    Skip confirmation prompt (useful for CI/scripts)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// ─── Shared constants (source of truth: eb-infra/supabase/functions/_shared/walker/prompt-constants.ts)
// Inlined here because Node's ESM loader cannot resolve TS exports from the Deno Edge Functions directory.
const MIN_VISUAL_TAG_WEIGHT = 7;
const MIN_VISUAL_TAG_CONFIDENCE = 7;

const TAXONOMY_INSTRUCTIONS = `
"detailed_tags": An array of JSON objects describing EVERY distinct visible element in the scene. This powers our search index, so be exhaustive (feel free to list 20-40 items if present), but prioritize meaningful objects over individual leaves or bricks. Each object MUST have:
  - "label": { "en": "English lowercase tag with underscores (e.g. 'apartment_building', 'stray_cat', 'neon_sign'). Use the MOST SPECIFIC term. If you tag 'apartment_building', do NOT also tag 'building'.", "es": "Spanish translation (e.g. 'edificio de departamentos', 'gato callejero', 'cartel de neón')." }
  - "type": A semantic category. Common ones: "architecture", "vehicle", "nature", "object", "person", "animal", "food", "signage". You MAY invent new types if nothing fits well (e.g. "urban_art", "infrastructure", "weather_element", "street_furniture", "public_transport", "religious", "sports", "water_feature"). Use lowercase with underscores.
  - "weight": 1-10 integer. How PROMINENT is this element in the frame? 10 = the main subject/fills most of the image. 1 = tiny background detail barely visible.
  - "confidence": 1-10 integer. How CERTAIN are you this element is present? 10 = absolutely sure. 1 = guessing.
  - "count": Integer. How many of this element are visible (e.g. 3 cars, 1 church).
  - "position": One of: "foreground", "midground", "background".
"scene_type": The overall scene classification. Choose from or invent similar to: "residential_street", "commercial_district", "park", "waterfront", "highway", "rural_road", "plaza", "industrial_zone", "historic_center", "suburban_neighborhood".
"time_of_day": The APPARENT time visible in the image (not the actual capture time). Choose from: "dawn", "morning", "midday", "afternoon", "golden_hour", "blue_hour", "dusk", "night".
"weather": The APPARENT weather visible. Choose from: "sunny", "cloudy", "overcast", "rainy", "foggy", "stormy", "snowy", "hazy", "clear".
"human_activity": The dominant human activity visible. Choose from or invent: "pedestrians", "people_dining", "cyclists", "vendors", "construction_workers", "empty_street", "traffic", "street_performers", "children_playing".`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Load env vars ---
const infraEnvPath = path.join(__dirname, '../../../eb-infra/.env');
const appEnvLocalPath = path.join(__dirname, '../.env.local');

const loadEnvValue = (filePath: string, key: string) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(new RegExp(`^${key}=["']?(.*?)["']?$`, 'm'));
  return match ? match[1].trim() : null;
};

// Supabase local dev uses the well-known default service role key
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const SUPABASE_URL =
  loadEnvValue(appEnvLocalPath, 'VITE_SUPABASE_URL') ||
  'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  SUPABASE_URL.includes('127.0.0.1') || SUPABASE_URL.includes('localhost')
    ? LOCAL_SERVICE_ROLE_KEY
    : loadEnvValue(infraEnvPath, 'SUPABASE_SERVICE_ROLE_KEY');
const GEMINI_API_KEY = loadEnvValue(infraEnvPath, 'GEMINI_API_KEY');
const GOOGLE_MAPS_API_KEY = loadEnvValue(infraEnvPath, 'GOOGLE_MAPS_API_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in eb-infra/.env');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in eb-infra/.env');
  process.exit(1);
}

// --- Parse CLI args ---
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 9999;
const dryRun = args.includes('--dry-run');
const skipConfirm = args.includes('--yes') || args.includes('-y');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Cost estimation constants ---
// Gemini 2.5 Flash pricing (as of 2025):
//   Input: $0.15 per 1M tokens  |  Output: $0.60 per 1M tokens
//   Image: ~258 tokens per image (each image counts as input)
const AVG_INPUT_TOKENS_PER_IMAGE = 900; // ~258 image + ~640 prompt text (bilingual instructions)
const AVG_OUTPUT_TOKENS_PER_CALL = 1000; // structured JSON response with bilingual fields
const INPUT_COST_PER_M = 0.15;
const OUTPUT_COST_PER_M = 0.6;
const RATE_LIMIT_DELAY_S = 1;

const CATEGORY_INSTRUCTIONS = `"category": { "es": "A short category with an emoji in Spanish. MUST be ONE OF these core themes based on the dominant setting: 🏙️ Paisaje Urbano, 🏘️ Barrio Residencial, 🌿 Naturaleza y Parques, 🏛️ Histórico y Monumentos, 🏖️ Costa y Agua, 🛣️ Autopista y Ruta, 🏭 Zona Industrial, 🏪 Zona Comercial, 🎨 Escena Cultural, ⛰️ Montañas y Colinas, 🏜️ Paisaje Árido, 🏚️ Abandonado. DO NOT invent highly specific categories.", "en": "Same category in English (e.g. 🏙️ Urban Cityscape, 🌿 Nature & Parks)" }`;

// --- Taxonomy prompt: uses shared constants from prompt-constants.ts ---
const taxonomyPrompt = `Analyze this street view image carefully. Respond with a JSON object:
{
  ${CATEGORY_INSTRUCTIONS},
  "description": { "es": "A short, atmospheric, poetic sentence describing the vibe in Spanish", "en": "The same sentence translated to English" },
  ${TAXONOMY_INSTRUCTIONS}
  "aesthetic_vibes": ["1-3 mood tags like cyberpunk, melancholic, cottagecore. PRIORITIZE THOSE OVER INVENTING NEW ONES. Lowercase with underscores."],
  "architecture_style": "Dominant style or none. PRIORITIZE common ones over inventing.",
  "color_palette": "One of: monochromatic, pastel, neon, earthy, vibrant, moody, warm_terracotta, cool_blues"
}`;

// --- Helper: Readline confirmation ---
async function confirm(message: string): Promise<boolean> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y') || answer === '');
    });
  });
}

// --- Helper: Download image to base64 ---
async function imageToBase64(url: string): Promise<string | null> {
  try {
    // Images are served from a custom CDN domain, download directly via fetch
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ⚠️ Could not download image: HTTP ${res.status}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.toString('base64');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠️ Image download failed: ${msg}`);
    return null;
  }
}

// --- Helper: Call Gemini ---
async function analyzeImage(base64: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            { text: taxonomyPrompt },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text in Gemini response');

  return JSON.parse(text);
}

// --- Main ---
async function main() {
  console.log('🔍 Fetching postcards without detailed_tags...');
  console.log(`   URL: ${SUPABASE_URL}`);
  if (dryRun) console.log('   🏜️ DRY RUN mode — no DB writes');

  const { data: postcards, error } = await supabase
    .from('postalpeek_postcards')
    .select('id, original_image_url, location_name, city, country, category, description, lat, lng')
    .is('detailed_tags', null)
    .limit(limit)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching postcards:', error.message);
    process.exit(1);
  }

  console.log(`📬 Found ${postcards.length} postcards to enrich.\n`);

  if (postcards.length === 0) {
    console.log('✅ Nothing to do — all postcards already have detailed_tags!');
    process.exit(0);
  }

  // --- Preview & Cost Estimation ---
  const n = postcards.length;
  const totalInputTokens = n * AVG_INPUT_TOKENS_PER_IMAGE;
  const totalOutputTokens = n * AVG_OUTPUT_TOKENS_PER_CALL;
  const inputCost = (totalInputTokens / 1_000_000) * INPUT_COST_PER_M;
  const outputCost = (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_M;
  const totalCost = inputCost + outputCost;
  const estimatedMinutes = Math.ceil((n * RATE_LIMIT_DELAY_S) / 60);

  console.log('┌──────────────────────────────────────────┐');
  console.log('│         📊 ENRICHMENT PREVIEW            │');
  console.log('├──────────────────────────────────────────┤');
  console.log(`│  Postcards to process:  ${String(n).padStart(6)}          │`);
  console.log(
    `│  Estimated time:        ~${String(estimatedMinutes).padStart(4)} min        │`,
  );
  console.log(`│  Gemini API calls:      ${String(n).padStart(6)}          │`);
  console.log(
    `│  Input tokens (est):   ${String(totalInputTokens.toLocaleString()).padStart(8)}         │`,
  );
  console.log(
    `│  Output tokens (est):  ${String(totalOutputTokens.toLocaleString()).padStart(8)}         │`,
  );
  console.log(
    `│  Estimated cost:       $${totalCost.toFixed(4).padStart(7)}         │`,
  );
  console.log('├──────────────────────────────────────────┤');
  console.log(
    `│  Mode: ${dryRun ? '🏜️  DRY RUN (no DB writes)' : '🔥 LIVE (will update DB)'}       │`,
  );
  console.log('└──────────────────────────────────────────┘');
  console.log('');

  // --- Sample preview (first 5 postcards) ---
  const sample = postcards.slice(0, 5);
  console.log('📋 Sample postcards:');
  sample.forEach((pc, i) => {
    console.log(`   ${i + 1}. ${pc.location_name || pc.city}, ${pc.country}`);
  });
  if (n > 5) console.log(`   ... and ${n - 5} more\n`);
  else console.log('');

  if (!skipConfirm) {
    const proceed = await confirm('▶️  Proceed? [Y/n] ');
    if (!proceed) {
      console.log('❌ Aborted by user.');
      process.exit(0);
    }
    console.log('');
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < postcards.length; i++) {
    const pc = postcards[i];
    const progress = `[${i + 1}/${postcards.length}]`;

    console.log(
      `\n${progress} 🖼️  ${pc.location_name || pc.city}, ${pc.country} (${pc.id})`,
    );

    // 1. Download image
    const base64 = await imageToBase64(pc.original_image_url);
    if (!base64) {
      console.log(`${progress} ⏭️  Skipped (no image)`);
      failed++;
      continue;
    }

    // 2. Analyze with Gemini
    try {
      const analysis = await analyzeImage(base64);
      const detailedTags = Array.isArray(analysis.detailed_tags)
        ? analysis.detailed_tags
        : [];

      // Auto-populate visual_tags from high-prominence items
      const visualTags = detailedTags
        .filter(
          (t: any) =>
            (t.weight ?? 0) >= MIN_VISUAL_TAG_WEIGHT &&
            (t.confidence ?? 0) >= MIN_VISUAL_TAG_CONFIDENCE,
        )
        .map((t: any) => {
          const lbl = t.label;
          // Handle bilingual {es,en} objects and plain strings
          const en = typeof lbl === 'object' && lbl !== null ? lbl.en : lbl;
          return String(en || '').toLowerCase().trim();
        })
        .filter(Boolean);

      // Parse bilingual category/description (handles both {es,en} objects and plain strings)
      const parsedCategory = typeof analysis.category === 'object' && analysis.category !== null
        ? analysis.category
        : { es: analysis.category || null };
      const parsedDescription = typeof analysis.description === 'object' && analysis.description !== null
        ? analysis.description
        : { es: analysis.description || null };

      const update: Record<string, unknown> = {
        // Only overwrite category/description if the postcard doesn't already have them
        // (preserves the richer original values from the generation pipeline)
        ...(!pc.category ? { category: parsedCategory } : {}),
        ...(!pc.description ? { description: parsedDescription } : {}),
        detailed_tags: detailedTags,
        visual_tags: visualTags,
        scene_type: analysis.scene_type || null,
        time_of_day: analysis.time_of_day || null,
        weather: analysis.weather || null,
        human_activity: analysis.human_activity || null,
        aesthetic_vibes: Array.isArray(analysis.aesthetic_vibes)
          ? analysis.aesthetic_vibes.map((v: string) => v.toLowerCase().trim())
          : [],
        architecture_style: analysis.architecture_style || null,
        color_palette: analysis.color_palette || null,
      };

      // ─── Diff Preview ─────────────────────────────────────────
      const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
      const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
      const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
      const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

      console.log(`\n${progress} ${cyan(pc.location_name || pc.city || 'Unknown')}`);
      console.log(dim('─'.repeat(60)));

      // Before state
      console.log(dim('  BEFORE:'));
      console.log(dim(`    category:     ${JSON.stringify(pc.category) || '(none)'}`));
      console.log(dim(`    description:  ${JSON.stringify(pc.description)?.slice(0, 80) || '(none)'}`));
      console.log(dim(`    detailed_tags: (none)`));
      console.log(dim(`    visual_tags:  (none)`));

      // After state
      console.log(green('  AFTER:'));
      if (!pc.category) {
        console.log(green(`  + category:     ${JSON.stringify(parsedCategory)}`));
      } else {
        console.log(dim(`    category:     ${yellow('(kept original)')}`));
      }
      if (!pc.description) {
        console.log(green(`  + description:  ${JSON.stringify(parsedDescription)?.slice(0, 80)}`));
      } else {
        console.log(dim(`    description:  ${yellow('(kept original)')}`));
      }
      console.log(green(`  + detailed_tags: ${detailedTags.length} tags`));
      // Show top 3 tags as preview
      const topTags = detailedTags
        .sort((a: any, b: any) => (b.weight ?? 0) - (a.weight ?? 0))
        .slice(0, 3)
        .map((t: any) => `${t.label?.es || t.label?.en || '?'} (w:${t.weight})`)
        .join(', ');
      if (topTags) console.log(dim(`                   → ${topTags}`));
      console.log(green(`  + visual_tags:   [${visualTags.join(', ')}]`));
      console.log(green(`  + scene:         ${analysis.scene_type || '?'}`));
      console.log(green(`  + time/weather:  ${analysis.time_of_day || '?'} / ${analysis.weather || '?'}`));
      if (analysis.did_you_know) {
        const fact = typeof analysis.did_you_know === 'object'
          ? analysis.did_you_know.es?.slice(0, 60)
          : String(analysis.did_you_know).slice(0, 60);
        console.log(green(`  + did_you_know:  "${fact}..."`));
      }

      if (dryRun) {
        console.log(yellow(`  ⏸️  DRY RUN — not saved`));
      } else {
        const { error: updateError } = await supabase
          .from('postalpeek_postcards')
          .update(update)
          .eq('id', pc.id);

        if (updateError) {
          console.error(`  ❌ DB update failed: ${updateError.message}`);
          failed++;
          continue;
        }

        console.log(green(`  ✅ Saved!`));

        // ─── Inline Business Discovery (multi-business) ────
        if (GOOGLE_MAPS_API_KEY && pc.lat && pc.lng) {
          try {
            const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${pc.lat},${pc.lng}&radius=50&type=establishment&key=${GOOGLE_MAPS_API_KEY}`;
            const nearbyRes = await fetch(nearbyUrl);
            const nearbyData = await nearbyRes.json();

            if (nearbyData.status === 'OK' && nearbyData.results?.length) {
              const places = nearbyData.results.slice(0, 5);
              console.log(green(`  🏪 Businesses found: ${places.length}`));

              for (const place of places) {
                const bizType = classifyBusinessType(place.types || []);
                const dist = haversineDistance(pc.lat, pc.lng, place.geometry.location.lat, place.geometry.location.lng);
                const prominence = detectProminence(place.name, bizType, dist, detailedTags);

                // Get contact details
                const contact: Record<string, string> = {};
                try {
                  const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${GOOGLE_MAPS_API_KEY}`;
                  const detRes = await fetch(detUrl);
                  const detData = await detRes.json();
                  if (detData.status === 'OK' && detData.result) {
                    if (detData.result.formatted_phone_number) contact.phone = detData.result.formatted_phone_number;
                    if (detData.result.website) contact.website = detData.result.website;
                  }
                } catch { /* non-blocking */ }

                // Check if business already exists
                const { data: existing } = await supabase
                  .from('eb_businesses')
                  .select('id')
                  .eq('google_place_id', place.place_id)
                  .single();

                const isNew = !existing;
                let businessId: string;

                if (existing) {
                  businessId = existing.id;
                } else {
                  const { data: newBiz } = await supabase
                    .from('eb_businesses')
                    .insert({
                      google_place_id: place.place_id,
                      name: place.name,
                      business_type: bizType,
                      google_types: place.types,
                      contact,
                      rating: place.rating || null,
                      price_level: place.price_level ?? null,
                      lat: place.geometry.location.lat,
                      lng: place.geometry.location.lng,
                      city: pc.city || null,
                      country: pc.country || null,
                    })
                    .select('id')
                    .single();

                  if (!newBiz) continue;
                  businessId = newBiz.id;
                }

                // Create link
                await supabase
                  .from('postalpeek_business_links')
                  .upsert(
                    { business_id: businessId, postcard_id: pc.id, prominence, distance_m: dist },
                    { onConflict: 'business_id,postcard_id' },
                  );

                // Format output
                const icon = prominence === 'protagonist' ? '⭐' : prominence === 'featured' ? '•' : '·';
                const promColor = prominence === 'protagonist' ? green : prominence === 'featured' ? cyan : dim;
                const newTag = isNew ? yellow(' NEW') : dim(' EXISTS');
                console.log(promColor(`     ${icon} ${place.name} (${bizType}) — ${prominence.toUpperCase()} — ${dist}m${newTag}`));
                if (contact.phone) console.log(dim(`       📞 ${contact.phone}`));
                if (contact.website) console.log(dim(`       🌐 ${contact.website?.slice(0, 50)}`));
              }
            } else {
              console.log(dim(`  🏪 No businesses nearby`));
            }
          } catch (bizErr: any) {
            console.log(dim(`  🏪 Discovery failed: ${bizErr.message}`));
          }
        } else if (!GOOGLE_MAPS_API_KEY) {
          console.log(dim(`  🏪 Skipped (no GOOGLE_MAPS_API_KEY)`));
        }
      }

      success++;

      // Rate limiting: wait 1s between API calls to avoid quota issues
      if (i < postcards.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err: any) {
      console.error(`${progress} ❌ Analysis failed:`, err.message);
      failed++;

      // Wait longer on errors (potential rate limit)
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log(
    `\n🎉 Done! ✅ ${success} enriched, ❌ ${failed} failed out of ${postcards.length} total.`,
  );
}

// ─── Business Type Classifier ───────────────────────────────────

const BUSINESS_TYPES = new Set([
  'restaurant', 'cafe', 'bar', 'bakery', 'meal_delivery', 'meal_takeaway',
  'store', 'clothing_store', 'convenience_store', 'department_store',
  'electronics_store', 'grocery_or_supermarket', 'shopping_mall', 'book_store',
  'lodging', 'hotel', 'gym', 'spa', 'beauty_salon', 'hair_care',
  'gas_station', 'car_repair', 'pharmacy', 'dentist', 'doctor',
  'bank', 'florist', 'tourist_attraction', 'museum', 'art_gallery',
  'night_club', 'movie_theater',
]);

function classifyBusinessType(googleTypes: string[]): string | null {
  for (const t of googleTypes) {
    if (BUSINESS_TYPES.has(t)) return t;
  }
  return googleTypes[0] || null;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function detectProminence(
  businessName: string,
  businessType: string | null,
  distance: number,
  detailedTags: any[],
): 'protagonist' | 'featured' | 'nearby' {
  if (!detailedTags?.length) return 'nearby';
  const nameLower = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const tag of detailedTags) {
    const tagLabel = (
      typeof tag.label === 'object' ? (tag.label?.en || tag.label?.es || '') : String(tag.label || '')
    ).toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (nameLower.length > 3 && tagLabel.includes(nameLower)) return 'protagonist';
    if (tag.type === 'signage' && nameLower.length > 3 && tagLabel.includes(nameLower.slice(0, 6))) return 'protagonist';
  }

  if (businessType) {
    const typeWords = businessType.replace(/_/g, ' ').split(' ');
    for (const tag of detailedTags) {
      const tagLabel = (typeof tag.label === 'object' ? (tag.label?.en || '') : String(tag.label || '')).toLowerCase();
      for (const word of typeWords) {
        if (tagLabel.includes(word) && word.length > 3) {
          if ((tag.weight ?? 0) >= 7 && distance <= 15) return 'protagonist';
          return 'featured';
        }
      }
    }
  }

  if (distance <= 20) {
    const hasFacade = detailedTags.some((t: any) => {
      const l = typeof t.label === 'object' ? (t.label?.en || '') : String(t.label || '');
      return ['storefront', 'facade', 'shop_front', 'entrance', 'signage'].some(kw => l.toLowerCase().includes(kw));
    });
    if (hasFacade) return 'featured';
  }

  return 'nearby';
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
