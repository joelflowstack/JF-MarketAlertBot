/**
 * services/watchlist.js
 *
 * Data-access layer for user watchlists.
 *
 * IMPORTANT: This is an in-memory implementation so Phases 2-4 can be built
 * and demoed before Firebase is wired in. Every function signature here is
 * designed to map 1:1 onto Firestore documents, so in Phase 5 we swap the
 * internals for `firebase/admin.js` calls WITHOUT changing any caller
 * (api/index.js, telegram/commands.js, services/alertEngine.js).
 *
 * Data shape (per user):
 *   userId -> [{ symbol: "EUR/USD", threshold: 1.18, lastPrice: null, addedAt: <ISO> }]
 *
 * `lastPrice` is the price observed on the previous alert-check tick. The
 * alert engine compares it against the threshold to detect a *crossing*
 * (rather than firing every minute while the price sits above/below the
 * threshold), so it must be updated after every check — see
 * services/alertEngine.js.
 */

// Module-level store. Resets on cold start / redeploy — acceptable for MVP,
// and exactly why this gets replaced with Firestore before this becomes a
// real product.
const store = new Map();

function getUserList(userId) {
  if (!store.has(userId)) store.set(userId, []);
  return store.get(userId);
}

/** Adds a symbol to a user's watchlist. No-ops (returns existing entry) if already present. */
export async function addToWatchlist(userId, apiSymbol, threshold = null) {
  const list = getUserList(userId);
  const existing = list.find((item) => item.symbol === apiSymbol);
  if (existing) {
    if (threshold !== null) existing.threshold = threshold;
    return existing;
  }
  const entry = {
    symbol: apiSymbol,
    threshold,
    lastPrice: null,
    addedAt: new Date().toISOString(),
  };
  list.push(entry);
  return entry;
}

/** Removes a symbol from a user's watchlist. Returns true if something was removed. */
export async function removeFromWatchlist(userId, apiSymbol) {
  const list = getUserList(userId);
  const index = list.findIndex((item) => item.symbol === apiSymbol);
  if (index === -1) return false;
  list.splice(index, 1);
  return true;
}

/** Returns a single user's watchlist. */
export async function listWatchlist(userId) {
  return [...getUserList(userId)];
}

/** Returns ALL users' watchlists as [{ userId, items }] — used by the alert-check cron. */
export async function getAllWatchlists() {
  return [...store.entries()].map(([userId, items]) => ({ userId, items }));
}

/** Updates the last-observed price for a watched symbol (used for threshold-crossing detection). */
export async function updateLastPrice(userId, apiSymbol, price) {
  const list = getUserList(userId);
  const item = list.find((i) => i.symbol === apiSymbol);
  if (item) item.lastPrice = price;
}

/** Sets or clears the alert threshold for a watched symbol. */
export async function setThreshold(userId, apiSymbol, threshold) {
  const list = getUserList(userId);
  const item = list.find((i) => i.symbol === apiSymbol);
  if (item) item.threshold = threshold;
  return item ?? null;
}
