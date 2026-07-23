import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [chatId, setChatId] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !chatId.trim()) {
      toast.error('Enter a name and your Chat ID to continue.');
      return;
    }
    login(name.trim(), chatId.trim());
    toast.success(`Welcome, ${name.trim()}`);
    navigate('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
            <Radio size={20} className="text-bg" />
          </div>
          <span className="font-display text-xl font-semibold text-text-primary">MarketAlert</span>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <h1 className="font-display font-semibold text-lg text-text-primary mb-1">Sign in</h1>
          <p className="text-sm text-text-secondary mb-6">
            Demo access — no password needed. Your Chat ID connects this dashboard to your real Telegram
            watchlist.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Trader"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Telegram Chat ID</label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary font-mono focus:border-primary outline-none"
              />
              <p className="text-xs text-text-secondary mt-1.5">
                Message <span className="font-mono text-text-primary">/id</span> to the bot on Telegram to get yours.
              </p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-primary text-bg font-medium rounded-lg py-2.5 text-sm hover:bg-primary/90 transition-colors"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
