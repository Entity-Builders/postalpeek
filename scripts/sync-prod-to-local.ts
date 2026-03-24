/**
 * sync-prod-to-local.ts — Bidirectional Sync Helper
 *
 * 1. PROD -> LOCAL: Insert any postcard that exists in Prod but not in Local.
 * 2. LOCAL -> PROD: Update any postcard in Prod with latest data from Local 
 *    (illustration_tags, generation_metadata, etc.)
 *
 * Usage:
 *   npx tsx apps/PostalPeek/scripts/sync-prod-to-local.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Env loading ─────────────────────────────────────────────────
const infraEnvPath = path.join(__dirname, '../../../eb-infra/.env');
const appEnvLocalPath = path.join(__dirname, '../.env.local');
const appEnvProdPath = path.join(__dirname, '../.env.production');

const loadEnvValue = (filePath: string, key: string) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(new RegExp(`^${key}=["']?(.*?)["']?$`, 'm'));
  return match ? match[1].trim() : null;
};

// Local Supabase (target/source)
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const LOCAL_URL =
  loadEnvValue(appEnvLocalPath, 'VITE_SUPABASE_URL') ||
  'http://127.0.0.1:54321';

// Production Supabase (source/target)
const PROD_URL = loadEnvValue(appEnvProdPath, 'VITE_SUPABASE_URL');
const PROD_SERVICE_ROLE_KEY = loadEnvValue(infraEnvPath, 'SUPABASE_SERVICE_ROLE_KEY');

if (!PROD_URL) {
  console.error('❌ VITE_SUPABASE_URL not found in .env.production');
  process.exit(1);
}
if (!PROD_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in eb-infra/.env');
  process.exit(1);
}

// ─── Clients ─────────────────────────────────────────────────────
const local = createClient(LOCAL_URL, LOCAL_SERVICE_ROLE_KEY);
const prod = createClient(PROD_URL, PROD_SERVICE_ROLE_KEY);

async function fetchAllRows(client, table, select = '*') {
  let allRows = [];
  let from = 0;
  let to = 999;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(from, to);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      if (data.length < 1000) {
        hasMore = false;
      } else {
        from += 1000;
        to += 1000;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('📡 Fetching all postcards from PRODUCTION...');
  let prodPostcards;
  try {
    prodPostcards = await fetchAllRows(prod, 'postalpeek_postcards', '*');
  } catch (prodErr) {
    console.error('❌ Error fetching prod postcards:', prodErr.message);
    process.exit(1);
  }
  console.log(`✅ Found ${prodPostcards.length} postcards in PRODUCTION.`);

  console.log('\n📡 Fetching all postcards from LOCAL...');
  let localPostcards;
  try {
    localPostcards = await fetchAllRows(local, 'postalpeek_postcards', '*');
  } catch (localErr) {
    console.error('❌ Error fetching local postcards:', localErr.message);
    process.exit(1);
  }
  console.log(`✅ Found ${localPostcards.length} postcards in LOCAL.`);

  // Maps for quick lookup
  const localMap = new Map(localPostcards.map(p => [p.id, p]));
  const prodMap = new Map(prodPostcards.map(p => [p.id, p]));

  // 1. PROD -> LOCAL (Missing in Local)
  const missingInLocal = [];
  for (const pc of prodPostcards) {
    if (!localMap.has(pc.id)) {
      missingInLocal.push(pc);
    }
  }

  // 2. LOCAL -> PROD (Update existing in Prod or Insert missing in Prod)
  const toUpdateInProd = [];
  const missingInProd = [];
  for (const localPc of localPostcards) {
    if (prodMap.has(localPc.id)) {
      // Local postcard exists in Prod. We update Prod with this local's data.
      toUpdateInProd.push(localPc);
    } else {
      // Local postcard NOT in Prod yet.
      missingInProd.push(localPc);
    }
  }

  console.log('\n📊 Summary of actions to perform:');
  console.log(`- Insert to LOCAL: ${missingInLocal.length} new postcards (from Prod)`);
  console.log(`- Update in PROD: ${toUpdateInProd.length} existing postcards (from Local)`);
  console.log(`- Insert to PROD: ${missingInProd.length} new postcards (from Local)`);

  // --- EXECUTE: Insert missing into LOCAL ---
  if (missingInLocal.length > 0) {
    console.log(`\n⬇️ Inserting ${missingInLocal.length} new postcards into LOCAL db...`);
    const BATCH_SIZE = 100;
    for (let i = 0; i < missingInLocal.length; i += BATCH_SIZE) {
      const batch = missingInLocal.slice(i, i + BATCH_SIZE);
      const { error } = await local.from('postalpeek_postcards').insert(batch);
      if (error) {
        console.error(`❌ Error inserting LOCAL batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      } else {
        console.log(`✅ Inserted LOCAL batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingInLocal.length / BATCH_SIZE)}`);
      }
    }
  } else {
    console.log('\n✅ LOCAL is already caught up with new PROD postcards.');
  }

  // --- EXECUTE: Update existing in PROD ---
  if (toUpdateInProd.length > 0) {
    console.log(`\n⬆️ Updating ${toUpdateInProd.length} existing postcards in PROD db with LOCAL values...`);
    const BATCH_SIZE = 100;
    for (let i = 0; i < toUpdateInProd.length; i += BATCH_SIZE) {
      const batch = toUpdateInProd.slice(i, i + BATCH_SIZE);
      const { error } = await prod.from('postalpeek_postcards').upsert(batch, { onConflict: 'id' });
      
      if (error) {
        console.error(`❌ Error updating PROD batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      } else {
        console.log(`✅ Updated PROD batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toUpdateInProd.length / BATCH_SIZE)}`);
      }
    }
  } else {
    console.log('\n✅ PROD existing records are already updated with LOCAL values.');
  }

  // --- EXECUTE: Insert missing into PROD ---
  if (missingInProd.length > 0) {
    console.log(`\n⬆️ Inserting ${missingInProd.length} new postcards into PROD db...`);
    const BATCH_SIZE = 100;
    for (let i = 0; i < missingInProd.length; i += BATCH_SIZE) {
      const batch = missingInProd.slice(i, i + BATCH_SIZE);
      const { error } = await prod.from('postalpeek_postcards').insert(batch);
      
      if (error) {
        console.error(`❌ Error inserting PROD batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      } else {
        console.log(`✅ Inserted PROD batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingInProd.length / BATCH_SIZE)}`);
      }
    }
  } else {
    console.log('\n✅ PROD is already caught up with new LOCAL postcards.');
  }

  console.log('\n🎉 Bidirectional sync complete!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
