/**
 * api/index.js
 *
 * The entire backend is one Express app. It's wrapped with serverless-http
 * so Vercel can invoke it as a single Function, but it also runs as a plain
 * Express server locally (`npm start`) for fast iteration.
 *
 * Routes:
 *   GET    /api/health                      liveness check
 *   GET    /api/price/:symbol               current quote for a symbol
 *   GET    /api/watchlist/:userId           a user's watched symbols
 *   POST   /api/watchlist                   add a symbol { userId, symbol, threshold? }
 *   DELETE /api/watchlist/:userId/:symbol   remove a symbol
 *   POST   /api/cron/check-alerts           triggers one alert-check pass (secret-protected)
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import serverless from 'serverless-http';

import { getQuote } from '../services/marketData.js';
import {
  addToWatchlist,
  removeFromWatchlist,
  listWatchlist,
} from '../services/watchlist.js';
import { checkAllAlerts } from '../services/alertEngine.js';
import { toApiSymbol, formatPrice, formatChangePercent, formatTimeUTC } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

const app = express();
app.use(cors());
app.use(express.json());

/** Wraps async route handlers so rejected promises reach Express's error handler. */
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------
app.get(
  '/api/price/:symbol',
  asyncHandler(async (req, res) => {
    const apiSymbol = toApiSymbol(req.params.symbol);
    if (!apiSymbol) {
      return res.status(400).json({ error: `Unrecognized symbol format: "${req.params.symbol}"` });
    }

    const quote = await getQuote(apiSymbol);
    res.json({
      symbol: apiSymbol,
      price: formatPrice(quote.price, apiSymbol),
      high: formatPrice(quote.high, apiSymbol),
      low: formatPrice(quote.low, apiSymbol),
      changePercent: formatChangePercent(quote.changePercent),
      timestamp: formatTimeUTC(quote.timestamp),
    });
  })
);

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------
app.get(
  '/api/watchlist/:userId',
  asyncHandler(async (req, res) => {
    const items = await listWatchlist(req.params.userId);
    res.json({ userId: req.params.userId, items });
  })
);

app.post(
  '/api/watchlist',
  asyncHandler(async (req, res) => {
    const { userId, symbol, threshold } = req.body;
    if (!userId || !symbol) {
      return res.status(400).json({ error: 'userId and symbol are required' });
    }
    const apiSymbol = toApiSymbol(symbol);
    if (!apiSymbol) {
      return res.status(400).json({ error: `Unrecognized symbol format: "${symbol}"` });
    }
    const entry = await addToWatchlist(userId, apiSymbol, threshold ?? null);
    res.status(201).json(entry);
  })
);

app.delete(
  '/api/watchlist/:userId/:symbol',
  asyncHandler(async (req, res) => {
    const apiSymbol = toApiSymbol(req.params.symbol);
    if (!apiSymbol) {
      return res.status(400).json({ error: `Unrecognized symbol format: "${req.params.symbol}"` });
    }
    const removed = await removeFromWatchlist(req.params.userId, apiSymbol);
    if (!removed) {
      return res.status(404).json({ error: 'Symbol not found in watchlist' });
    }
    res.json({ removed: apiSymbol });
  })
);

// ---------------------------------------------------------------------------
// Alert-check cron endpoint
// Triggered every minute by an EXTERNAL scheduler (see README) because
// Vercel's Hobby plan only allows once-a-day native cron jobs.
// ---------------------------------------------------------------------------
app.post(
  '/api/cron/check-alerts',
  asyncHandler(async (req, res) => {
    const providedSecret = req.headers.authorization?.replace('Bearer ', '');
    if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO (Phase 3): replace this stub with the real Telegraf send function,
    // e.g. `import { sendTelegramMessage } from '../telegram/bot.js'`.
    // The alert engine doesn't care what notify() does internally.
    const notify = async (userId, message) => {
      logger.info('ALERT (notifier stub - Telegram wiring lands in Phase 3)', { userId, message });
    };

    const result = await checkAllAlerts(notify);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// Error handler (must be last)
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  logger.error('Unhandled error in request', { path: req.path, error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// Run as a plain server locally; export a serverless handler for Vercel.
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => logger.info(`Server running locally on http://localhost:${PORT}`));
}

export const handler = serverless(app);
export default app;
