/**
 * sync-catalog.ts
 * 
 * Synchronizes the core "Catalog" from Staging (eb-core-dev) to Production.
 * Specifically skips user data (auth.users) and resets user-claimed state on postcards 
 * so Production starts as a clean slate for real users.
 * 
 * Target tables:
 * - postalpeek_postcards (resets owner_id, claimed_at, last_played_at)
 * - postalpeek_albums
 * - postalpeek_album_slots
 * - postalpeek_riddles
 * - postalpeek_postcard_objects
 * - eb_businesses
 * - postalpeek_business_links
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Env loading ─────────────────────────────────────────────────
const infraEnvPath = path.join(__dirname, '../../../eb-infra/.env');
const appEnvStagingPath = path.join(__dirname, '../.env.staging');
const appEnvProdPath = path.join(__dirname, '../.env.production');

const loadEnvValue = (filePath: string, key: string) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(new RegExp(`^${key}=["']?(.*?)["']?$`, 'm'));
  return match ? match[1].trim() : null;
};

// ─── Configuration ───────────────────────────────────────────────
const STAGING_URL = loadEnvValue(appEnvStagingPath, 'VITE_SUPABASE_URL');
const STAGING_KEY = loadEnvValue(infraEnvPath, 'SUPABASE_SERVICE_ROLE_KEY');

const PROD_URL = loadEnvValue(appEnvProdPath, 'VITE_SUPABASE_URL');
const PROD_KEY = loadEnvValue(appEnvProdPath, 'SUPABASE_SERVICE_ROLE_KEY');

if (!STAGING_URL || !STAGING_KEY) {
  console.error('❌ Could not find Staging URL or Key (VITE_SUPABASE_URL in .env.staging / SUPABASE_SERVICE_ROLE_KEY in eb-infra/.env)');
  process.exit(1);
}

if (!PROD_URL || !PROD_KEY) {
  console.error('❌ Could not find PROD_URL or PROD_KEY.');
  console.error('⚠️  Please add SUPABASE_SERVICE_ROLE_KEY="tu_secret_key" a tu .env.production');
  process.exit(1);
}

const staging = createClient(STAGING_URL, STAGING_KEY);
const prod = createClient(PROD_URL, PROD_KEY);

const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

async function syncTable(tableName: string, transformFn?: (row: any) => any, conflictCols: string = 'id') {
  console.log(`\n⏳ Fetching ${cyan(tableName)} from Staging...`);
  
  // Try counting first (optional, just query all since it's a script)
  const { data, error } = await staging.from(tableName).select('*');
  if (error) {
    console.error(`❌ Error fetching ${tableName}:`, error.message);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log(`✅ 0 records found in ${tableName}`);
    return;
  }

  console.log(`📦 Found ${data.length} records. Syncing to Prod...`);
  
  const payload = transformFn ? data.map(transformFn) : data;
  
  // Upsert in batches of 100 to avoid payload limits
  let successCount = 0;
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const { error: pushErr } = await prod.from(tableName).upsert(chunk, { onConflict: conflictCols });
    
    if (pushErr) {
      console.error(`❌ Error upserting ${tableName}:`, pushErr.message);
    } else {
      successCount += chunk.length;
    }
  }
  console.log(`✅ Synced ${green(successCount.toString())} records in ${tableName}.`);
}

async function main() {
  console.log('');
  console.log(cyan('══════════════════════════════════════════════════════════'));
  console.log(cyan('  🚀 Syncing Catalog: Staging ➔ Production (Clean Slate)'));
  console.log(cyan('══════════════════════════════════════════════════════════'));
  console.log('');

  // 1. Businesses
  await syncTable('eb_businesses', undefined, 'google_place_id');
  
  // 2. Postcards (RESET USER DATA)
  await syncTable('postalpeek_postcards', (p) => ({
    ...p,
    owner_id: null,
    claimed_at: null,
    last_played_at: null
  }));

  // 3. Postcard Objects (for Find Objects game)
  await syncTable('postalpeek_postcard_objects', undefined, 'id');

  // 4. Riddles (for Hunt game)
  await syncTable('postalpeek_riddles', undefined, 'id');
  
  // 5. Business Links
  await syncTable('postalpeek_business_links', undefined, 'business_id,postcard_id');

  // 6. Albums
  await syncTable('postalpeek_albums');

  // 7. Album Slots
  await syncTable('postalpeek_album_slots', undefined, 'album_id,slot_order');

  console.log('\n🎉 Catalog sync completed successfully!');
}

main().catch(console.error);
