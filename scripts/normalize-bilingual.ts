/**
 * normalize-bilingual.ts — Script to fix double-wrapped BilingualText fields
 * 
 * Some postcards had `category` or `description` saved poorly (either plain strings
 * stored as JSON strings when the column became JSONB, or double-wrapped by migrations/Gemini
 * like {"es": {"es": "...", "en": "..."}}).
 * 
 * This script fetches all postcards, inspects `category` and `description`,
 * normalizes them to strict `{ es: string, en: string }` without losing the original keys,
 * and updates the database.
 * 
 * Usage:
 *   npx tsx apps/PostalPeek/scripts/normalize-bilingual.ts
 * 
 * Optional args:
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

const SUPABASE_URL =
  loadEnvValue(appEnvLocalPath, 'VITE_SUPABASE_URL') ||
  'http://127.0.0.1:54321';

const SUPABASE_SERVICE_ROLE_KEY =
  SUPABASE_URL.includes('127.0.0.1') || SUPABASE_URL.includes('localhost')
    ? LOCAL_SERVICE_ROLE_KEY
    : loadEnvValue(infraEnvPath, 'SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipConfirm = args.includes('--yes') || args.includes('-y');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Helper: normalize bilingual object ---
function normalizeBilingual(val: any): { es: string; en: string } | null {
  if (!val) return null;

  // If it's just a plain string (old fallback)
  if (typeof val === 'string') {
    return { es: val, en: '' };
  }

  if (typeof val === 'object' && val !== null) {
    let esStr = '';
    let enStr = '';

    // Handle nested `es` wrapper: {"es": {"es": "...", "en": "..."}}
    if (typeof val.es === 'object' && val.es !== null) {
      esStr = val.es.es || '';
      enStr = val.es.en || val.en || '';
    } 
    // Handle nested `en` wrapper: {"en": {"es": "...", "en": "..."}} (less likely but possible)
    else if (typeof val.en === 'object' && val.en !== null) {
      esStr = val.en.es || val.es || '';
      enStr = val.en.en || '';
    }
    // Normal case: {"es": "...", "en": "..."}
    else {
      esStr = typeof val.es === 'string' ? val.es : '';
      enStr = typeof val.en === 'string' ? val.en : '';
    }

    // Attempt to recover if it was saved absolutely weirdly like {"es": "something"} where something was unexpected.
    // Ensure we don't return objects again.
    return {
      es: typeof esStr === 'string' ? esStr : String(esStr || ''),
      en: typeof enStr === 'string' ? enStr : String(enStr || ''),
    };
  }

  return null;
}

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

async function main() {
  console.log('🔍 Fetching all postcards for bilingual field normalization...');
  console.log(`   URL: ${SUPABASE_URL}`);
  if (dryRun) console.log('   🏜️ DRY RUN mode — no DB writes');

  const { data: postcards, error } = await supabase
    .from('postalpeek_postcards')
    .select('id, category, description, location_name, city');

  if (error) {
    console.error('❌ Error fetching postcards:', error.message);
    process.exit(1);
  }

  console.log(`📬 Found ${postcards.length} postcards to check.\n`);

  const updates: any[] = [];

  for (const pc of postcards) {
    const isCategoryNested = typeof pc.category === 'object' && pc.category !== null && (typeof pc.category.es === 'object' || typeof pc.category.en === 'object');
    const isCategoryString = typeof pc.category === 'string';
    
    const isDescriptionNested = typeof pc.description === 'object' && pc.description !== null && (typeof pc.description.es === 'object' || typeof pc.description.en === 'object');
    const isDescriptionString = typeof pc.description === 'string';

    // We also want to normalize if there's only an `es` string but no `en` field, 
    // just to format cleanly, but primarily looking for nested or raw strings.
    const needsUpdate = isCategoryNested || isCategoryString || isDescriptionNested || isDescriptionString;

    if (needsUpdate) {
      const newCategory = normalizeBilingual(pc.category);
      const newDescription = normalizeBilingual(pc.description);
      
      updates.push({
        id: pc.id,
        name: pc.location_name || pc.city || pc.id,
        oldCategory: pc.category,
        newCategory,
        oldDescription: pc.description,
        newDescription
      });
    }
  }

  if (updates.length === 0) {
    console.log('✅ All postcards have correctly formatted bilingual JSON. Nothing to do!');
    process.exit(0);
  }

  console.log(`⚠️ Found ${updates.length} postcards needing normalization.`);
  
  // Show a tiny preview
  for (const u of updates.slice(0, 3)) {
    console.log(`\n  📝 ${u.name} (${u.id})`);
    if (JSON.stringify(u.oldDescription) !== JSON.stringify(u.newDescription)) {
       console.log(`    DESC: ${JSON.stringify(u.oldDescription).slice(0, 50)}... → ${JSON.stringify(u.newDescription).slice(0, 50)}...`);
    }
    if (JSON.stringify(u.oldCategory) !== JSON.stringify(u.newCategory)) {
       console.log(`    CAT:  ${JSON.stringify(u.oldCategory).slice(0, 50)}... → ${JSON.stringify(u.newCategory).slice(0, 50)}...`);
    }
  }
  if (updates.length > 3) console.log(`  ... and ${updates.length - 3} more\n`);

  if (!skipConfirm) {
    const proceed = await confirm('▶️  Proceed with update? [Y/n] ');
    if (!proceed) {
      console.log('❌ Aborted.');
      process.exit(0);
    }
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    if (dryRun) {
      success++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('postalpeek_postcards')
      .update({
        category: u.newCategory,
        description: u.newDescription,
      })
      .eq('id', u.id);

    if (updateError) {
      console.error(`❌ Failed to update ${u.id}:`, updateError.message);
      failed++;
    } else {
      success++;
    }
  }

  console.log(`\n🎉 Done! ✅ ${success} updated, ❌ ${failed} failed.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
