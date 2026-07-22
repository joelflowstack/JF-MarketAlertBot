/**
 * telegram/bot.js
 *
 * Creates and configures the single Telegraf bot instance used by:
 *   - api/index.js       -> webhook mode, for production on Vercel
 *   - telegram/localDev.js -> polling mode, for quick local testing (no public URL needed)
 *
 * Also exports sendTelegramMessage(), which the alert engine (services/alertEngine.js)
 * calls as its `notify` callback - see api/index.js's /api/cron/check-alerts route.
 */
import { Telegraf } from 'telegraf';
import { registerCommands } from './commands.js';
import { logger } from '../utils/logger.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  logger.warn('TELEGRAM_BOT_TOKEN is not set - the bot will not be able to connect to Telegram');
}

// A placeholder string avoids Telegraf throwing at import time when the env
// var is missing (e.g. during a build step) - real calls will still fail
// clearly if the token was never actually provided.
export const bot = new Telegraf(token || 'unset-telegram-bot-token');

registerCommands(bot);

bot.catch((err, ctx) => {
  logger.error('Unhandled Telegraf error', { updateType: ctx?.updateType, error: err.message });
});

/** The notify() callback the alert engine calls to push a message to a user/chat. */
export async function sendTelegramMessage(chatId, message) {
  await bot.telegram.sendMessage(chatId, message);
}

/** Local dev only: long polling, so you can test commands without deploying or exposing a public URL. */
export function launchPolling() {
  bot.launch();
  logger.info('Telegram bot launched in POLLING mode (local development)');
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
