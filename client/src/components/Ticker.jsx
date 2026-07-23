/**
 * The dashboard's signature element: a continuously scrolling ticker tape of
 * watched symbols and their live prices, styled after a trading floor
 * display. Content is duplicated so the CSS marquee loops seamlessly.
 */
export function Ticker({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="w-full bg-surface border-y border-border py-2.5 px-4 text-sm text-text-secondary font-mono">
        No assets watched yet — add one from the Watchlist page to see live prices scroll here.
      </div>
    );
  }

  const renderItems = (keyPrefix) =>
    items.map((item, i) => (
      <span key={`${keyPrefix}-${i}`} className="inline-flex items-center gap-2 mx-6 font-mono text-sm whitespace-nowrap">
        <span className="text-text-primary font-medium">{item.symbol}</span>
        <span className="text-text-primary">{item.price}</span>
        <span className={item.changePercent?.startsWith('-') ? 'text-negative' : 'text-positive'}>
          {item.changePercent}
        </span>
      </span>
    ));

  return (
    <div className="w-full bg-surface border-y border-border overflow-hidden py-2.5">
      <div className="flex animate-ticker">
        {renderItems('a')}
        {renderItems('b')}
      </div>
    </div>
  );
}
