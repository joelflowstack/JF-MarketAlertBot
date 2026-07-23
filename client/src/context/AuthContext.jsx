/**
 * src/context/AuthContext.jsx
 *
 * "Simple demo authentication" per the MVP spec: no password check against a
 * real backend, just a name + Telegram Chat ID, persisted in this browser so
 * a refresh doesn't log you out. The Chat ID is the real link to your data -
 * it's the same ID the bot uses as the watchlist key, so whatever you /watch
 * in Telegram shows up in the dashboard under that same ID.
 *
 * Phase 5 replaces this with real Firebase Authentication without changing
 * how the rest of the app consumes useAuth().
 */
import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'market-alert-bot:session';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback((name, chatId) => {
    const next = { name, chatId: String(chatId) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, login, logout, isAuthenticated: !!session }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
