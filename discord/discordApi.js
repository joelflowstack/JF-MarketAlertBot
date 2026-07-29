/**
 * discord/discordApi.js
 *
 * Thin wrapper around Discord's REST API for the two things we need outside
 * of responding to interactions directly: sending a DM (used as the
 * alert/daily-summary notify function) and registering slash commands.
 * Deliberately just axios calls, not the full discord.js Client - we never
 * need a persistent Gateway connection (see discord/interactions.js for why).
 */
import axios from 'axios';
import { logger } from '../utils/logger.js';

const API_BASE = 'https://discord.com/api/v10';

function authHeaders() {
  return { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` };
}

/**
 * Sends a Discord user a direct message. Discord requires opening/fetching
 * a DM channel first, then posting to it - two calls, same as most REST
 * chat platforms that don't let you message a user ID directly.
 */
export async function sendDiscordMessage(userId, message) {
  const dmChannel = await axios.post(
    `${API_BASE}/users/@me/channels`,
    { recipient_id: userId },
    { headers: authHeaders() }
  );

  await axios.post(
    `${API_BASE}/channels/${dmChannel.data.id}/messages`,
    { content: message },
    { headers: authHeaders() }
  );
}

/**
 * Registers (or updates) the bot's global slash commands. Global commands
 * can take up to an hour to propagate on first registration - that's a
 * Discord platform behavior, not something our code controls. Run via
 * `npm run discord:register` after setting DISCORD_BOT_TOKEN and
 * DISCORD_APPLICATION_ID - see discord/registerCommands.js.
 */
export async function registerGlobalCommands(applicationId, commands) {
  const res = await axios.put(`${API_BASE}/applications/${applicationId}/commands`, commands, {
    headers: authHeaders(),
  });
  logger.info('Registered Discord slash commands', { count: res.data.length });
  return res.data;
}
