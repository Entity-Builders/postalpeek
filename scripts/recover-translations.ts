/**
 * recover-translations.ts — Rescue lost English translations
 * 
 * The previous SQL migration accidentally flattened `description` and `category` by
 * replacing the top-level 'es' object with the inner 'es' string, thus deleting the
 * 'en' translation that was inside the same object block.
 * 
 * Fortunately, the raw AI output is perfectly preserved inside the `generation_metadata` column!
 * 
 * This script will read the original AI answer from `generation_metadata` and safely 
 * restore the fully flattened `{ es, en }` format.
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipConfirm = args.includes('--yes') || args.includes('-y');

// Robust bilingual extraction
function extractBilingual(val: any, existingEs: string | null): { es: string; en: string } | null {
  if (!val) return null;
  if (typeof val === 'string') return { es: val, en: '' };
  
  if (typeof val === 'object' && val !== null) {
      let esText = typeof val.es === 'object' && val.es !== null ? val.es.es : val.es;
      let enText = typeof val.en === 'object' && val.en !== null ? val.en.en : (typeof val.es === 'object' && val.es !== null ? val.es.en : val.en);
      
      return { 
          es: esText || existingEs || '', 
          en: enText || '' 
      };
  }
  return null;
}

async function confirm(message: string): Promise<boolean> {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { rl.question(message, (answer: string) => { rl.close(); resolve(answer.toLowerCase().startsWith('y') || answer === ''); }); });
}

async function main() {
  console.log('🔍 Booting Rescue Operation: Recovering lost English translations from generation_metadata...');
  const { data: postcards, error } = await supabase.from('postalpeek_postcards').select('id, category, description, generation_metadata, location_name, city');

  if (error) {
    console.error('❌ Error fetching postcards:', error.message);
    process.exit(1);
  }

  const updates: any[] = [];

  for (const pc of postcards) {
    if (!pc.generation_metadata) continue;

    const metaCategory = pc.generation_metadata.category;
    const metaDescription = pc.generation_metadata.description;
    
    // We only need to rescue if the current column is missing the 'en' translation
    // (meaning it's a string, or an object with no 'en' key)
    const currentCategoryEn = typeof pc.category === 'object' ? pc.category?.en : null;
    const currentDescriptionEn = typeof pc.description === 'object' ? pc.description?.en : null;

    let newCategory = null;
    let newDescription = null;

    if (!currentCategoryEn && metaCategory) {
        newCategory = extractBilingual(metaCategory, typeof pc.category === 'string' ? pc.category : pc.category?.es);
    }
    if (!currentDescriptionEn && metaDescription) {
        newDescription = extractBilingual(metaDescription, typeof pc.description === 'string' ? pc.description : pc.description?.es);
    }

    if ((newCategory && newCategory.en) || (newDescription && newDescription.en)) {
        updates.push({
            id: pc.id,
            name: pc.location_name || pc.city || pc.id,
            newCategory: newCategory || pc.category,
            newDescription: newDescription || pc.description,
            rescuedCategory: !!(newCategory?.en),
            rescuedDescription: !!(newDescription?.en)
        });
    }
  }

  if (updates.length === 0) {
    console.log('✅ Nothing to rescue, all translations are already healthy!');
    process.exit(0);
  }

  console.log(`⚠️ Ready to rescue ${updates.length} postcards!`);
  for (const u of updates.slice(0, 3)) {
      console.log(`\n  🚑 ${u.name} (${u.id})`);
      if (u.rescuedCategory) console.log(`     Category EN Rescued: "${u.newCategory.en}"`);
      if (u.rescuedDescription) console.log(`     Description EN Rescued: "${u.newDescription.en}"`);
  }
  if (updates.length > 3) console.log(`  ... and ${updates.length - 3} more`);

  if (!skipConfirm) {
    const proceed = await confirm('\n▶️  Proceed with rescue? [Y/n] ');
    if (!proceed) { console.log('❌ Aborted.'); process.exit(0); }
  }

  let success = 0, failed = 0;
  for (const u of updates) {
    if (dryRun) { success++; continue; }
    const { error: err } = await supabase.from('postalpeek_postcards').update({ category: u.newCategory, description: u.newDescription }).eq('id', u.id);
    if (err) { console.error(`❌ Failed: ${u.id}`, err.message); failed++; } else { success++; }
  }
  console.log(`\n🎉 Rescue Complete! ✅ ${success} restored, ❌ ${failed} failed.`);
}

main().catch(console.error);
