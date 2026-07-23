import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Bell, TrendingUp, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { Ticker } from '../components/Ticker';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';

export function Overview() {
  const { session } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [tickerData, setTickerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [botOnline, setBotOnline] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [wl, recentAlerts, health] = await Promise.all([
          api.getWatchlist(session.chatId),
          api.getRecentAlerts(session.chatId),
          api.health().catch(() => null),
        ]);
        if (cancelled) return;
        setWatchlist(wl.items);
        setAlerts(recentAlerts.alerts);
        setBotOnline(!!health);

        const prices = await Promise.all(
          wl.items.map((item) =>
            api
              .getPrice(item.symbol.replace('/', ''))
              .then((p) => ({ symbol: p.symbol, price: p.price, changePercent: p.changePercent }))
              .catch(() => null)
          )
        );
        if (!cancelled) setTickerData(prices.filter(Boolean));
      } catch {
        if (!cancelled) setBotOnline(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session.chatId]);

  return (
    <div>
      <Ticker items={tickerData} />

      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-semibold text-text-primary">
              Welcome back, {session.name}
            </h1>
            <p className="text-text-secondary text-sm mt-1">Here's what's happening with your alerts.</p>
          </div>
          <StatusBadge variant={botOnline ? 'online' : 'offline'} pulse={botOnline}>
            {botOnline === null ? 'Checking…' : botOnline ? 'Bot Online' : 'Bot Offline'}
          </StatusBadge>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size={28} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Eye size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-display font-semibold text-text-primary">{watchlist.length}</p>
                    <p className="text-xs text-text-secondary">Assets watched</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/15 flex items-center justify-center">
                    <Bell size={18} className="text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-display font-semibold text-text-primary">{alerts.length}</p>
                    <p className="text-xs text-text-secondary">Alerts sent (recent)</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-positive/15 flex items-center justify-center">
                    <TrendingUp size={18} className="text-positive" />
                  </div>
                  <div>
                    <p className="text-2xl font-display font-semibold text-text-primary">
                      {watchlist.filter((w) => w.threshold !== null).length}
                    </p>
                    <p className="text-xs text-text-secondary">Active thresholds</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Your Watchlist" action={<Link to="/watchlist" className="text-primary text-sm flex items-center gap-1 hover:underline">Manage <ArrowRight size={14} /></Link>}>
                {watchlist.length === 0 ? (
                  <p className="text-sm text-text-secondary py-4">
                    Nothing watched yet. Message the bot: <span className="font-mono text-text-primary">/watch EURUSD 1.1800</span>
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {watchlist.slice(0, 5).map((item) => (
                      <li key={item.symbol} className="flex items-center justify-between py-2.5 text-sm">
                        <span className="font-mono text-text-primary">{item.symbol.replace('/', '')}</span>
                        <span className="text-text-secondary">
                          {item.threshold !== null ? `Alert at ${item.threshold}` : 'No alert set'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Recent Alerts" action={<Link to="/alerts" className="text-primary text-sm flex items-center gap-1 hover:underline">View all <ArrowRight size={14} /></Link>}>
                {alerts.length === 0 ? (
                  <p className="text-sm text-text-secondary py-4">No alerts fired yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {alerts.slice(0, 5).map((alert, i) => (
                      <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                        <span className="font-mono text-text-primary">{alert.symbol.replace('/', '')}</span>
                        <span className="text-text-secondary">crossed {alert.threshold}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
