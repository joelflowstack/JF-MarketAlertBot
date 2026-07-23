import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';

const PREFS_KEY = 'market-alert-bot:prefs';

function loadPrefs() {
  const raw = localStorage.getItem(PREFS_KEY);
  return raw ? JSON.parse(raw) : { thresholdAlerts: true, dailySummary: false };
}

export function Settings() {
  const { session } = useAuth();
  const [prefs, setPrefs] = useState(loadPrefs);

  function toggle(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    toast.success('Preference saved');
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Settings</h1>
      <p className="text-text-secondary text-sm mb-6">
        Preferences saved to this browser for now — full account sync arrives with database support.
      </p>

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
        <div className="space-y-4">
          <ToggleRow
            label="Threshold alerts"
            description="Get notified the moment a watched price crosses your threshold."
            checked={prefs.thresholdAlerts}
            onChange={() => toggle('thresholdAlerts')}
          />
          <ToggleRow
            label="Daily summary"
            description="A daily recap of your watchlist performance (coming soon)."
            checked={prefs.dailySummary}
            onChange={() => toggle('dailySummary')}
          />
        </div>
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
