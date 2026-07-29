/**
 * src/lib/api.js
 *
 * Thin fetch wrapper. In dev, requests to /api/* are proxied to localhost:3000
 * (see vite.config.js). In production, set VITE_API_BASE_URL to your deployed
 * backend's URL (e.g. https://jf-market-alert-bot.vercel.app) as an
 * environment variable in your dashboard's Vercel project settings.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  health: () => request('/api/health'),
  verifyTelegramInitData: (initData) =>
    request('/api/telegram/verify-init-data', { method: 'POST', body: JSON.stringify({ initData }) }),
  getPrice: (symbol) => request(`/api/price/${symbol}`),
  // Batched - always prefer this over calling getPrice() in a loop, so N
  // watched symbols means one request instead of N (see server.js/marketData.js
  // for why that matters on Twelve Data's free tier).
  getPrices: (symbols) => request(`/api/prices?symbols=${symbols.join(',')}`),
  getWatchlist: (userId) => request(`/api/watchlist/${userId}`),
  addToWatchlist: (userId, symbol, threshold) =>
    request('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ userId, symbol, threshold }),
    }),
  removeFromWatchlist: (userId, symbol) =>
    request(`/api/watchlist/${userId}/${symbol}`, { method: 'DELETE' }),
  getRecentAlerts: (userId) => request(`/api/alerts/${userId}`),
  getSettings: (userId) => request(`/api/settings/${userId}`),
  updateSettings: (userId, partialSettings) =>
    request('/api/settings', { method: 'POST', body: JSON.stringify({ userId, ...partialSettings }) }),
  // chatId is sent so the backend can verify it against ADMIN_CHAT_IDS -
  // access control is enforced server-side, this is just how the caller's
  // identity gets there.
  getAdminStats: (chatId) => request(`/api/admin/stats?chatId=${chatId}`),
};
