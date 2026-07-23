/**
 * services/alertHistory.js
 *
 * Records fired alerts - now backed by Firestore instead of an in-memory
 * array. Same function signatures as the Phase 4 version, so
 * services/alertEngine.js and server.js's /api/alerts and /api/admin/stats
 * routes need zero changes.
 *
 * Firestore layout: "alertHistory" collection, auto-generated doc IDs.
 *   { userId, symbol, threshold, price, changePercent, sentAt }
 *
 * NOTE: getRecentAlerts() filters by userId AND orders by sentAt - Firestore
 * requires a composite index for that combination. The first time this
 * query runs, Firestore/your server logs will include a direct link to
 * auto-create that index with one click. See the setup notes for this phase.
 */
import { getDb } from '../firebase/admin.js';

const COLLECTION = 'alertHistory';

/** Records a fired alert. Called by services/alertEngine.js right after a successful notify(). */
export async function recordAlert(userId, alert) {
  const db = getDb();
  await db.collection(COLLECTION).add({
    userId,
    ...alert,
    sentAt: new Date().toISOString(),
  });
}

/** Returns a user's most recent alerts, newest first. */
export async function getRecentAlerts(userId, limit = 20) {
  const db = getDb();
  const snap = await db
    .collection(COLLECTION)
    .where('userId', '==', userId)
    .orderBy('sentAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data());
}

/** Returns the total number of alerts ever sent, across all users - for the admin panel. */
export async function getTotalAlertsSent() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).count().get();
  return snap.data().count;
}
