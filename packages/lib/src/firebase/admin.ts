import { initializeApp, getApps, getApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let app;

if (!getApps().length) {
  let credential = undefined;
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      credential = cert(serviceAccount);
    } catch (e) {
      console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_KEY');
    }
  }
  
  const config: any = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'kerstenblueprint',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'kerstenblueprint.firebasestorage.app'
  };

  if (credential) {
    config.credential = credential;
  } else {
    // If no explicit credential, try applicationDefault, but catch it for Docker build environments
    try {
      config.credential = applicationDefault();
    } catch (e) {
      // Provide a dummy cert so Next.js build doesn't crash during page collection
      config.credential = cert({
        projectId: config.projectId,
        clientEmail: 'dummy@dummy.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCZ\n-----END PRIVATE KEY-----'
      });
    }
  }
  
  app = initializeApp(config);
} else {
  app = getApp();
}

export const adminAuth = getAuth(app);

// DISASTER RECOVERY: a Firestore restore (from a backup or a PITR timestamp)
// ALWAYS creates a NEW database — it can never overwrite (default). With the
// database id hardcoded there was no supported way to point the app at restored
// data, so backups and PITR were unclaimable insurance: the recovery step would
// have been an emergency code change and deploy, under outage conditions.
//
// Recovery is now a config change:
//   1. gcloud firestore databases restore \
//        --source-backup=projects/kerstenblueprint/locations/nam5/backups/<ID> \
//        --destination-database='citybeat-restored'
//      (or --source-database='(default)' --snapshot-time=<RFC3339> for PITR)
//   2. gcloud run services update citybeat-web --region us-central1 \
//        --update-env-vars FIRESTORE_DATABASE_ID=citybeat-restored
//   3. Verify, then either keep serving from it or restore back.
//
// Unset (the normal case) it resolves to '(default)', so this is a no-op today.
const databaseId = process.env.FIRESTORE_DATABASE_ID?.trim();
export const adminDb =
  databaseId && databaseId !== '(default)' ? getFirestore(app, databaseId) : getFirestore(app);

export const adminStorage = getStorage(app);
export default app;
