/**
 * telegram/commands.js
 *
 * One handler per command, plus inline-keyboard buttons for the common
 * actions (view watchlist, remove an item, help) so people don't have to
 * remember/type every command by hand. All real logic still lives in
 * services/ - these just parse input, call the service, and format a reply.
 *
 * We use ctx.chat.id (not ctx.from.id) as the watchlist key, so it works
 * the same way whether the user talks to the bot in a DM or in a group/channel.
 */
import { Markup } from 'telegraf';
import { addToWatchlist, removeFromWatchlist, listWatchlist } from '../services/watchlist.js';
import { getQuote } from '../services/marketData.js';
import { toApiSymbol, toDisplaySymbol, formatPrice, formatChangePercent, formatTimeUTC } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

const MAIN_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('👀 My Watchlist', 'menu:list'), Markup.button.callback('📊 Check a Price', 'menu:price')],
  [Markup.button.callback('❓ Help', 'menu:help')],
]);

export function registerCommands(bot) {
  bot.start(handleStart);
  bot.help(handleHelp);
  bot.command('watch', handleWatch);
  bot.command('list', handleList);
  bot.command('remove', handleRemove);
  bot.command('price', handlePrice);
  bot.command('id', handleId);

  // Inline keyboard button handlers
  bot.action('menu:list', handleListCallback);
  bot.action('menu:help', handleHelpCallback);
  bot.action('menu:price', handlePriceCallback);
  bot.action(/^remove:(.+)$/, handleRemoveCallback);
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
      'Try /watch EURUSD 1.1800 to get started, or use the buttons below.',
    ].join('\n'),
    MAIN_MENU
  );
}

async function handleHelp(ctx) {
  await ctx.reply(helpText(), MAIN_MENU);
}

async function handleHelpCallback(ctx) {
  await ctx.answerCbQuery();
  await ctx.reply(helpText(), MAIN_MENU);
}

function helpText() {
  return [
    '📖 Commands',
    '',
    '/watch SYMBOL [threshold] — add an asset to your watchlist, optionally with an alert price',
    '   e.g. /watch EURUSD 1.1800   or   /watch BTCUSD',
    "/list — show everything you're watching",
    '/remove SYMBOL — stop watching an asset',
    '/price SYMBOL — get the current price, daily high/low, and 24h change',
    '/id — get your Chat ID (for logging into the web dashboard)',
    '',
    'Supported symbols: EURUSD, XAUUSD (gold), BTCUSD, and more forex/crypto pairs — plus stock indices like SPX, DJI, IXIC, NDX, RUT.',
  ].join('\n');
}

async function handleWatch(ctx) {
  const args = ctx.message.text.trim().split(/\s+/).slice(1);
  const [rawSymbol, rawThreshold] = args;

  if (!rawSymbol) {
    return ctx.reply('Usage: /watch SYMBOL [threshold]\nExample: /watch EURUSD 1.1800');
  }

  const apiSymbol = toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    return ctx.reply(`I don't recognize "${rawSymbol}". Try a pair like EURUSD/XAUUSD/BTCUSD, or an index like SPX/DJI.`);
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

/** Builds the watchlist message text + a remove button per item. Shared by /list and the menu button. */
async function buildWatchlistView(userId) {
  const items = await listWatchlist(userId);

  if (items.length === 0) {
    return { text: "You're not watching anything yet. Try /watch EURUSD 1.1800 to get started.", keyboard: null };
  }

  const lines = items.map((item) => {
    const symbol = toDisplaySymbol(item.symbol);
    const thresholdText = item.threshold !== null ? `alert at ${item.threshold}` : 'no alert set';
    return `• ${symbol} — ${thresholdText}`;
  });

  const removeButtons = items.map((item) => [
    Markup.button.callback(`🗑 Remove ${toDisplaySymbol(item.symbol)}`, `remove:${item.symbol}`),
  ]);

  return {
    text: ['👀 Your watchlist:', '', ...lines].join('\n'),
    keyboard: Markup.inlineKeyboard(removeButtons),
  };
}

async function handleList(ctx) {
  const { text, keyboard } = await buildWatchlistView(String(ctx.chat.id));
  await ctx.reply(text, keyboard ?? undefined);
}

async function handleListCallback(ctx) {
  await ctx.answerCbQuery();
  const { text, keyboard } = await buildWatchlistView(String(ctx.chat.id));
  await ctx.reply(text, keyboard ?? undefined);
}

async function handleRemoveCallback(ctx) {
  const apiSymbol = ctx.match[1];
  const removed = await removeFromWatchlist(String(ctx.chat.id), apiSymbol);
  await ctx.answerCbQuery(removed ? `Removed ${toDisplaySymbol(apiSymbol)}` : 'Already removed');

  // Refresh the message in place so the button list updates live instead of
  // leaving a stale button around for an item that no longer exists.
  const { text, keyboard } = await buildWatchlistView(String(ctx.chat.id));
  await ctx.editMessageText(text, keyboard ?? undefined).catch(() => {});
}

async function handlePriceCallback(ctx) {
  await ctx.answerCbQuery();
  await ctx.reply('Which symbol? Send it like this: /price EURUSD');
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
    const lines = [
      `📊 ${toDisplaySymbol(apiSymbol)}`,
      `Price: ${formatPrice(quote.price, apiSymbol)}`,
      `High: ${formatPrice(quote.high, apiSymbol)}`,
      `Low: ${formatPrice(quote.low, apiSymbol)}`,
      `24h Change: ${formatChangePercent(quote.changePercent)}`,
      `Time: ${formatTimeUTC(quote.timestamp)}`,
    ];

    // NGN pairs: our data source reports the official/interbank (NFEM) rate,
    // which typically trades at a few percent below the parallel/street rate
    // most people actually transact at. Say so, rather than implying this is
    // the number you'll get from a street dealer.
    if (apiSymbol.includes('NGN')) {
      lines.push('', 'ℹ️ Official interbank rate. Parallel market typically trades a few % higher.');
    }

    await ctx.reply(lines.join('\n'));
  } catch (err) {
    logger.error('Failed to fetch price for /price command', { symbol: apiSymbol, error: err.message });
    await ctx.reply(`Sorry, I couldn't fetch a price for ${toDisplaySymbol(apiSymbol)} right now. Please try again shortly.`);
  }
}
