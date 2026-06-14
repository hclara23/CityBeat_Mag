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
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
export default app;
