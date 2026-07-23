/**
 * services/alertHistory.js
 *
 * Records fired alerts so the dashboard's "Recent Alerts" view and the
 * admin panel's "Alerts sent" counter have real data to show, even before
 * Firestore is wired in. Same in-memory-now / Firestore-later pattern as
 * services/watchlist.js - same function signatures will just be backed by
 * a real database in Phase 5.
 */

const MAX_HISTORY_PER_USER = 50;

// userId -> [{ symbol, threshold, price, changePercent, timestamp }, ...] (newest first)
const history = new Map();

/** Records a fired alert. Called by services/alertEngine.js right after a successful notify(). */
export async function recordAlert(userId, alert) {
  if (!history.has(userId)) history.set(userId, []);
  const list = history.get(userId);
  list.unshift({ ...alert, sentAt: new Date().toISOString() });
  if (list.length > MAX_HISTORY_PER_USER) list.length = MAX_HISTORY_PER_USER;
}

/** Returns a user's most recent alerts, newest first. */
export async function getRecentAlerts(userId, limit = 20) {
  return (history.get(userId) ?? []).slice(0, limit);
}

/** Returns the total number of alerts ever sent, across all users - for the admin panel. */
export async function getTotalAlertsSent() {
  let total = 0;
  for (const list of history.values()) total += list.length;
  // Note: this undercounts once any user's list is trimmed at MAX_HISTORY_PER_USER.
  // Fine for an in-memory MVP; Phase 5's Firestore version will keep a true running count.
  return total;
}
