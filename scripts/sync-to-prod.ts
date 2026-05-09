/**
 * sync-to-prod.ts — Push locally enriched data to production Supabase
 *
 * Reads all postcards that have been enriched locally (detailed_tags IS NOT NULL)
 * and upserts the enrichment columns into the production database — matching by ID.
 *
 * Also syncs:
 *   - eb_businesses (upsert by google_place_id)
 *   - postalpeek_business_links (upsert by business_id + postcard_id)
 *
 * Usage:
 *   npx tsx apps/PostalPeek/scripts/sync-to-prod.ts
 *
 * Options:
 *   --dry-run     Preview changes without writing to prod
 *   --limit N     Process only the first N postcards
 *   --yes, -y     Skip confirmation prompt
 *   --skip-biz    Skip syncing businesses and business links
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

// Local Supabase (source)
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const LOCAL_URL =
  loadEnvValue(appEnvLocalPath, 'VITE_SUPABASE_URL') ||
  'http://127.0.0.1:54321';

// Production Supabase (target)
const PROD_URL = loadEnvValue(appEnvProdPath, 'VITE_SUPABASE_URL');
const PROD_SERVICE_ROLE_KEY = loadEnvValue(appEnvProdPath, 'SUPABASE_SERVICE_ROLE_KEY');

if (!PROD_URL) {
  console.error('❌ VITE_SUPABASE_URL not found in .env.production');
  process.exit(1);
}
if (!PROD_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in eb-infra/.env');
  process.exit(1);
}

// Safety: ensure we're not accidentally writing to local
if (PROD_URL.includes('localhost') || PROD_URL.includes('127.0.0.1')) {
  console.error('❌ PROD_URL looks like a local instance. Aborting for safety.');
  process.exit(1);
}

// ─── CLI args ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 9999;
const dryRun = args.includes('--dry-run');
const skipConfirm = args.includes('--yes') || args.includes('-y');
const skipBiz = args.includes('--skip-biz');

// ─── Clients ─────────────────────────────────────────────────────
const local = createClient(LOCAL_URL, LOCAL_SERVICE_ROLE_KEY);
const prod = createClient(PROD_URL, PROD_SERVICE_ROLE_KEY);

// ─── Enrichment columns to sync ─────────────────────────────────
const ENRICHMENT_COLUMNS = [
  'category',
  'description',
  'detailed_tags',
  'visual_tags',
  'scene_type',
  'time_of_day',
  'weather',
  'human_activity',
  'aesthetic_vibes',
  'architecture_style',
  'color_palette',
] as const;

// ─── Helpers ─────────────────────────────────────────────────────
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

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

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(cyan('═══════════════════════════════════════════'));
  console.log(cyan('  📤 PostalPeek — Sync Enrichment to Prod'));
  console.log(cyan('═══════════════════════════════════════════'));
  console.log('');
  console.log(`  Source: ${dim(LOCAL_URL)}`);
  console.log(`  Target: ${yellow(PROD_URL!)}`);
  if (dryRun) console.log(`  Mode:   ${yellow('🏜️ DRY RUN — no writes to prod')}`);
  if (skipBiz) console.log(`  ${dim('Skipping business sync')}`);
  console.log('');

  // ── 1. Fetch enriched postcards from local ─────────────────────
  console.log('🔍 Fetching enriched postcards from local...');

  const selectCols = ['id', 'city', 'country', 'location_name', ...ENRICHMENT_COLUMNS].join(', ');

  const { data: localPostcards, error: localErr } = await local
    .from('postalpeek_postcards')
    .select(selectCols)
    .not('detailed_tags', 'is', null)
    .limit(limit)
    .order('created_at', { ascending: false });

  if (localErr) {
    console.error(red(`❌ Error fetching local postcards: ${localErr.message}`));
    process.exit(1);
  }

  if (!localPostcards || localPostcards.length === 0) {
    console.log(green('✅ No enriched postcards found locally. Nothing to sync.'));
    process.exit(0);
  }

  // ── 2. Check which ones already exist in prod ──────────────────
  console.log(`📬 Found ${cyan(String(localPostcards.length))} enriched postcards locally.`);
  console.log('🔍 Checking production state...');

  const localIds = localPostcards.map((p) => p.id);

  // Fetch prod postcards in batches of 200 (conservative to avoid Supabase row limits)
  const BATCH_SIZE = 200;
  const prodMap = new Map<string, any>();
  for (let i = 0; i < localIds.length; i += BATCH_SIZE) {
    const batch = localIds.slice(i, i + BATCH_SIZE);
    const { data: prodBatch, error: batchErr } = await prod
      .from('postalpeek_postcards')
      .select('id, detailed_tags')
      .in('id', batch)
      .limit(BATCH_SIZE);
    if (batchErr) {
      console.warn(yellow(`  ⚠️ Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${batchErr.message}`));
    }
    if (prodBatch) {
      for (const p of prodBatch) prodMap.set(p.id, p);
    }
  }
  console.log(`  Matched ${cyan(String(prodMap.size))} postcards in prod.`);

  // Classify: new enrichment vs already enriched in prod
  const toSync: typeof localPostcards = [];
  const alreadyEnriched: string[] = [];
  const notInProd: string[] = [];

  for (const lp of localPostcards) {
    const prodRecord = prodMap.get(lp.id);
    if (!prodRecord) {
      notInProd.push(lp.id);
    } else if (prodRecord.detailed_tags) {
      alreadyEnriched.push(lp.id);
    } else {
      toSync.push(lp);
    }
  }

  // ── 3. Preview ─────────────────────────────────────────────────
  console.log('');
  console.log('┌──────────────────────────────────────────┐');
  console.log('│          📊 SYNC PREVIEW                 │');
  console.log('├──────────────────────────────────────────┤');
  console.log(`│  Enriched locally:       ${String(localPostcards.length).padStart(5)}          │`);
  console.log(`│  To sync (need update):  ${cyan(String(toSync.length).padStart(5))}          │`);
  console.log(`│  Already enriched:       ${dim(String(alreadyEnriched.length).padStart(5))}          │`);
  console.log(`│  Not found in prod:      ${dim(String(notInProd.length).padStart(5))}          │`);
  console.log('├──────────────────────────────────────────┤');
  console.log(`│  Mode: ${dryRun ? yellow('🏜️ DRY RUN') : green('🔥 LIVE')}                         │`);
  console.log('└──────────────────────────────────────────┘');
  console.log('');

  if (toSync.length === 0) {
    console.log(green('✅ Nothing to sync — all postcards already enriched in prod!'));
    if (notInProd.length > 0) {
      console.log(dim(`   (${notInProd.length} postcards exist locally but not in prod — run the generation pipeline first)`));
    }
    process.exit(0);
  }

  // Sample preview
  console.log('📋 Sample postcards to sync:');
  toSync.slice(0, 5).forEach((pc, i) => {
    const tags = Array.isArray(pc.detailed_tags) ? pc.detailed_tags.length : 0;
    console.log(`   ${i + 1}. ${pc.location_name || pc.city}, ${pc.country} — ${tags} tags`);
  });
  if (toSync.length > 5) console.log(`   ... and ${toSync.length - 5} more`);
  console.log('');

  if (!skipConfirm) {
    const proceed = await confirm(`▶️  Push ${toSync.length} enrichments to prod? [Y/n] `);
    if (!proceed) {
      console.log('❌ Aborted.');
      process.exit(0);
    }
    console.log('');
  }

  // ── 4. Sync postcards ──────────────────────────────────────────
  let success = 0;
  let failed = 0;

  for (let i = 0; i < toSync.length; i++) {
    const pc = toSync[i];
    const progress = `[${i + 1}/${toSync.length}]`;

    const update: Record<string, unknown> = {};
    for (const col of ENRICHMENT_COLUMNS) {
      if (pc[col] !== undefined && pc[col] !== null) {
        update[col] = pc[col];
      }
    }

    if (dryRun) {
      const tags = Array.isArray(pc.detailed_tags) ? pc.detailed_tags.length : 0;
      console.log(`${progress} ${yellow('⏸️')} ${pc.location_name || pc.city}, ${pc.country} — ${tags} tags`);
      success++;
      continue;
    }

    const { error: updateErr } = await prod
      .from('postalpeek_postcards')
      .update(update)
      .eq('id', pc.id);

    if (updateErr) {
      console.error(`${progress} ${red('❌')} ${pc.city}: ${updateErr.message}`);
      failed++;
    } else {
      const tags = Array.isArray(pc.detailed_tags) ? pc.detailed_tags.length : 0;
      console.log(`${progress} ${green('✅')} ${pc.location_name || pc.city}, ${pc.country} — ${tags} tags`);
      success++;
    }
  }

  console.log('');
  console.log(green(`📬 Postcards: ${success} synced, ${failed} failed`));

  // ── 5. Sync businesses (optional) ──────────────────────────────
  if (!skipBiz) {
    console.log('');
    console.log('🏪 Syncing businesses...');

    const { data: localBiz, error: bizErr } = await local
      .from('eb_businesses')
      .select('*');

    if (bizErr) {
      console.warn(yellow(`⚠️ Could not fetch local businesses: ${bizErr.message}`));
    } else if (localBiz && localBiz.length > 0) {
      let bizSuccess = 0;
      let bizFailed = 0;

      for (const biz of localBiz) {
        if (dryRun) {
          console.log(`  ${yellow('⏸️')} ${biz.name} (${biz.business_type || 'unknown'})`);
          bizSuccess++;
          continue;
        }

        const { error: upsertErr } = await prod
          .from('eb_businesses')
          .upsert(biz, { onConflict: 'google_place_id' });

        if (upsertErr) {
          console.error(`  ${red('❌')} ${biz.name}: ${upsertErr.message}`);
          bizFailed++;
        } else {
          console.log(`  ${green('✅')} ${biz.name}`);
          bizSuccess++;
        }
      }

      console.log(green(`🏪 Businesses: ${bizSuccess} synced, ${bizFailed} failed`));

      // Sync business links
      console.log('');
      console.log('🔗 Syncing business links...');

      const { data: localLinks, error: linkErr } = await local
        .from('postalpeek_business_links')
        .select('*');

      if (linkErr) {
        console.warn(yellow(`⚠️ Could not fetch local business links: ${linkErr.message}`));
      } else if (localLinks && localLinks.length > 0) {
        // Only sync links for postcards that exist in prod
        const relevantLinks = localLinks.filter((l) => prodMap.has(l.postcard_id));

        if (dryRun) {
          console.log(`  ${yellow('⏸️')} Would sync ${relevantLinks.length} links (dry run)`);
        } else {
          // Batch upsert in chunks of 100
          let linkSuccess = 0;
          for (let i = 0; i < relevantLinks.length; i += 100) {
            const batch = relevantLinks.slice(i, i + 100);
            const { error: batchErr } = await prod
              .from('postalpeek_business_links')
              .upsert(batch, { onConflict: 'business_id,postcard_id' });

            if (batchErr) {
              console.error(`  ${red('❌')} Batch error: ${batchErr.message}`);
            } else {
              linkSuccess += batch.length;
            }
          }
          console.log(green(`🔗 Business links: ${linkSuccess} synced`));
        }
      } else {
        console.log(dim('  No business links to sync'));
      }
    } else {
      console.log(dim('  No businesses found locally'));
    }
  }

  // ── Summary ────────────────────────────────────────────────────
  console.log('');
  console.log(green('═══════════════════════════════════════════'));
  console.log(green(`  🎉 Sync complete!`));
  console.log(green('═══════════════════════════════════════════'));
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
