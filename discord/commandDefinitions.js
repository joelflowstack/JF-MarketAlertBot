/**
 * discord/commandDefinitions.js
 *
 * The slash command definitions Discord needs registered before it'll show
 * these commands to users. Shared by discord/registerCommands.js (optional
 * local CLI script) and the /api/discord/register-commands route in
 * server.js (browser-triggerable, no local files needed) - one source of
 * truth either way.
 */

// Option type numbers, per Discord's API: STRING = 3, NUMBER = 10.
const STRING = 3;
const NUMBER = 10;

export const discordCommands = [
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
