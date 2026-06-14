import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env.vercel.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://czhttphmcgrsxvsiakha.supabase.co';
// Need the service role key to bypass RLS, but the secret key provided will work
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const serviceAccount = require(path.resolve(__dirname, '../../service-account.json'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'kerstenblueprint',
});

const db = getFirestore();

async function migrateTable(tableName: string, collectionName: string) {
  console.log(`Starting migration of ${tableName} to ${collectionName}...`);
  let hasMore = true;
  let page = 0;
  const pageSize = 1000;
  let totalMigrated = 0;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    const batch = db.batch();
    for (const item of data) {
      const docId = item.id ? item.id.toString() : (item.date || item.campaign_id || item.article_id || item.slug || Math.random().toString(36).substring(7)).toString();
      const docRef = db.collection(collectionName).doc(docId);
      // Convert Date strings to Firestore Timestamps where appropriate
      const cleanedItem = { ...item };
      for (const [key, value] of Object.entries(cleanedItem)) {
        if (value === null) {
          delete cleanedItem[key];
        } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
           // Basic ISO date check
           cleanedItem[key] = Timestamp.fromDate(new Date(value));
        }
      }
      batch.set(docRef, cleanedItem);
    }

    await batch.commit();
    totalMigrated += data.length;
    console.log(`Migrated ${totalMigrated} items from ${tableName}.`);
    page++;
    
    if (data.length < pageSize) {
      hasMore = false;
    }
  }
  console.log(`Finished migrating ${tableName}. Total: ${totalMigrated}`);
}

import { getAuth } from 'firebase-admin/auth';

const auth = getAuth();

async function migrateAuthUsers() {
  console.log('Starting migration of Supabase Auth Users to Firebase Auth...');
  let hasMore = true;
  let page = 1;
  const pageSize = 1000;
  let totalMigrated = 0;

  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });

    if (error) {
      console.error('Error fetching Supabase auth users:', error);
      break;
    }

    if (!data || !data.users || data.users.length === 0) {
      hasMore = false;
      break;
    }

    const usersToImport = data.users.map(u => ({
      uid: u.id,
      email: u.email,
      emailVerified: !!u.email_confirmed_at,
      displayName: u.user_metadata?.full_name || u.user_metadata?.name || undefined,
      photoURL: u.user_metadata?.avatar_url || undefined,
      // Firebase doesn't directly import encrypted passwords unless using specific hash configs.
      // So users will need to reset passwords, or we generate a random one to let them exist.
      // We'll leave password blank, which means they must use OAuth or Password Reset to log in.
    }));

    try {
      const result = await auth.importUsers(usersToImport);
      totalMigrated += usersToImport.length;
      console.log(`Migrated ${usersToImport.length} users. Success: ${result.successCount}, Errors: ${result.failureCount}`);
      if (result.failureCount > 0) {
         result.errors.forEach(err => {
            console.error(err.error.message);
         });
      }
    } catch (importErr) {
      console.error('Error importing users into Firebase:', importErr);
    }

    page++;
    if (data.users.length < pageSize) {
      hasMore = false;
    }
  }

  console.log(`Finished migrating auth users. Total: ${totalMigrated}`);
}

async function run() {
  // First migrate auth users
  await migrateAuthUsers();

  const tables = [
    'profiles',
    'directory_claims',
    'categories',
    'articles',
    'tags',
    'ad_campaigns',
    'ad_events',
    'ad_placements',
    'ad_creatives',
    'sponsors',
    'article_translations',
    'authors',
    'directory_listings'
  ];

  for (const table of tables) {
    await migrateTable(table, table);
  }
}

run().catch(console.error);
