/**
 * services/settings.js
 *
 * Per-user notification/preference settings, backed by Firestore. This is
 * what the dashboard's Settings page reads/writes - previously it only
 * saved to the browser's localStorage, which meant settings didn't survive
 * switching devices/browsers and weren't stored in Firebase at all, despite
 * the original spec listing "Settings" as something Firestore should store.
 *
 * Firestore layout: "userSettings" collection, one document per user.
 *   userSettings/{userId} -> { thresholdAlerts, dailySummary, updatedAt }
 */
import { getDb } from '../firebase/admin.js';

const COLLECTION = 'userSettings';

const DEFAULT_SETTINGS = {
  thresholdAlerts: true,
  dailySummary: false,
};

/** Returns a user's settings, or sensible defaults if they've never set any. */
export async function getSettings(userId) {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(userId).get();
  return doc.exists ? { ...DEFAULT_SETTINGS, ...doc.data() } : DEFAULT_SETTINGS;
}

/** Merges the given fields into a user's settings (partial update). */
export async function updateSettings(userId, partialSettings) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(userId);
  const payload = { ...partialSettings, updatedAt: new Date().toISOString() };
  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return { ...DEFAULT_SETTINGS, ...updated.data() };
}
