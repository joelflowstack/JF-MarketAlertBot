# Global Market Alert Bot — MVP

Telegram bot + web dashboard that watches forex/commodity/crypto/index prices and pushes
threshold alerts. Built to run entirely on free tiers (Vercel, Firebase Firestore, Telegram
Bot API, Twelve Data) for a client demo.

## Folder structure

```
market-alert-bot/
├── api/                  # Single Express app, exported as ONE Vercel serverless function
│   ├── index.js          #   -> mounts all routes below via serverless-http
│   └── cron/
│       └── check-alerts.js   # handler invoked on a schedule (see "Alert scheduling" below)
├── services/              # Business logic, framework-agnostic, reused by api/ and telegram/
│   ├── marketData.js       # Twelve Data client (forex, crypto, indices, commodities)
│   ├── watchlist.js        # Firestore CRUD for user watchlists
│   └── alertEngine.js      # Threshold comparison + notification dispatch
├── telegram/               # Telegraf bot: command handlers, webhook entry point
│   ├── bot.js
│   └── commands.js
├── firebase/               # Firebase Admin SDK init (server-side only)
│   └── admin.js
├── utils/                  # Small shared helpers (formatting, logging)
├── client/                 # React + Vite + Tailwind dashboard (separate app, own package.json)
│   └── src/
│       ├── pages/          # Login, Dashboard, Watchlist, Alerts, Settings, Admin
│       ├── components/     # Reusable cards, status badges, tables, toasts
│       ├── hooks/          # useAuth, useWatchlist, usePrices, useAlerts
│       ├── context/        # Auth/session context
│       └── lib/            # Firebase client SDK init, API wrapper
├── vercel.json
├── .env.example
└── package.json
```

**Why one Express app instead of many small serverless functions?** Vercel's free (Hobby)
plan still gives generous function-invocation limits, but keeping one Express app (wrapped
with `serverless-http`) mounted at `api/index.js` means we get real Express routing,
middleware, and error handling — closer to "production-quality Node/Express" — while still
deploying as a single Vercel Function. It's also trivial to later split into multiple
functions if a route needs its own scaling/timeout profile.

## Data source decision

| Data need | Provider | Why |
|---|---|---|
| Forex (EUR/USD, etc.) | **Twelve Data** | Free tier covers forex, crypto, indices, and commodities under one unified API — one API key instead of four |
| Commodities (XAU/USD gold) | **Twelve Data** | Gold/silver are quoted as forex-style pairs (`XAU/USD`), no separate provider needed |
| Crypto (BTC/USD) | **Twelve Data** | Same API, `BTC/USD` symbol |
| Stock indices (future) | **Twelve Data** | Same API, e.g. `SPX`, `NDX` |

Twelve Data free tier: 800 API credits/day, 8 requests/minute. For an MVP demo watching a
handful of symbols on a 1-minute poll cycle, this comfortably covers a live demo without
hitting limits. `services/marketData.js` is written as a thin adapter so swapping/adding a
provider later (e.g. Finnhub for indices, exchangerate.host as a forex fallback) only means
changing one file — the rest of the app calls `getQuote(symbol)`.

## Alert scheduling (important free-tier constraint)

Vercel's **Hobby plan restricts native Cron Jobs to once per day** — it will not deploy a
per-minute `vercel.json` cron. To satisfy the "check every minute" requirement without a
paid plan, the architecture exposes a normal HTTP endpoint,
`POST /api/cron/check-alerts`, protected by a `CRON_SECRET` bearer token, and we trigger it
externally once a minute using a **free external scheduler** (e.g. cron-job.org, or a
GitHub Actions scheduled workflow as an alternative). This is a common, well-documented
workaround and keeps the whole stack on free tiers. We'll wire this up in the deployment
phase — no code changes needed later, just pointing the external scheduler at the URL.

## Environment variables

See `.env.example`. Never hardcoded; loaded via `dotenv` locally and Vercel's project
environment variables in production.

## Status

**Phase 1 complete:** architecture, folder structure, and dependency manifests are in place.
Next: install dependencies and confirm the toolchain resolves cleanly, then move to Phase 2
(backend).
