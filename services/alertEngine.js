/**
 * services/alertEngine.js
 *
 * Core alert logic, deliberately decoupled from Telegram: it accepts a
 * `notify(userId, message)` function rather than importing the Telegram
 * bot directly. This keeps the engine testable and means Phase 3
 * (telegram/bot.js) just plugs its send function in — no changes needed here.
 */
import { getAllWatchlists, updateLastPrice } from './watchlist.js';
import { getQuotes } from './marketData.js';
import { recordAlert } from './alertHistory.js';
import { formatPrice, formatChangePercent, formatTimeUTC, toDisplaySymbol } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

/**
 * Checks every watched symbol for every user and fires notify() when a
 * user-defined threshold is crossed (in either direction) since the last check.
 *
 * @param {(userId: string, message: string) => Promise<void>} notify
 * @returns {Promise<{checked: number, alertsSent: number}>}
 */
export async function checkAllAlerts(notify) {
  const watchlists = await getAllWatchlists();

  // Gather every distinct symbol across all users so we hit the market-data
  // API once per symbol, not once per (user, symbol) pair.
  const allSymbols = watchlists.flatMap(({ items }) => items.map((i) => i.symbol));
  if (allSymbols.length === 0) {
    return { checked: 0, alertsSent: 0 };
  }

  const quotes = await getQuotes(allSymbols);
  let checked = 0;
  let alertsSent = 0;

  for (const { userId, items } of watchlists) {
    for (const item of items) {
      checked += 1;
      const quote = quotes[item.symbol];

      if (!quote) {
        logger.warn('Skipping alert check - no quote available', { symbol: item.symbol });
        continue;
      }

      if (item.threshold !== null && item.threshold !== undefined) {
        const crossed = didCrossThreshold(item.lastPrice, quote.price, item.threshold);
        if (crossed) {
          try {
            await notify(userId, formatAlertMessage(item.symbol, quote, item.threshold));
            await recordAlert(userId, {
              symbol: item.symbol,
              threshold: item.threshold,
              price: quote.price,
              changePercent: quote.changePercent,
            });
            alertsSent += 1;
          } catch (err) {
            logger.error('Failed to send alert notification', { userId, symbol: item.symbol, error: err.message });
          }
        }
      }

      await updateLastPrice(userId, item.symbol, quote.price);
    }
  }

  return { checked, alertsSent };
}

/**
 * A crossing is detected when the previous price and current price fall on
 * opposite sides of the threshold. Returns false (no alert) if there's no
 * previous price yet - we need two data points to know direction.
 */
function didCrossThreshold(lastPrice, currentPrice, threshold) {
  if (lastPrice === null || lastPrice === undefined) return false;
  const wasBelow = lastPrice < threshold;
  const isBelow = currentPrice < threshold;
  return wasBelow !== isBelow;
}

function formatAlertMessage(apiSymbol, quote, threshold) {
  const lines = [
    `🚨 Alert`,
    `${apiSymbol} crossed ${threshold}`,
    ``,
    `Current Price:`,
    formatPrice(quote.price, apiSymbol),
    ``,
    `Change:`,
    formatChangePercent(quote.changePercent),
    ``,
    `Time:`,
    formatTimeUTC(quote.timestamp),
  ];

  if (apiSymbol.includes('NGN')) {
    lines.push('', 'ℹ️ Official interbank rate. Parallel market typically trades a few % higher.');
  }

  return lines.join('\n');
}
