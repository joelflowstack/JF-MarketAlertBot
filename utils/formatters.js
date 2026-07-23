/**
 * utils/formatters.js
 * Small, pure helper functions shared across the backend, the Telegram bot,
 * and (indirectly, via API responses) the dashboard.
 */

/**
 * Users type symbols without a slash (EURUSD, XAUUSD, BTCUSD) for forex/metal/
 * crypto pairs, or a bare ticker (SPX, DJI) for stock indices.
 * Twelve Data expects "EUR/USD" for pairs, but indices are passed as-is.
 *
 * Known index tickers are an explicit allowlist rather than "anything that
 * isn't 6 letters" - that keeps obvious typos (e.g. "EURUS") from silently
 * being sent to the API as if they were a valid index and returning a
 * confusing error instead of our own clear "unrecognized symbol" message.
 * Add more here as needed - this is the only place symbol support changes.
 */
const KNOWN_INDICES = new Set(['SPX', 'DJI', 'IXIC', 'NDX', 'RUT']);

export function toApiSymbol(userInput) {
  const clean = userInput.trim().toUpperCase().replace(/[^A-Z]/g, '');

  if (KNOWN_INDICES.has(clean)) {
    return clean;
  }

  if (clean.length !== 6) {
    return null; // signals "unrecognized symbol format" to the caller
  }
  return `${clean.slice(0, 3)}/${clean.slice(3)}`;
}

/** Inverse of toApiSymbol, for display purposes: "EUR/USD" -> "EURUSD" */
export function toDisplaySymbol(apiSymbol) {
  return apiSymbol.replace('/', '');
}

/** Formats a price with sensible decimal places for forex vs. crypto vs. metals */
export function formatPrice(price, apiSymbol) {
  const num = Number(price);
  if (Number.isNaN(num)) return String(price);
  // BTC and other high-value assets: 2 decimals. Forex/metals: keep more precision.
  const decimals = num >= 100 ? 2 : 4;
  return num.toFixed(decimals);
}

/** Formats a signed percentage change, e.g. +0.54% / -1.20% */
export function formatChangePercent(changePercent) {
  const num = Number(changePercent);
  if (Number.isNaN(num)) return 'N/A';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

/** Formats a timestamp (seconds or ms or ISO) as HH:MM UTC */
export function formatTimeUTC(timestamp) {
  const date =
    typeof timestamp === 'number'
      ? new Date(timestamp * (timestamp < 1e12 ? 1000 : 1))
      : new Date(timestamp);
  return `${date.toISOString().slice(11, 16)} UTC`;
}
