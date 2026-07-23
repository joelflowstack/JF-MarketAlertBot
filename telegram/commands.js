/**
 * telegram/commands.js
 *
 * One handler per command. Kept thin - all real logic lives in services/,
 * these just parse Telegram input, call the service, and format a reply.
 *
 * We use ctx.chat.id (not ctx.from.id) as the watchlist key, so it works
 * the same way whether the user talks to the bot in a DM or in a group/channel.
 */
import { addToWatchlist, removeFromWatchlist, listWatchlist } from '../services/watchlist.js';
import { getQuote } from '../services/marketData.js';
import { toApiSymbol, toDisplaySymbol, formatPrice, formatChangePercent, formatTimeUTC } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

export function registerCommands(bot) {
  bot.start(handleStart);
  bot.help(handleHelp);
  bot.command('watch', handleWatch);
  bot.command('list', handleList);
  bot.command('remove', handleRemove);
  bot.command('price', handlePrice);
  bot.command('id', handleId);
}

async function handleId(ctx) {
  await ctx.reply(`Your Chat ID is: ${ctx.chat.id}\n\nUse this to log into the web dashboard.`);
}

async function handleStart(ctx) {
  await ctx.reply(
    [
      '👋 Welcome to Global Market Alert Bot!',
      '',
      "I'll watch forex, gold, and crypto prices for you and ping you the moment your price levels hit.",
      '',
      'Try /watch EURUSD 1.1800 to get started, or /help to see everything I can do.',
    ].join('\n')
  );
}

async function handleHelp(ctx) {
  await ctx.reply(
    [
      '📖 Commands',
      '',
      '/watch SYMBOL [threshold] — add an asset to your watchlist, optionally with an alert price',
      '   e.g. /watch EURUSD 1.1800   or   /watch BTCUSD',
      '/list — show everything you\'re watching',
      '/remove SYMBOL — stop watching an asset',
      '/price SYMBOL — get the current price, daily high/low, and 24h change',
      '/id — get your Chat ID (for logging into the web dashboard)',
      '',
      'Supported symbols (MVP): EURUSD, XAUUSD (gold), BTCUSD — more coming soon.',
    ].join('\n')
  );
}

async function handleWatch(ctx) {
  const args = ctx.message.text.trim().split(/\s+/).slice(1);
  const [rawSymbol, rawThreshold] = args;

  if (!rawSymbol) {
    return ctx.reply('Usage: /watch SYMBOL [threshold]\nExample: /watch EURUSD 1.1800');
  }

  const apiSymbol = toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    return ctx.reply(`I don't recognize "${rawSymbol}". Try something like EURUSD, XAUUSD, or BTCUSD.`);
  }

  let threshold = null;
  if (rawThreshold !== undefined) {
    threshold = parseFloat(rawThreshold);
    if (Number.isNaN(threshold)) {
      return ctx.reply(`"${rawThreshold}" doesn't look like a valid price. Example: /watch EURUSD 1.1800`);
    }
  }

  await addToWatchlist(String(ctx.chat.id), apiSymbol, threshold);

  const thresholdNote = threshold !== null
    ? `I'll alert you when it crosses ${threshold}.`
    : "No alert price set yet - I'll just track it. Add one anytime with /watch " + rawSymbol.toUpperCase() + ' <price>.';

  await ctx.reply(`✅ Now watching ${toDisplaySymbol(apiSymbol)}. ${thresholdNote}`);
}

async function handleList(ctx) {
  const items = await listWatchlist(String(ctx.chat.id));
  if (items.length === 0) {
    return ctx.reply("You're not watching anything yet. Try /watch EURUSD 1.1800 to get started.");
  }

  const lines = items.map((item) => {
    const symbol = toDisplaySymbol(item.symbol);
    const thresholdText = item.threshold !== null ? `alert at ${item.threshold}` : 'no alert set';
    return `• ${symbol} — ${thresholdText}`;
  });

  await ctx.reply(['👀 Your watchlist:', '', ...lines].join('\n'));
}

async function handleRemove(ctx) {
  const args = ctx.message.text.trim().split(/\s+/).slice(1);
  const rawSymbol = args[0];

  if (!rawSymbol) {
    return ctx.reply('Usage: /remove SYMBOL\nExample: /remove EURUSD');
  }

  const apiSymbol = toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    return ctx.reply(`I don't recognize "${rawSymbol}".`);
  }

  const removed = await removeFromWatchlist(String(ctx.chat.id), apiSymbol);
  await ctx.reply(
    removed ? `🗑️ Removed ${toDisplaySymbol(apiSymbol)} from your watchlist.` : `${toDisplaySymbol(apiSymbol)} wasn't in your watchlist.`
  );
}

async function handlePrice(ctx) {
  const args = ctx.message.text.trim().split(/\s+/).slice(1);
  const rawSymbol = args[0];

  if (!rawSymbol) {
    return ctx.reply('Usage: /price SYMBOL\nExample: /price EURUSD');
  }

  const apiSymbol = toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    return ctx.reply(`I don't recognize "${rawSymbol}".`);
  }

  try {
    const quote = await getQuote(apiSymbol);
    await ctx.reply(
      [
        `📊 ${toDisplaySymbol(apiSymbol)}`,
        `Price: ${formatPrice(quote.price, apiSymbol)}`,
        `High: ${formatPrice(quote.high, apiSymbol)}`,
        `Low: ${formatPrice(quote.low, apiSymbol)}`,
        `24h Change: ${formatChangePercent(quote.changePercent)}`,
        `Time: ${formatTimeUTC(quote.timestamp)}`,
      ].join('\n')
    );
  } catch (err) {
    logger.error('Failed to fetch price for /price command', { symbol: apiSymbol, error: err.message });
    await ctx.reply(`Sorry, I couldn't fetch a price for ${toDisplaySymbol(apiSymbol)} right now. Please try again shortly.`);
  }
}
