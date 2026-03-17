import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load variables manually since they are scattered across mono-repo
const infraEnvPath = path.join(__dirname, '../../../eb-infra/.env');
const appEnvPath = path.join(__dirname, '../.env.production');

const loadEnvValue = (filePath: string, key: string) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(new RegExp(`^${key}=["']?(.*?)["']?$`, 'm'));
  return match ? match[1].trim() : null;
};

const SUPABASE_URL = process.argv[2] || loadEnvValue(appEnvPath, 'VITE_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = process.argv[3] || loadEnvValue(infraEnvPath, 'SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Faltan credenciales. Asegurate de que VITE_SUPABASE_URL y TARGET_SERVICE_ROLE_KEY existan en los .env correspondientes.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function exportData() {
  console.log('🔄 Conectando a Supabase Producción...');

  try {
    // 1. Export Albums (Trips)
    console.log('📦 Exportando Álbumes (Trips)...');
    const { data: trips, error: tripsError } = await supabase
      .from('postalpeek_trips')
      .select('*');

    if (tripsError && tripsError.code !== '42P01') { 
        // 42P01 means table doesn't exist, maybe already migrated
        console.warn('⚠️ Error fetching trips:', tripsError.message);
    }

    // Try new schema if old schema failed/empty
    let albums = trips || [];
    if (albums.length === 0) {
       const { data: realAlbums, error: albumsError } = await supabase
        .from('postalpeek_albums')
        .select('*');
       if (!albumsError) albums = realAlbums || [];
    }
    console.log(`✅ ${albums.length} Álbumes exportados.`);

    // 2. Export Album Slots (Trip Stops)
    console.log('🗺️ Exportando Paradas (Slots)...');
    const { data: stops, error: stopsError } = await supabase
      .from('postalpeek_trip_stops')
      .select('*');

     if (stopsError && stopsError.code !== '42P01') {
        console.warn('⚠️ Error fetching trip stops:', stopsError.message);
    }

    let slots = stops || [];
    if (slots.length === 0) {
       const { data: realSlots, error: slotsErr } = await supabase
        .from('postalpeek_album_slots')
        .select('*');
       if (!slotsErr) slots = realSlots || [];
    }
    console.log(`✅ ${slots.length} Paradas exportadas.`);

    // 3. Export Postcards
    console.log('💌 Exportando Postales...');
    const { data: postcards, error: postcardsError } = await supabase
      .from('postalpeek_postcards')
      .select('*');

    if (postcardsError) throw postcardsError;
    console.log(`✅ ${postcards?.length || 0} Postales exportadas.`);

    // 4. Combine payload
    const backupPayload = {
      timestamp: new Date().toISOString(),
      albums: albums,
      slots: slots,
      postcards: postcards || [],
    };

    // 5. Write to file
    const outputDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `postalpeek_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const outputPath = path.join(outputDir, filename);
    
    fs.writeFileSync(outputPath, JSON.stringify(backupPayload, null, 2));

    console.log('\n🎉 ¡Exportación completada con éxito!');
    console.log(`📁 Archivo guardado en: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error durante la exportación:', error);
  }
}

// Execute
exportData().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
