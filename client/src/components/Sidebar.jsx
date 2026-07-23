import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Eye,
  Bell,
  LineChart,
  Radio,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/watchlist', label: 'Watchlist', icon: Eye },
  { to: '/alerts', label: 'Recent Alerts', icon: Bell },
  { to: '/prices', label: 'Current Prices', icon: LineChart },
  { to: '/bot-status', label: 'Bot Status', icon: Radio },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
];

export function Sidebar({ open, onClose }) {
  const { session, logout } = useAuth();

  return (
    <>
      {/* Mobile scrim */}
      {open && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col
          transition-transform duration-200 md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Radio size={16} className="text-bg" />
            </div>
            <span className="font-display font-semibold text-text-primary">MarketAlert</span>
          </div>
          <button onClick={onClose} className="md:hidden text-text-secondary">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="px-3 mb-3">
            <p className="text-sm font-medium text-text-primary truncate">{session?.name}</p>
            <p className="text-xs text-text-secondary font-mono truncate">Chat ID: {session?.chatId}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-negative hover:bg-surface-hover w-full transition-colors"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
