/**
 * discord/registerCommands.js
 *
 * OPTIONAL local CLI alternative - if you have Node installed locally and
 * prefer running this from your own machine:
 *
 *   npm run discord:register
 *
 * (reads DISCORD_BOT_TOKEN / DISCORD_APPLICATION_ID from a local .env file)
 *
 * If you don't have local files/Node set up at all, use the browser-only
 * route instead: GET /api/discord/register-commands?secret=YOUR_CRON_SECRET
 * on your deployed backend - see server.js. Both do the exact same thing,
 * using the same command list from discord/commandDefinitions.js.
 *
 * Global commands can take up to ~1 hour to appear everywhere the first
 * time - that's normal Discord platform behavior, not a bug.
 */
import 'dotenv/config';
import { registerGlobalCommands } from './discordApi.js';
import { discordCommands } from './commandDefinitions.js';

const applicationId = process.env.DISCORD_APPLICATION_ID;
if (!applicationId) {
  console.error('DISCORD_APPLICATION_ID is not set - cannot register commands.');
  process.exit(1);
}

registerGlobalCommands(applicationId, discordCommands)
  .then(() => {
    console.log(`Registered ${discordCommands.length} commands. They may take up to an hour to appear everywhere.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to register commands:', err.response?.data || err.message);
    process.exit(1);
  });
