import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Settings() {
  const { session } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSettings(session.chatId)
      .then(setPrefs)
      .catch(() => toast.error('Could not load your settings.'))
      .finally(() => setLoading(false));
  }, [session.chatId]);

  async function toggle(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic update
    try {
      await api.updateSettings(session.chatId, { [key]: next[key] });
      toast.success('Preference saved');
    } catch {
      setPrefs(prefs); // revert on failure
      toast.error('Could not save that - try again.');
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Settings</h1>
      <p className="text-text-secondary text-sm mb-6">Synced to your account - the same everywhere you log in.</p>

      <Card title="Profile" className="mb-4">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-text-secondary mb-1">Name</p>
            <p className="text-sm text-text-primary">{session.name}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary mb-1">Telegram Chat ID</p>
            <p className="text-sm text-text-primary font-mono">{session.chatId}</p>
          </div>
        </div>
      </Card>

      <Card title="Notifications">
        {loading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size={22} />
          </div>
        ) : (
          <div className="space-y-4">
            <ToggleRow
              label="Threshold alerts"
              description="Get notified the moment a watched price crosses your threshold."
              checked={prefs.thresholdAlerts}
              onChange={() => toggle('thresholdAlerts')}
            />
            <ToggleRow
              label="Daily summary"
              description="One message a day with current price, high/low, and change for everything you're watching."
              checked={prefs.dailySummary}
              onChange={() => toggle('dailySummary')}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="pr-4">
        <p className="text-sm text-text-primary font-medium">{label}</p>
        <p className="text-xs text-text-secondary mt-0.5">{description}</p>
      </div>
      <button
        onClick={onChange}
        role="switch"
        aria-checked={checked}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-primary' : 'bg-border'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </div>
  );
}
