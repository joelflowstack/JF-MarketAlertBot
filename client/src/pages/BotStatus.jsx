import { useEffect, useState } from 'react';
import { Radio, Server, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function BotStatus() {
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  async function check() {
    setChecking(true);
    try {
      const res = await api.health();
      setHealth(res);
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
      setLastChecked(new Date());
    }
  }

  useEffect(() => {
    check();
    const interval = setInterval(check, 15_000);
    return () => clearInterval(interval);
  }, []);

  const online = !!health;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Bot Status</h1>
      <p className="text-text-secondary text-sm mb-6">Live health of the Telegram bot and backend.</p>

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${online ? 'bg-positive/15' : 'bg-negative/15'}`}>
              <Radio size={22} className={online ? 'text-positive' : 'text-negative'} />
            </div>
            <div>
              <p className="font-display font-semibold text-text-primary">
                {checking ? 'Checking…' : online ? 'All systems operational' : 'Bot unreachable'}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">Auto-refreshes every 15 seconds</p>
            </div>
          </div>
          {checking ? <LoadingSpinner size={20} /> : <StatusBadge variant={online ? 'online' : 'offline'} pulse={online}>{online ? 'Online' : 'Offline'}</StatusBadge>}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Backend">
          <div className="flex items-center gap-3">
            <Server size={18} className="text-text-secondary" />
            <div>
              <p className="text-sm text-text-primary font-mono">{health?.status ?? 'unreachable'}</p>
              <p className="text-xs text-text-secondary">API health endpoint</p>
            </div>
          </div>
        </Card>
        <Card title="Last Checked">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-text-secondary" />
            <div>
              <p className="text-sm text-text-primary font-mono">
                {lastChecked ? lastChecked.toLocaleTimeString() : '—'}
              </p>
              <p className="text-xs text-text-secondary">From your browser</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <p className="text-sm text-text-secondary">
          Alert checks run every minute via an external scheduler hitting{' '}
          <span className="font-mono text-text-primary">/api/cron/check-alerts</span>. This page reflects
          whether the API itself is reachable, not whether that specific cron job is currently active.
        </p>
      </Card>
    </div>
  );
}
