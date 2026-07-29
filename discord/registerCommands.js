/**
 * discord/registerCommands.js
 *
 * One-time (or "run again whenever commands change") registration script -
 * Discord doesn't auto-discover commands like Telegraf does; slash commands
 * must be explicitly registered via the REST API before Discord will show
 * them to users. Run locally with:
 *
 *   DISCORD_BOT_TOKEN=... DISCORD_APPLICATION_ID=... npm run discord:register
 *
 * Global commands can take up to ~1 hour to appear everywhere the first
 * time - that's normal Discord platform behavior, not a bug.
 */
import 'dotenv/config';
import { registerGlobalCommands } from './discordApi.js';

// Option type numbers, per Discord's API: STRING = 3, NUMBER = 10.
const STRING = 3;
const NUMBER = 10;

const commands = [
  { name: 'start', description: 'Welcome message and quick intro' },
  { name: 'help', description: 'Show all commands' },
  {
    name: 'watch',
    description: 'Add an asset to your watchlist, optionally with an alert price',
    options: [
      { name: 'symbol', description: 'e.g. EURUSD, XAUUSD, BTCUSD', type: STRING, required: true },
      { name: 'threshold', description: 'Alert price (optional)', type: NUMBER, required: false },
    ],
  },
  { name: 'list', description: "Show everything you're watching" },
  {
    name: 'remove',
    description: 'Stop watching an asset',
    options: [{ name: 'symbol', description: 'e.g. EURUSD', type: STRING, required: true }],
  },
  {
    name: 'price',
    description: 'Get the current price, daily high/low, and 24h change',
    options: [{ name: 'symbol', description: 'e.g. EURUSD', type: STRING, required: true }],
  },
  { name: 'id', description: 'Get your Discord user ID (for logging into the web dashboard)' },
];

const applicationId = process.env.DISCORD_APPLICATION_ID;
if (!applicationId) {
  console.error('DISCORD_APPLICATION_ID is not set - cannot register commands.');
  process.exit(1);
}

registerGlobalCommands(applicationId, commands)
  .then(() => {
    console.log(`Registered ${commands.length} commands. They may take up to an hour to appear everywhere.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to register commands:', err.response?.data || err.message);
    process.exit(1);
  });
