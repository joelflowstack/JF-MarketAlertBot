/**
 * server.js
 *
 * The entire backend is one Express app, at the project root - this exact
 * location (or index.js/app.js, also at root or in src/) is what Vercel's
 * native zero-config Express support looks for. It runs as a plain Express
 * server locally (`npm start`) AND is deployed by Vercel as a single
 * Function with no vercel.json rewrites needed.
 *
 * Routes:
 *   GET    /api/health                      liveness check
 *   POST   /api/telegram/webhook             Telegram webhook (production bot transport)
 *   GET    /api/price/:symbol               current quote for a symbol
 *   GET    /api/watchlist/:userId           a user's watched symbols
 *   POST   /api/watchlist                   add a symbol { userId, symbol, threshold? }
 *   DELETE /api/watchlist/:userId/:symbol   remove a symbol
 *   GET    /api/alerts/:userId              recent alert history for a user
 *   GET    /api/admin/stats                 aggregate stats for the admin panel
 *   POST   /api/cron/check-alerts           triggers one alert-check pass (secret-protected)
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { getQuote } from './services/marketData.js';
import {
  addToWatchlist,
  removeFromWatchlist,
  listWatchlist,
  getAllWatchlists,
} from './services/watchlist.js';
import { checkAllAlerts } from './services/alertEngine.js';
import { getRecentAlerts, getTotalAlertsSent } from './services/alertHistory.js';
import { toApiSymbol, formatPrice, formatChangePercent, formatTimeUTC } from './utils/formatters.js';
import { logger } from './utils/logger.js';
import { bot, sendTelegramMessage } from './telegram/bot.js';

const app = express();
app.use(cors());

const SERVER_STARTED_AT = new Date().toISOString();

// Safety net: without this, an unhandled promise rejection (e.g. a transient
// network error inside Telegraf) crashes the entire Node process on modern
// Node versions, taking the whole API down with it. Log and keep running.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || String(reason) });
});

// ---------------------------------------------------------------------------
// Telegram webhook
// Registered BEFORE express.json() - Telegraf needs to read the raw request
// stream itself, so the global JSON body-parser below must not consume it
// first for this path.
// ---------------------------------------------------------------------------
app.use(
  bot.webhookCallback('/api/telegram/webhook', {
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
  })
);

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
// Alert history (dashboard "Recent Alerts")
// ---------------------------------------------------------------------------
app.get(
  '/api/alerts/:userId',
  asyncHandler(async (req, res) => {
    const alerts = await getRecentAlerts(req.params.userId);
    res.json({ userId: req.params.userId, alerts });
  })
);

// ---------------------------------------------------------------------------
// Admin stats
// ---------------------------------------------------------------------------
app.get(
  '/api/admin/stats',
  asyncHandler(async (req, res) => {
    const watchlists = await getAllWatchlists();
    const totalUsers = watchlists.length;
    const uniqueAssets = new Set(watchlists.flatMap(({ items }) => items.map((i) => i.symbol)));
    const alertsSent = await getTotalAlertsSent();

    res.json({
      totalUsers,
      assetsMonitored: uniqueAssets.size,
      alertsSent,
      botOnline: true,
      serverStartedAt: SERVER_STARTED_AT,
    });
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

    const result = await checkAllAlerts(sendTelegramMessage);
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

// Run as a plain server locally. In production (on Vercel), the app is
// never listen()-ing on a port - Vercel calls the default export directly.
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => logger.info(`Server running locally on http://localhost:${PORT}`));
}

export default app;
