import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Alerts() {
  const { session } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getRecentAlerts(session.chatId)
      .then((res) => setAlerts(res.alerts))
      .catch(() => toast.error('Could not load alert history.'))
      .finally(() => setLoading(false));
  }, [session.chatId]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Recent Alerts</h1>
      <p className="text-text-secondary text-sm mb-6">Every threshold crossing sent to your Telegram.</p>

      <Card>
        {loading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size={24} />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-10">
            <Bell size={28} className="mx-auto text-text-secondary mb-3" />
            <p className="text-sm text-text-secondary">
              No alerts fired yet. Set a threshold in your Watchlist and they'll show up here the moment
              price crosses it.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((alert, i) => (
              <li key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center flex-shrink-0">
                    <Bell size={16} className="text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-text-primary">
                      <span className="font-mono font-medium">{alert.symbol.replace('/', '')}</span> crossed{' '}
                      {alert.threshold}
                    </p>
                    <p className="text-xs text-text-secondary font-mono mt-0.5">
                      Price: {alert.price} · {new Date(alert.sentAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
