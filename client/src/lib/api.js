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
  getPrice: (symbol) => request(`/api/price/${symbol}`),
  getWatchlist: (userId) => request(`/api/watchlist/${userId}`),
  addToWatchlist: (userId, symbol, threshold) =>
    request('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ userId, symbol, threshold }),
    }),
  removeFromWatchlist: (userId, symbol) =>
    request(`/api/watchlist/${userId}/${symbol}`, { method: 'DELETE' }),
  getRecentAlerts: (userId) => request(`/api/alerts/${userId}`),
  getAdminStats: () => request('/api/admin/stats'),
};
