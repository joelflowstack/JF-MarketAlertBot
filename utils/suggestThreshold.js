/**
 * utils/suggestThreshold.js
 *
 * Suggests a "logical" alert threshold: the next round number in whatever
 * direction the price is currently trending, sized to the asset's own scale
 * (e.g. nearest 50 for a ~1400 NGN pair, nearest 0.01 for a ~1.1 forex pair).
 * This is a simple heuristic, not a prediction - it just picks a sensible
 * round milestone near the current price rather than an arbitrary decimal.
 *
 * Extracted as its own module (rather than living inside telegram/commands.js)
 * because it's now used identically by both telegram/commands.js and
 * discord/commands.js - one copy of the actual math, not two that could
 * silently drift out of sync from each other.
 */
export function suggestThreshold(price, changePercent) {
  const direction = changePercent >= 0 ? 1 : -1;

  let step;
  if (price >= 10000) step = 500;
  else if (price >= 1000) step = 50;
  else if (price >= 100) step = 5;
  else if (price >= 10) step = 0.5;
  else if (price >= 1) step = 0.01;
  else step = 0.001;

  let suggested = direction > 0 ? Math.ceil(price / step) * step : Math.floor(price / step) * step;
  if (suggested === price) suggested += direction * step; // ensure it's actually a different, meaningful level

  const decimals = step >= 1 ? 0 : String(step).split('.')[1].length;
  return parseFloat(suggested.toFixed(decimals));
}
