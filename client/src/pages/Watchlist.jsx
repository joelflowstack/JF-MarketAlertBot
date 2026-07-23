import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Watchlist() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('');
  const [threshold, setThreshold] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getWatchlist(session.chatId);
      setItems(res.items);
    } catch {
      toast.error('Could not load your watchlist.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [session.chatId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!symbol.trim()) {
      toast.error('Enter a symbol, e.g. EURUSD');
      return;
    }
    setSubmitting(true);
    try {
      await api.addToWatchlist(session.chatId, symbol.trim(), threshold ? parseFloat(threshold) : null);
      toast.success(`${symbol.trim().toUpperCase()} added`);
      setSymbol('');
      setThreshold('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(rawSymbol) {
    try {
      await api.removeFromWatchlist(session.chatId, rawSymbol.replace('/', ''));
      toast.success(`${rawSymbol.replace('/', '')} removed`);
      setItems((prev) => prev.filter((i) => i.symbol !== rawSymbol));
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Watchlist</h1>
      <p className="text-text-secondary text-sm mb-6">
        Manage the assets you're watching. Same list as your Telegram <span className="font-mono">/list</span>.
      </p>

      <Card className="mb-6">
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Symbol, e.g. EURUSD"
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary font-mono focus:border-primary outline-none"
          />
          <input
            type="number"
            step="any"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="Alert price (optional)"
            className="sm:w-48 bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary font-mono focus:border-primary outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 bg-primary text-bg font-medium rounded-lg px-4 py-2.5 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            Add
          </button>
        </form>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size={24} />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-text-secondary py-4 text-center">
            Nothing watched yet. Add one above, or message the bot <span className="font-mono text-text-primary">/watch EURUSD 1.1800</span>.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.symbol} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-mono text-text-primary font-medium">{item.symbol.replace('/', '')}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {item.threshold !== null ? `Alert at ${item.threshold}` : 'No alert set'}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(item.symbol)}
                  className="text-text-secondary hover:text-negative transition-colors p-2"
                  aria-label={`Remove ${item.symbol}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
