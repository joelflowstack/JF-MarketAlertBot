import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Prices() {
  const { session } = useAuth();
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const wl = await api.getWatchlist(session.chatId);
      const results = await Promise.all(
        wl.items.map((item) =>
          api
            .getPrice(item.symbol.replace('/', ''))
            .then((p) => ({ ...p, threshold: item.threshold }))
            .catch(() => ({ symbol: item.symbol, error: true }))
        )
      );
      setPrices(results);
    } catch {
      toast.error('Could not load prices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.chatId]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 20_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Current Prices</h1>
          <p className="text-text-secondary text-sm">Live quotes for everything you're watching.</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary border border-border rounded-lg px-3 py-2 transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size={28} />
        </div>
      ) : prices.length === 0 ? (
        <Card>
          <p className="text-sm text-text-secondary py-4 text-center">
            Nothing watched yet — add assets from the Watchlist page to see live prices.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {prices.map((p, i) => {
            if (p.error) {
              return (
                <Card key={i}>
                  <p className="font-mono text-text-primary font-medium mb-1">{p.symbol.replace('/', '')}</p>
                  <p className="text-xs text-negative">Price unavailable right now</p>
                </Card>
              );
            }
            const isUp = !p.changePercent?.startsWith('-');
            return (
              <Card key={i}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-text-primary font-medium">{p.symbol.replace('/', '')}</p>
                  <span className={`flex items-center gap-1 text-xs font-mono ${isUp ? 'text-positive' : 'text-negative'}`}>
                    {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {p.changePercent}
                  </span>
                </div>
                <p className="text-2xl font-display font-semibold text-text-primary mb-3">{p.price}</p>
                <div className="flex justify-between text-xs text-text-secondary font-mono">
                  <span>H: {p.high}</span>
                  <span>L: {p.low}</span>
                </div>
                {p.threshold !== null && p.threshold !== undefined && (
                  <p className="text-xs text-text-secondary mt-2 pt-2 border-t border-border">
                    Alert at <span className="text-text-primary font-mono">{p.threshold}</span>
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
