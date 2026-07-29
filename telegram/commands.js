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
import { suggestThreshold } from '../utils/suggestThreshold.js';
import { logger } from '../utils/logger.js';

const WATCH_CHOICE_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('🔀 Build a Pair', 'menu:pairbuilder')],
  [Markup.button.callback('💱 Ready-made', 'menu:quickadd')],
]);

const MAIN_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('👀 My Watchlist', 'menu:list'), Markup.button.callback('💱 Quick Add', 'menu:quickadd')],
  [Markup.button.callback('🔀 Build a Pair', 'menu:pairbuilder'), Markup.button.callback('📊 Check a Price', 'menu:price')],
  [Markup.button.callback('❓ Help', 'menu:help')],
]);

// Common symbols for the Nigerian market this bot is built around: USD, GBP,
// EUR, and CAD against naira cover the currencies most freelancers/diaspora
// senders actually deal in, plus gold and BTC as widely-watched global assets.
// Add more here as you learn what people actually ask for - this list and
// the /watch command both go through the same toApiSymbol() validation, so
// there's no risk of a button offering a symbol the backend can't handle.
const POPULAR_PAIRS = [
  { label: '🇺🇸 USD/NGN', symbol: 'USDNGN' },
  { label: '🇬🇧 GBP/NGN', symbol: 'GBPNGN' },
  { label: '🇪🇺 EUR/NGN', symbol: 'EURNGN' },
  { label: '🇨🇦 CAD/NGN', symbol: 'CADNGN' },
  { label: '🥇 XAU/USD (Gold)', symbol: 'XAUUSD' },
  { label: '₿ BTC/USD (Bitcoin)', symbol: 'BTCUSD' },
];

function quickAddMenu() {
  const rows = [];
  for (let i = 0; i < POPULAR_PAIRS.length; i += 2) {
    rows.push(
      POPULAR_PAIRS.slice(i, i + 2).map((p) => Markup.button.callback(p.label, `watch:${p.symbol}`))
    );
  }
  rows.push([Markup.button.callback('⬅️ Back', 'menu:back')]);
  return Markup.inlineKeyboard(rows);
}

/**
 * Pair builder: instead of typing a symbol, tap the first currency, then the
 * second - the bot builds the pair in exactly that tap order (tap NGN then
 * USD -> NGN/USD) and immediately shows the same live price-suggestion flow
 * as everywhere else. No server-side session state needed: the first pick
 * travels forward inside the second keyboard's own callback_data, so each
 * tap is a fully self-contained request.
 */
const PICKER_CURRENCIES = ['USD', 'NGN', 'GBP', 'EUR', 'CAD'];

function pairBuilderStep1Keyboard() {
  const buttons = PICKER_CURRENCIES.map((c) => Markup.button.callback(c, `pair1:${c}`));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  rows.push([Markup.button.callback('⬅️ Back', 'menu:back')]);
  return Markup.inlineKeyboard(rows);
}

function pairBuilderStep2Keyboard(firstCurrency) {
  const buttons = PICKER_CURRENCIES.filter((c) => c !== firstCurrency).map((c) =>
    Markup.button.callback(c, `pair2:${firstCurrency}:${c}`)
  );
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  rows.push([Markup.button.callback('⬅️ Start over', 'menu:pairbuilder')]);
  return Markup.inlineKeyboard(rows);
}



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
  bot.action('menu:quickadd', handleQuickAddMenu);
  bot.action('menu:back', handleBackToMenu);
  bot.action(/^remove:(.+)$/, handleRemoveCallback);
  bot.action(/^watch:(.+)$/, handleQuickWatch);
  bot.action(/^setalert:(.+):([\d.]+)$/, handleSetAlertFromSuggestion);
  bot.action('menu:pairbuilder', handlePairBuilderStart);
  bot.action(/^pair1:([A-Z]{3})$/, handlePairStep1);
  bot.action(/^pair2:([A-Z]{3}):([A-Z]{3})$/, handlePairStep2);
}

async function handlePairBuilderStart(ctx) {
  await ctx.answerCbQuery();
  const text = '🔀 Tap the FIRST currency:';
  await ctx.editMessageText(text, pairBuilderStep1Keyboard()).catch(() => ctx.reply(text, pairBuilderStep1Keyboard()));
}

async function handlePairStep1(ctx) {
  const first = ctx.match[1];
  await ctx.answerCbQuery();
  const text = `First: ${first}. Now tap the SECOND currency to compare it against:`;
  await ctx.editMessageText(text, pairBuilderStep2Keyboard(first)).catch(() =>
    ctx.reply(text, pairBuilderStep2Keyboard(first))
  );
}

async function handlePairStep2(ctx) {
  const first = ctx.match[1];
  const second = ctx.match[2];
  await ctx.answerCbQuery();

  const apiSymbol = toApiSymbol(first + second);
  if (!apiSymbol) {
    return ctx.reply(`Sorry, I couldn't build a valid pair from ${first} and ${second}.`);
  }

  await addToWatchlist(String(ctx.chat.id), apiSymbol, null, 'telegram');
  await replyWithThresholdSuggestion(ctx, apiSymbol);
}

async function handleQuickAddMenu(ctx) {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Tap an asset to add it to your watchlist:', quickAddMenu()).catch(() =>
    ctx.reply('Tap an asset to add it to your watchlist:', quickAddMenu())
  );
}

async function handleBackToMenu(ctx) {
  await ctx.answerCbQuery();
  await ctx.editMessageText('What would you like to do?', MAIN_MENU).catch(() =>
    ctx.reply('What would you like to do?', MAIN_MENU)
  );
}

async function handleQuickWatch(ctx) {
  const apiSymbol = ctx.match[1];
  await addToWatchlist(String(ctx.chat.id), apiSymbol, null, 'telegram');
  await ctx.answerCbQuery(`Added ${toDisplaySymbol(apiSymbol)}`);
  await replyWithThresholdSuggestion(ctx, apiSymbol);
}

/**
 * Shows the current price, a suggested round-number alert threshold, a
 * one-tap button to accept it, and the equivalent /watch command as plain
 * copyable text for anyone who wants to pick their own number instead.
 * Used both after a quick-add button tap and after a typed
 * "/watch SYMBOL" with no price given.
 *
 * IMPORTANT: the copyable command line uses the RAW unformatted number
 * (e.g. "68500"), not formatPrice()'s currency-prefixed display string
 * (e.g. "$68,500.00") - our own /watch parser can't read a "$" or "₦"
 * prefix, so putting the display string there would hand back a command
 * that fails when pasted.
 */
async function replyWithThresholdSuggestion(ctx, apiSymbol) {
  const display = toDisplaySymbol(apiSymbol);

  try {
    const quote = await getQuote(apiSymbol);
    const suggested = suggestThreshold(quote.price, quote.changePercent);

    await ctx.reply(
      [
        `✅ Now watching ${display}`,
        `Current price: ${formatPrice(quote.price, apiSymbol)}`,
        '',
        `💡 Suggested alert: ${formatPrice(suggested, apiSymbol)}`,
        '',
        'Not the number you want? Copy this and swap in your own price:',
        `/watch ${display} ${suggested}`,
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback(`✅ Use ${formatPrice(suggested, apiSymbol)}`, `setalert:${apiSymbol}:${suggested}`)],
      ])
    );
  } catch (err) {
    // Added successfully either way - just couldn't fetch a live price to base a suggestion on.
    logger.error('Failed to suggest a threshold', { symbol: apiSymbol, error: err.message });
    await ctx.reply(`✅ Now watching ${display}. Want an alert? Send:\n/watch ${display} <price>`);
  }
}

async function handleSetAlertFromSuggestion(ctx) {
  const apiSymbol = ctx.match[1];
  const threshold = parseFloat(ctx.match[2]);
  await addToWatchlist(String(ctx.chat.id), apiSymbol, threshold, 'telegram');
  await ctx.answerCbQuery(`Alert set at ${threshold}`);
  await ctx.reply(`🔔 Alert set: I'll notify you when ${toDisplaySymbol(apiSymbol)} crosses ${threshold}.`);
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
    return ctx.reply(
      [
        '💡 "Build a Pair" covers any currency combo — recommended if you\'re not sure what you want.',
        '"Ready-made" is faster if one of our common picks fits.',
        '',
        'What would you like to do? (Or type /watch SYMBOL directly if you already know it.)',
      ].join('\n'),
      WATCH_CHOICE_MENU
    );
  }

  const apiSymbol = toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    return ctx.reply(`I don't recognize "${rawSymbol}". Try a pair like EURUSD/XAUUSD/BTCUSD, or an index like SPX/DJI.`);
  }

  let threshold = null;
  if (rawThreshold !== undefined) {
    threshold = parseFloat(rawThreshold.replace(/,/g, ''));
    if (Number.isNaN(threshold)) {
      return ctx.reply(`"${rawThreshold}" doesn't look like a valid price. Example: /watch EURUSD 1.1800`);
    }
  }

  await addToWatchlist(String(ctx.chat.id), apiSymbol, threshold, 'telegram');

  if (threshold !== null) {
    return ctx.reply(`✅ Now watching ${toDisplaySymbol(apiSymbol)}. I'll alert you when it crosses ${threshold}.`);
  }

  // No price given - show a suggestion instead of just a bare "no alert set" note.
  await replyWithThresholdSuggestion(ctx, apiSymbol);
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
