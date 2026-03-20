/**
 * translate-bilingual.ts — AI Translation script for missing English fields
 * 
 * Fetches postcards that are missing the `en` translation in `category` or `description`.
 * Uses Gemini 2.5 Flash to generate the missing English translations based on the
 * existing Spanish text.
 * 
 * Usage:
 *   npx tsx apps/PostalPeek/scripts/translate-bilingual.ts
 * 
 * Optional args:
 *   --limit N    Process only the first N postcards
 *   --dry-run    Print what would be updated without writing to DB
 *   --yes, -y    Skip confirmation prompt
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const SUPABASE_URL = loadEnvValue(appEnvLocalPath, 'VITE_SUPABASE_URL') || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = SUPABASE_URL.includes('127.0.0.1') || SUPABASE_URL.includes('localhost')
    ? LOCAL_SERVICE_ROLE_KEY
    : loadEnvValue(infraEnvPath, 'SUPABASE_SERVICE_ROLE_KEY');

const GEMINI_API_KEY = loadEnvValue(infraEnvPath, 'GEMINI_API_KEY');

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in eb-infra/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 9999;
const dryRun = args.includes('--dry-run');
const skipConfirm = args.includes('--yes') || args.includes('-y');

// --- Helper: Readline confirmation ---
async function confirm(message: string): Promise<boolean> {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { rl.question(message, (answer: string) => { rl.close(); resolve(answer.toLowerCase().startsWith('y') || answer === ''); }); });
}

// --- Helper: Call Gemini Array Batch ---
// We send a batch of texts to translate to avoid rate limits and reduce cost
async function translateBatch(items: { id: string; category_es: string; description_es: string }[]): Promise<any[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const prompt = `
You are a bilingual copywriter. I will give you a JSON array of items with Spanish categories and descriptions.
You must return a strictly formatted JSON array containing the English translation for each item. Keep the English category short (include the exact same emoji), and make the English description poetic and atmospheric, matching the Spanish vibe perfectly.

Input:
${JSON.stringify(items, null, 2)}

Output Format Requirements:
Return ONLY a valid JSON array of objects. Each object MUST have:
[
  {
    "id": "original-id",
    "category_en": "English category with emoji",
    "description_en": "English translated poetic description"
  }
]
`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
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

// --- Helper: Get nested or raw string ---
function extractEs(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
        if (typeof val.es === 'object' && val.es !== null) return val.es.es || '';
        return val.es || '';
    }
    return '';
}

function hasEn(val: any): boolean {
    if (!val) return false;
    if (typeof val === 'object' && val !== null) {
        if (typeof val.en === 'string' && val.en.trim() !== '') return true;
        // Check for double wrapper logic
        if (typeof val.es === 'object' && val.es !== null && typeof val.es.en === 'string' && val.es.en.trim() !== '') return true;
    }
    return false;
}

async function main() {
  console.log('🔍 Identifying postcards missing English translations...');
  
  const { data: postcards, error } = await supabase
    .from('postalpeek_postcards')
    .select('id, category, description, location_name, city')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching postcards:', error.message);
    process.exit(1);
  }

  const needsTranslation = postcards.filter((pc) => {
      const missingCat = !hasEn(pc.category) && extractEs(pc.category).length > 0;
      const missingDesc = !hasEn(pc.description) && extractEs(pc.description).length > 0;
      return missingCat || missingDesc;
  }).slice(0, limit);

  if (needsTranslation.length === 0) {
    console.log('✅ Nothing to translate! All postcards have English translations.');
    process.exit(0);
  }

  console.log(`🌍 Found ${needsTranslation.length} postcards needing English translation.`);
  if (dryRun) console.log('   🏜️ DRY RUN mode — no DB writes');

  const sample = needsTranslation.slice(0, 3);
  for (const pc of sample) {
      console.log(`  - ${pc.location_name || pc.city || pc.id} `);
      if (!hasEn(pc.description)) console.log(`      Desc [es]: ${extractEs(pc.description).slice(0, 50)}...`);
      if (!hasEn(pc.category)) console.log(`      Cat  [es]: ${extractEs(pc.category)}`);
  }
  if (needsTranslation.length > 3) console.log(`  ... and ${needsTranslation.length - 3} more`);

  if (!skipConfirm) {
    const proceed = await confirm('\n▶️  Proceed with Gemini translation? [Y/n] ');
    if (!proceed) { console.log('❌ Aborted.'); process.exit(0); }
  }

  let success = 0;
  let failed = 0;

  // Process in batches of 15 to stay within stable prompt limits
  const BATCH_SIZE = 15;
  for (let i = 0; i < needsTranslation.length; i += BATCH_SIZE) {
      const batch = needsTranslation.slice(i, i + BATCH_SIZE);
      const progress = `[Batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(needsTranslation.length/BATCH_SIZE)}]`;
      console.log(`\n${progress} Translating ${batch.length} items...`);

      const payload = batch.map(pc => ({
          id: pc.id,
          category_es: extractEs(pc.category),
          description_es: extractEs(pc.description)
      }));

      try {
          // Gemini Call
          const translatedRecords = await translateBatch(payload);

          for (const pc of batch) {
              const tr = translatedRecords.find((r: any) => r.id === pc.id);
              if (!tr) {
                  console.log(`  ⚠️  Missing translation for ${pc.id}`);
                  failed++;
                  continue;
              }

              // Build the newly translated structures
              const newCategory = {
                  es: extractEs(pc.category),
                  en: tr.category_en || ''
              };

              const newDescription = {
                  es: extractEs(pc.description),
                  en: tr.description_en || ''
              };

              if (!dryRun) {
                  const { error: updateErr } = await supabase
                      .from('postalpeek_postcards')
                      .update({
                          category: newCategory,
                          description: newDescription
                      })
                      .eq('id', pc.id);

                  if (updateErr) {
                      console.error(`  ❌ DB Failed for ${pc.id}: ${updateErr.message}`);
                      failed++;
                  } else {
                      console.log(`  ✅ ${pc.location_name || pc.id} -> "${tr.category_en}"`);
                      success++;
                  }
              } else {
                  console.log(`  [DRY] ${pc.location_name || pc.id} -> EN: "${tr.description_en?.slice(0,40)}..."`);
                  success++;
              }
          }

          // Delay for API rate limits
          if (i + BATCH_SIZE < needsTranslation.length) {
              await new Promise(r => setTimeout(r, 2000));
          }
      } catch (err: any) {
          console.error(`❌ Batch failed: ${err.message}`);
          failed += batch.length;
          await new Promise(r => setTimeout(r, 4000)); // sleep longer on failure
      }
  }

  console.log(`\n🎉 Translation Complete! ✅ ${success} translated, ❌ ${failed} failed.`);
}

main().catch(console.error);
