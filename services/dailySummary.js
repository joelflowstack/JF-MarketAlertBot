/**
 * services/dailySummary.js
 *
 * Sends each opted-in user a once-a-day recap of everything on their
 * watchlist - current price, 24h high/low, and 24h change for every symbol
 * they're watching. Triggered once daily by an external scheduler hitting
 * POST /api/cron/daily-summary (see server.js) - same secret-protected
 * pattern as the every-minute alert check in services/alertEngine.js, just
 * on its own separate, much less frequent schedule.
 */
import { getUserIdsWithDailySummaryEnabled } from './settings.js';
import { listWatchlist } from './watchlist.js';
import { getQuotes } from './marketData.js';
import { formatPrice, formatChangePercent, toDisplaySymbol } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

/**
 * @param {{ telegram?: (userId: string, message: string) => Promise<void>, discord?: (userId: string, message: string) => Promise<void> }} notifiers
 * @returns {Promise<{usersChecked: number, sent: number}>}
 */
export async function sendDailySummaries(notifiers) {
  const userIds = await getUserIdsWithDailySummaryEnabled();
  let sent = 0;

  for (const userId of userIds) {
    const items = await listWatchlist(userId);
    if (items.length === 0) continue; // nothing to summarize - skip silently, don't send an empty message

    const symbols = items.map((item) => item.symbol);
    const quotes = await getQuotes(symbols);

    const lines = items.map((item) => {
      const quote = quotes[item.symbol];
      if (!quote) return `${toDisplaySymbol(item.symbol)}: unavailable right now`;
      return [
        `${toDisplaySymbol(item.symbol)}: ${formatPrice(quote.price, item.symbol)} (${formatChangePercent(quote.changePercent)})`,
        `   High: ${formatPrice(quote.high, item.symbol)}  Low: ${formatPrice(quote.low, item.symbol)}`,
      ].join('\n');
    });

    const message = [
      `📅 Daily Summary — ${new Date().toISOString().slice(0, 10)}`,
      '',
      ...lines,
      '',
      'Turn this off anytime in your dashboard Settings.',
    ].join('\n');

    // A user's watchlist items all carry which platform they were added
    // from - use that to pick the right notify function. Defaults to
    // telegram if somehow empty (shouldn't happen, we already checked
    // items.length above).
    const platform = items[0]?.platform || 'telegram';
    const notify = notifiers[platform] || notifiers.telegram;

    try {
      await notify(userId, message);
      sent += 1;
    } catch (err) {
      logger.error('Failed to send daily summary', { userId, platform, error: err.message });
    }
  }

  return { usersChecked: userIds.length, sent };
}
