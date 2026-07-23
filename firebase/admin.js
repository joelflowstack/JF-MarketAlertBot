/**
 * firebase/admin.js
 *
 * Lazy Firestore initialization. We don't call admin.initializeApp() at
 * module load time - if FIREBASE_* env vars are missing (e.g. before you've
 * set them up), the whole server would otherwise crash on import, taking
 * down the Telegram bot and every route with it. Instead we only throw when
 * something actually tries to use the database, with a clear error message.
 */
import admin from 'firebase-admin';
import { logger } from '../utils/logger.js';

let db = null;

function initialize() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Env vars store the literal two-character sequence "\n", not a real newline -
  // the private key needs actual newlines to be valid PEM, so convert them back.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase credentials are missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    );
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    logger.info('Firebase Admin SDK initialized');
  }

  return admin.firestore();
}

/** Returns the Firestore instance, initializing on first use. */
export function getDb() {
  if (!db) db = initialize();
  return db;
}
