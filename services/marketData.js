/**
 * services/marketData.js
 *
 * Thin adapter around Twelve Data's REST API. This is the ONLY file that
 * knows about Twelve Data's request/response shape — if we ever add a
 * fallback provider (e.g. exchangerate.host, Finnhub) or switch providers,
 * only this file changes. Everything else in the app just calls getQuote().
 *
 * Twelve Data free tier: 800 requests/day, 8 requests/minute.
 * Docs: https://twelvedata.com/docs#quote
 */
import axios from 'axios';
import { toApiSymbol } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://api.twelvedata.com';

// Simple in-memory cache to avoid burning API credits when multiple users
// watch the same symbol or the dashboard polls frequently. 20s TTL is a
// reasonable tradeoff for a "near real-time" demo without tripping rate limits.
const CACHE_TTL_MS = 20_000;
const quoteCache = new Map(); // apiSymbol -> { data, expiresAt }

/**
 * Fetches a normalized quote for a symbol.
 * @param {string} rawSymbol - user-facing symbol, e.g. "EURUSD" or "EUR/USD"
 * @returns {Promise<{symbol: string, price: number, high: number, low: number, changePercent: number, timestamp: number}>}
 */
export async function getQuote(rawSymbol) {
  const apiSymbol = rawSymbol.includes('/') ? rawSymbol.toUpperCase() : toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    throw new Error(`Unrecognized symbol format: "${rawSymbol}"`);
  }

  const cached = quoteCache.get(apiSymbol);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error('TWELVE_DATA_API_KEY is not set');
  }

  try {
    const response = await axios.get(`${BASE_URL}/quote`, {
      params: { symbol: apiSymbol, apikey: apiKey },
      timeout: 8000,
    });

    const raw = response.data;

    // Twelve Data returns { code, message } (no "status" field) on errors
    if (raw.code && raw.code !== 200) {
      throw new Error(raw.message || 'Twelve Data returned an error');
    }

    const data = {
      symbol: apiSymbol,
      price: parseFloat(raw.close ?? raw.price),
      high: parseFloat(raw.high),
      low: parseFloat(raw.low),
      changePercent: parseFloat(raw.percent_change),
      timestamp: raw.timestamp ?? Math.floor(Date.now() / 1000),
    };

    quoteCache.set(apiSymbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch (err) {
    logger.error('Failed to fetch quote from Twelve Data', {
      symbol: apiSymbol,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Fetches quotes for multiple symbols, tolerating individual failures so one
 * bad/rate-limited symbol doesn't take down a whole watchlist check.
 * @param {string[]} symbols
 * @returns {Promise<Record<string, object|null>>} map of symbol -> quote (or null on failure)
 */
export async function getQuotes(symbols) {
  const uniqueSymbols = [...new Set(symbols)];
  const results = await Promise.allSettled(uniqueSymbols.map((s) => getQuote(s)));

  return uniqueSymbols.reduce((acc, symbol, i) => {
    const result = results[i];
    acc[symbol] = result.status === 'fulfilled' ? result.value : null;
    return acc;
  }, {});
}
