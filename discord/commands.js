/**
 * discord/commands.js
 *
 * Mirrors telegram/commands.js feature-for-feature: same commands, same
 * menu/quick-add/pair-builder/suggestion flow, same underlying services -
 * just built with Discord's response format (content + button components)
 * instead of Telegraf's ctx.reply()/Markup.
 *
 * Response pattern: every command computes its full result BEFORE
 * responding (same as our Telegram webhook), then replies ONCE with the
 * complete content - deliberately not using Discord's "defer, then edit
 * later" pattern, since background work after an HTTP response isn't
 * reliably guaranteed to finish on Vercel's serverless functions. The
 * tradeoff: if a response takes longer than Discord's ~3s interaction
 * window, Discord shows "This interaction failed" to the user even though
 * our backend completed the work. Acceptable given our 90s quote cache
 * keeps most responses fast in practice; revisit only if this becomes a
 * real, observed problem.
 */
import { InteractionResponseType, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { addToWatchlist, removeFromWatchlist, listWatchlist } from '../services/watchlist.js';
import { getQuote } from '../services/marketData.js';
import { toApiSymbol, toDisplaySymbol, formatPrice, formatChangePercent, formatTimeUTC } from '../utils/formatters.js';
import { suggestThreshold } from '../utils/suggestThreshold.js';
import { logger } from '../utils/logger.js';

const PLATFORM = 'discord';

// ---------------------------------------------------------------------------
// Button/menu builders
// ---------------------------------------------------------------------------
function button(label, customId, style = ButtonStyleTypes.PRIMARY) {
  return { type: MessageComponentTypes.BUTTON, style, label, custom_id: customId };
}

function row(...buttons) {
  return { type: MessageComponentTypes.ACTION_ROW, components: buttons };
}

const MAIN_MENU = [
  row(button('👀 My Watchlist', 'menu:list'), button('💱 Quick Add', 'menu:quickadd')),
  row(button('🔀 Build a Pair', 'menu:pairbuilder'), button('📊 Check a Price', 'menu:price')),
  row(button('❓ Help', 'menu:help')),
];

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
    rows.push(row(...POPULAR_PAIRS.slice(i, i + 2).map((p) => button(p.label, `watch:${p.symbol}`, ButtonStyleTypes.SECONDARY))));
  }
  rows.push(row(button('⬅️ Back', 'menu:back', ButtonStyleTypes.SECONDARY)));
  return rows;
}

const PICKER_CURRENCIES = ['USD', 'NGN', 'GBP', 'EUR', 'CAD'];

function pairBuilderStep1() {
  const rows = [];
  for (let i = 0; i < PICKER_CURRENCIES.length; i += 3) {
    rows.push(row(...PICKER_CURRENCIES.slice(i, i + 3).map((c) => button(c, `pair1:${c}`, ButtonStyleTypes.SECONDARY))));
  }
  rows.push(row(button('⬅️ Back', 'menu:back', ButtonStyleTypes.SECONDARY)));
  return rows;
}

function pairBuilderStep2(firstCurrency) {
  const remaining = PICKER_CURRENCIES.filter((c) => c !== firstCurrency);
  const rows = [];
  for (let i = 0; i < remaining.length; i += 3) {
    rows.push(row(...remaining.slice(i, i + 3).map((c) => button(c, `pair2:${firstCurrency}:${c}`, ButtonStyleTypes.SECONDARY))));
  }
  rows.push(row(button('⬅️ Start over', 'menu:pairbuilder', ButtonStyleTypes.SECONDARY)));
  return rows;
}

// ---------------------------------------------------------------------------
// Reply helpers - APPLICATION_COMMAND interactions always create a NEW
// message; MESSAGE_COMPONENT (button click) interactions always UPDATE the
// message the button was on, in place - one consistent rule for both.
// ---------------------------------------------------------------------------
function newMessage(content, components) {
  return { type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content, components } };
}

function updateMessage(content, components) {
  return { type: InteractionResponseType.UPDATE_MESSAGE, data: { content, components } };
}

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------
export async function handleCommand(interaction) {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const name = interaction.data.name;
  const options = Object.fromEntries((interaction.data.options || []).map((o) => [o.name, o.value]));

  switch (name) {
    case 'start':
      return newMessage(
        "👋 Welcome to Global Market Alert Bot!\n\nI'll watch forex, gold, and crypto prices for you and ping you the moment your price levels hit.\n\nTry /watch with a symbol to get started, or use the buttons below.",
        MAIN_MENU
      );
    case 'help':
      return newMessage(helpText(), MAIN_MENU);
    case 'id':
      return newMessage(`Your Discord user ID is: ${userId}\n\nUse this to log into the web dashboard.`);
    case 'watch':
      return handleWatch(userId, options.symbol, options.threshold);
    case 'list':
      return newMessage(...(await buildWatchlistView(userId)));
    case 'remove':
      return handleRemove(userId, options.symbol);
    case 'price':
      return handlePrice(options.symbol);
    default:
      return newMessage("Sorry, I don't recognize that command.");
  }
}

// ---------------------------------------------------------------------------
// Button (message component) dispatch
// ---------------------------------------------------------------------------
export async function handleComponent(interaction) {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const customId = interaction.data.custom_id;

  if (customId === 'menu:list') {
    return updateMessage(...(await buildWatchlistView(userId)));
  }
  if (customId === 'menu:help') {
    return updateMessage(helpText(), MAIN_MENU);
  }
  if (customId === 'menu:quickadd') {
    return updateMessage('Tap an asset to add it to your watchlist:', quickAddMenu());
  }
  if (customId === 'menu:pairbuilder') {
    return updateMessage('🔀 Tap the FIRST currency:', pairBuilderStep1());
  }
  if (customId === 'menu:back') {
    return updateMessage('What would you like to do?', MAIN_MENU);
  }
  if (customId === 'menu:price') {
    return updateMessage('Use /price with a symbol, e.g. /price EURUSD');
  }

  if (customId.startsWith('watch:')) {
    const apiSymbol = customId.slice('watch:'.length);
    await addToWatchlist(userId, apiSymbol, null, PLATFORM);
    return updateMessage(...(await buildSuggestionView(apiSymbol)));
  }

  if (customId.startsWith('remove:')) {
    const apiSymbol = customId.slice('remove:'.length);
    await removeFromWatchlist(userId, apiSymbol);
    return updateMessage(...(await buildWatchlistView(userId)));
  }

  if (customId.startsWith('setalert:')) {
    const [, apiSymbol, thresholdStr] = customId.split(':');
    const threshold = parseFloat(thresholdStr);
    await addToWatchlist(userId, apiSymbol, threshold, PLATFORM);
    return updateMessage(`🔔 Alert set: I'll notify you when ${toDisplaySymbol(apiSymbol)} crosses ${threshold}.`);
  }

  const pair1Match = customId.match(/^pair1:([A-Z]{3})$/);
  if (pair1Match) {
    const first = pair1Match[1];
    return updateMessage(`First: ${first}. Now tap the SECOND currency to compare it against:`, pairBuilderStep2(first));
  }

  const pair2Match = customId.match(/^pair2:([A-Z]{3}):([A-Z]{3})$/);
  if (pair2Match) {
    const [, first, second] = pair2Match;
    const apiSymbol = toApiSymbol(first + second);
    if (!apiSymbol) {
      return updateMessage(`Sorry, I couldn't build a valid pair from ${first} and ${second}.`);
    }
    await addToWatchlist(userId, apiSymbol, null, PLATFORM);
    return updateMessage(...(await buildSuggestionView(apiSymbol)));
  }

  return updateMessage("Sorry, I couldn't process that.");
}

// ---------------------------------------------------------------------------
// Shared view builders (each returns [content, components] for spreading
// into newMessage()/updateMessage())
// ---------------------------------------------------------------------------
function helpText() {
  return [
    '📖 Commands',
    '',
    '/watch symbol [threshold] — add an asset to your watchlist, optionally with an alert price',
    '   e.g. /watch symbol:EURUSD threshold:1.1800',
    "/list — show everything you're watching",
    '/remove symbol — stop watching an asset',
    '/price symbol — get the current price, daily high/low, and 24h change',
    '/id — get your Discord user ID (for logging into the web dashboard)',
    '',
    'Supported symbols: EURUSD, XAUUSD (gold), BTCUSD, and more forex/crypto pairs — plus stock indices like SPX, DJI, IXIC, NDX, RUT.',
  ].join('\n');
}

async function buildWatchlistView(userId) {
  const items = await listWatchlist(userId);
  if (items.length === 0) {
    return ["You're not watching anything yet. Try /watch symbol:EURUSD threshold:1.1800 to get started.", MAIN_MENU];
  }

  const lines = items.map((item) => {
    const thresholdText = item.threshold !== null ? `alert at ${item.threshold}` : 'no alert set';
    return `• ${toDisplaySymbol(item.symbol)} — ${thresholdText}`;
  });

  const removeButtons = [];
  for (let i = 0; i < items.length; i += 1) {
    removeButtons.push(row(button(`🗑 Remove ${toDisplaySymbol(items[i].symbol)}`, `remove:${items[i].symbol}`, ButtonStyleTypes.DANGER)));
  }

  return [['👀 Your watchlist:', '', ...lines].join('\n'), removeButtons];
}

async function buildSuggestionView(apiSymbol) {
  const display = toDisplaySymbol(apiSymbol);
  try {
    const quote = await getQuote(apiSymbol);
    const suggested = suggestThreshold(quote.price, quote.changePercent);
    const content = [
      `✅ Now watching ${display}`,
      `Current price: ${formatPrice(quote.price, apiSymbol)}`,
      '',
      `💡 Suggested alert: ${formatPrice(suggested, apiSymbol)}`,
      '',
      'Not the number you want? Use:',
      `/watch symbol:${display} threshold:${suggested}`,
    ].join('\n');
    return [content, [row(button(`✅ Use ${formatPrice(suggested, apiSymbol)}`, `setalert:${apiSymbol}:${suggested}`))]];
  } catch (err) {
    logger.error('Failed to suggest a threshold', { symbol: apiSymbol, error: err.message });
    return [`✅ Now watching ${display}. Want an alert? Use:\n/watch symbol:${display} threshold:<price>`];
  }
}

async function handleWatch(userId, rawSymbol, rawThreshold) {
  const apiSymbol = toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    return newMessage(`I don't recognize "${rawSymbol}". Try a pair like EURUSD/XAUUSD/BTCUSD, or an index like SPX/DJI.`);
  }

  const threshold = rawThreshold !== undefined ? rawThreshold : null;
  await addToWatchlist(userId, apiSymbol, threshold, PLATFORM);

  if (threshold !== null) {
    return newMessage(`✅ Now watching ${toDisplaySymbol(apiSymbol)}. I'll alert you when it crosses ${threshold}.`);
  }

  return newMessage(...(await buildSuggestionView(apiSymbol)));
}

async function handleRemove(userId, rawSymbol) {
  const apiSymbol = toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    return newMessage(`I don't recognize "${rawSymbol}".`);
  }
  const removed = await removeFromWatchlist(userId, apiSymbol);
  return newMessage(
    removed ? `🗑️ Removed ${toDisplaySymbol(apiSymbol)} from your watchlist.` : `${toDisplaySymbol(apiSymbol)} wasn't in your watchlist.`
  );
}

async function handlePrice(rawSymbol) {
  const apiSymbol = toApiSymbol(rawSymbol);
  if (!apiSymbol) {
    return newMessage(`I don't recognize "${rawSymbol}".`);
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
    if (apiSymbol.includes('NGN')) {
      lines.push('', 'ℹ️ Official interbank rate. Parallel market typically trades a few % higher.');
    }
    return newMessage(lines.join('\n'));
  } catch (err) {
    logger.error('Failed to fetch price for /price command', { symbol: apiSymbol, error: err.message });
    return newMessage(`Sorry, I couldn't fetch a price for ${toDisplaySymbol(apiSymbol)} right now. Please try again shortly.`);
  }
}
