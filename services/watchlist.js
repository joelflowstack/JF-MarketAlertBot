/**
 * services/watchlist.js
 *
 * Data-access layer for user watchlists - backed by Firestore.
 *
 * Now tracks which PLATFORM each watched item came from ("telegram" or
 * "discord"), so the alert engine and daily-summary service know which
 * notify function to use when a threshold fires - see services/alertEngine.js.
 * Existing items from before this field existed default to "telegram" when
 * read, so nothing breaks for data written before this change.
 *
 * Firestore layout: a flat "watchlistItems" collection, one document per
 * (user, symbol) pair, with a deterministic doc ID so add/remove/lookup are
 * all simple direct-document operations rather than queries.
 *
 *   watchlistItems/{userId}__{symbolNoSlash}
 *     { userId, symbol: "EUR/USD", threshold, lastPrice, addedAt, platform }
 */
import { getDb } from '../firebase/admin.js';

const COLLECTION = 'watchlistItems';

function docId(userId, apiSymbol) {
  return `${userId}__${apiSymbol.replace('/', '')}`;
}

/** Normalizes a Firestore doc's data, defaulting platform for pre-Discord records. */
function withDefaults(data) {
  return { platform: 'telegram', ...data };
}

/** Adds a symbol to a user's watchlist. Updates the threshold if it already exists. */
export async function addToWatchlist(userId, apiSymbol, threshold = null, platform = 'telegram') {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(docId(userId, apiSymbol));
  const existing = await ref.get();

  if (existing.exists) {
    if (threshold !== null) await ref.update({ threshold });
    const data = withDefaults(existing.data());
    return { ...data, threshold: threshold !== null ? threshold : data.threshold };
  }

  const entry = {
    userId,
    symbol: apiSymbol,
    threshold,
    lastPrice: null,
    addedAt: new Date().toISOString(),
    platform,
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
  return snap.docs.map((d) => withDefaults(d.data()));
}

/** Returns ALL users' watchlists as [{ userId, items }] - used by the alert-check cron. */
export async function getAllWatchlists() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).get();

  const grouped = new Map();
  snap.docs.forEach((doc) => {
    const data = withDefaults(doc.data());
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
  return updated.exists ? withDefaults(updated.data()) : null;
}
