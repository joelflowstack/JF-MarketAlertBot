import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './pages/DashboardLayout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Watchlist } from './pages/Watchlist';
import { Alerts } from './pages/Alerts';
import { Prices } from './pages/Prices';
import { BotStatus } from './pages/BotStatus';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#12161F',
              color: '#E7EAF0',
              border: '1px solid #232838',
              fontFamily: '"IBM Plex Sans", sans-serif',
              fontSize: '14px',
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Overview />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/prices" element={<Prices />} />
            <Route path="/bot-status" element={<BotStatus />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
