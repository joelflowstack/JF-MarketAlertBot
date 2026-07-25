/**
 * services/marketData.js
 *
 * Thin adapter around Twelve Data's REST API. This is the ONLY file that
 * knows about Twelve Data's request/response shape — if we ever add a
 * fallback provider (e.g. exchangerate.host, Finnhub) or switch providers,
 * only this file changes. Everything else in the app just calls getQuote()
 * or getQuotes().
 *
 * Twelve Data free tier: 800 credits/day, 8 requests/minute. Each symbol
 * checked costs 1 credit, REGARDLESS of whether it's batched into one HTTP
 * request or fetched individually - batching only helps against the
 * 8-requests-PER-MINUTE cap, not the 800-credits-PER-DAY cap. With N symbols
 * watched continuously, checking every X minutes costs N * (1440/X) credits
 * a day - for that to stay under 800, X must be at least ~1.8*N minutes.
 * See server.js / the cron setup notes for how this shapes the check interval.
 * Docs: https://twelvedata.com/docs#quote, https://support.twelvedata.com/en/articles/5203360-batch-api-requests
 */
import axios from 'axios';
import { toApiSymbol } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://api.twelvedata.com';

// Shared cache across getQuote() AND getQuotes() - every caller (the bot's
// /price command, the dashboard, and the alert-check cron) reads and writes
// the same cache, so within one TTL window a symbol is only ever actually
// fetched from Twelve Data once, no matter how many different things asked
// for it. TTL is set to slightly longer than the cron's check interval so
// that in steady state, ONLY the cron originates fresh credit-consuming
// calls - dashboard/bot reads in between are free cache hits.
const CACHE_TTL_MS = 90_000;
const quoteCache = new Map(); // apiSymbol -> { data, expiresAt }

function normalizeQuoteEntry(entry, apiSymbol) {
  return {
    symbol: apiSymbol,
    price: parseFloat(entry.close ?? entry.price),
    high: parseFloat(entry.high),
    low: parseFloat(entry.low),
    changePercent: parseFloat(entry.percent_change),
    // NOT entry.timestamp: Twelve Data's own timestamp field appears to
    // reflect something other than "right now" (observed repeatedly
    // returning midnight UTC regardless of actual fetch time). Since what
    // the user actually wants to know is "when was this price fetched,"
    // our own capture time is both simpler and correct - accurate to
    // within the cache window (see CACHE_TTL_MS above).
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Fetches a normalized quote for a single symbol. Internally just delegates
 * to getQuotes() so single lookups and batch lookups always share the exact
 * same caching/fetching logic - one code path, not two to keep in sync.
 * @param {string} rawSymbol - user-facing symbol, e.g. "EURUSD" or "EUR/USD"
 */
export async function getQuote(rawSymbol) {
  const apiSymbol = rawSymbol.includes('/') ? rawSymbol.toUpperCase() : toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    throw new Error(`Unrecognized symbol format: "${rawSymbol}"`);
  }

  const results = await getQuotes([apiSymbol]);
  const quote = results[apiSymbol];
  if (!quote) {
    throw new Error(`Could not fetch a quote for "${apiSymbol}"`);
  }
  return quote;
}

/**
 * Fetches quotes for multiple symbols in a SINGLE batched HTTP request
 * (Twelve Data supports comma-separated symbols on /quote), rather than one
 * request per symbol. This is what keeps us under the 8-requests-per-minute
 * cap even when watching many symbols - see the module docblock for why it
 * does NOT, by itself, reduce total daily credit usage.
 * @param {string[]} symbols
 * @returns {Promise<Record<string, object|null>>} map of symbol -> quote (or null on failure)
 */
export async function getQuotes(symbols) {
  const uniqueSymbols = [...new Set(symbols)];
  if (uniqueSymbols.length === 0) return {};

  const now = Date.now();
  const results = {};
  const toFetch = [];

  for (const symbol of uniqueSymbols) {
    const cached = quoteCache.get(symbol);
    if (cached && cached.expiresAt > now) {
      results[symbol] = cached.data;
    } else {
      toFetch.push(symbol);
    }
  }

  if (toFetch.length === 0) return results;

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    logger.error('TWELVE_DATA_API_KEY is not set');
    toFetch.forEach((s) => { results[s] = null; });
    return results;
  }

  try {
    const response = await axios.get(`${BASE_URL}/quote`, {
      params: { symbol: toFetch.join(','), apikey: apiKey },
      timeout: 10000,
    });

    const raw = response.data;

    // Twelve Data returns a flat object for a single symbol, but an object
    // keyed by symbol when multiple symbols are requested in one call.
    const isMultiSymbolShape = toFetch.length > 1 || raw[toFetch[0]] !== undefined;

    for (const symbol of toFetch) {
      const entry = isMultiSymbolShape ? raw[symbol] : raw;

      if (!entry || (entry.code && entry.code !== 200)) {
        logger.warn('No usable quote in Twelve Data response', {
          symbol,
          message: entry?.message,
        });
        results[symbol] = null;
        continue;
      }

      const data = normalizeQuoteEntry(entry, symbol);
      quoteCache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      results[symbol] = data;
    }
  } catch (err) {
    logger.error('Failed to fetch batched quotes from Twelve Data', {
      symbols: toFetch,
      error: err.message,
    });
    toFetch.forEach((s) => { results[s] = null; });
  }

  return results;
}
