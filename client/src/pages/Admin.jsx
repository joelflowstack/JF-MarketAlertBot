import { useEffect, useState } from 'react';
import { Users, LineChart, Bell, Radio } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';

const COLOR_CLASSES = {
  primary: { bg: 'bg-primary/15', text: 'text-primary' },
  positive: { bg: 'bg-positive/15', text: 'text-positive' },
  warning: { bg: 'bg-warning/15', text: 'text-warning' },
};

export function Admin() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAdminStats()
      .then(setStats)
      .catch(() => toast.error('Could not load admin stats.'))
      .finally(() => setLoading(false));
  }, []);

  const cards = stats
    ? [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'primary' },
        { label: 'Assets Monitored', value: stats.assetsMonitored, icon: LineChart, color: 'positive' },
        { label: 'Alerts Sent', value: stats.alertsSent, icon: Bell, color: 'warning' },
      ]
    : [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Admin Panel</h1>
          <p className="text-text-secondary text-sm">Platform-wide stats, across every user.</p>
        </div>
        {stats && (
          <StatusBadge variant={stats.botOnline ? 'online' : 'offline'} pulse={stats.botOnline}>
            {stats.botOnline ? 'Bot Online' : 'Bot Offline'}
          </StatusBadge>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size={28} />
        </div>
      ) : !stats ? (
        <Card>
          <p className="text-sm text-negative text-center py-4">Could not reach the backend.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {cards.map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${COLOR_CLASSES[color].bg} flex items-center justify-center`}>
                    <Icon size={18} className={COLOR_CLASSES[color].text} />
                  </div>
                  <div>
                    <p className="text-2xl font-display font-semibold text-text-primary">{value}</p>
                    <p className="text-xs text-text-secondary">{label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card title="Server">
            <div className="flex items-center gap-3">
              <Radio size={18} className="text-text-secondary" />
              <div>
                <p className="text-sm text-text-primary font-mono">
                  Running since {new Date(stats.serverStartedAt).toLocaleString()}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Resets on redeploy or cold start — not true long-term uptime.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
