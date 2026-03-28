import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local from the app root
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Fallback to local keys if not present in env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
// Uses the default local supabase service role key (or check eb-infra/.env.local)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 50) {
    console.error('❌ Missing or invalid SUPABASE_SERVICE_ROLE_KEY. Check your .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const TEST_USERS = [
    { email: 'rival1@postalpeek.app', username: 'Rival Juan 😡', password: 'password123' },
    { email: 'rival2@postalpeek.app', username: 'Pro Collector 🏆', password: 'password123' },
    { email: 'rival3@postalpeek.app', username: 'Wanderer 🌍', password: 'password123' },
];

async function main() {
    console.log(`🚀 Seeding test users to: ${SUPABASE_URL}`);
    
    const createdUsers = [];

    for (const tu of TEST_USERS) {
        // 1. Create or get user
        console.log(`Creating user: ${tu.email}...`);
        
        let userId = '';
        
        const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
        if (authErr) {
            console.error('❌ Failed to list users', authErr.message);
            process.exit(1);
        }

        const existing = users.find(u => u.email === tu.email);
        if (existing) {
            console.log(`   ✅ User already exists: ${existing.id}`);
            userId = existing.id;
        } else {
            const { data, error } = await supabase.auth.admin.createUser({
                email: tu.email,
                password: tu.password,
                email_confirm: true,
                user_metadata: { name: tu.username }
            });
            if (error) {
                console.error(`   ❌ Failed to create user ${tu.email}:`, error.message);
                continue;
            }
            console.log(`   ✅ Created user: ${data.user.id}`);
            userId = data.user.id;
        }
        
        createdUsers.push({ id: userId, ...tu });

        // Wait a bit for auth to propagate
        await new Promise(r => setTimeout(r, 1000));

    }

    console.log(`\n🎁 Assigning unclaimed postcards to rivals so you can compete...`);

    // Fetch unclaimed postcards (or random ones if none are unclaimed)
    const { data: postcards, error: fetchErr } = await supabase
        .from('postalpeek_postcards')
        .select('id, city')
        .is('owner_id', null)
        .limit(15);

    if (fetchErr) {
        console.error('❌ Failed to fetch postcards', fetchErr.message);
        process.exit(1);
    }

    if (!postcards || postcards.length === 0) {
        console.log('   ⚠️ No unclaimed postcards found! Generate some first.');
    } else {
        let pcIndex = 0;
        for (const u of createdUsers) {
            const numToAssign = Math.floor(postcards.length / createdUsers.length);
            const userPostcards = postcards.slice(pcIndex, pcIndex + numToAssign);
            pcIndex += numToAssign;

            if (userPostcards.length === 0) continue;

            const idsList = userPostcards.map(p => p.id);
            const { error: updateErr } = await supabase
                .from('postalpeek_postcards')
                .update({ 
                    owner_id: u.id, 
                    claimed_at: new Date().toISOString() 
                })
                .in('id', idsList);

            if (updateErr) {
                console.error(`   ❌ Failed to assign to ${u.username}`, updateErr.message);
            } else {
                console.log(`   ✅ Assigned ${userPostcards.length} postcards to ${u.username}`);
            }
        }
    }

    console.log(`\n🎉 Done! Test users are ready.`);
    console.log(`You can login as these users via OTP (check inbucket at http://127.0.0.1:54324) if local auth is OTP-only.`);
    console.log(`Emails: ${TEST_USERS.map(u => u.email).join(', ')}`);
}

main().catch(console.error);
