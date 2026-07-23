/**
 * services/watchlist.js
 *
 * Data-access layer for user watchlists - now backed by Firestore.
 *
 * Every function here has the EXACT same signature as the in-memory version
 * from Phase 2, so nothing in server.js, telegram/commands.js, or
 * services/alertEngine.js needed to change to pick this up.
 *
 * Firestore layout: a flat "watchlistItems" collection, one document per
 * (user, symbol) pair, with a deterministic doc ID so add/remove/lookup are
 * all simple direct-document operations rather than queries.
 *
 *   watchlistItems/{userId}__{symbolNoSlash}
 *     { userId, symbol: "EUR/USD", threshold, lastPrice, addedAt }
 */
import { getDb } from '../firebase/admin.js';

const COLLECTION = 'watchlistItems';

function docId(userId, apiSymbol) {
  return `${userId}__${apiSymbol.replace('/', '')}`;
}

/** Adds a symbol to a user's watchlist. Updates the threshold if it already exists. */
export async function addToWatchlist(userId, apiSymbol, threshold = null) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(docId(userId, apiSymbol));
  const existing = await ref.get();

  if (existing.exists) {
    if (threshold !== null) await ref.update({ threshold });
    return { ...existing.data(), threshold: threshold !== null ? threshold : existing.data().threshold };
  }

  const entry = {
    userId,
    symbol: apiSymbol,
    threshold,
    lastPrice: null,
    addedAt: new Date().toISOString(),
  };
  await ref.set(entry);
  return entry;
}

/** Removes a symbol from a user's watchlist. Returns true if something was removed. */
export async function removeFromWatchlist(userId, apiSymbol) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(docId(userId, apiSymbol));
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}

/** Returns a single user's watchlist. */
export async function listWatchlist(userId) {
  const db = getDb();
  const snap = await db.collection(COLLECTION).where('userId', '==', userId).get();
  return snap.docs.map((d) => d.data());
}

/** Returns ALL users' watchlists as [{ userId, items }] - used by the alert-check cron. */
export async function getAllWatchlists() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();

  const grouped = new Map();
  snap.docs.forEach((doc) => {
    const data = doc.data();
    if (!grouped.has(data.userId)) grouped.set(data.userId, []);
    grouped.get(data.userId).push(data);
  });

  return [...grouped.entries()].map(([userId, items]) => ({ userId, items }));
}

/** Updates the last-observed price for a watched symbol (used for threshold-crossing detection). */
export async function updateLastPrice(userId, apiSymbol, price) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(docId(userId, apiSymbol));
  // .catch: if the doc was removed between the alert check starting and this
  // write happening (rare race), don't let it blow up the whole check pass.
  await ref.update({ lastPrice: price }).catch(() => {});
}

/** Sets or clears the alert threshold for a watched symbol. */
export async function setThreshold(userId, apiSymbol, threshold) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(docId(userId, apiSymbol));
  await ref.update({ threshold });
  const updated = await ref.get();
  return updated.exists ? updated.data() : null;
}
