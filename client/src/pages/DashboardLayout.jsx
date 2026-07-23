import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center h-14 px-4 border-b border-border bg-surface">
          <button onClick={() => setSidebarOpen(true)} className="text-text-secondary">
            <Menu size={22} />
          </button>
          <span className="ml-3 font-display font-semibold text-text-primary">MarketAlert</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
