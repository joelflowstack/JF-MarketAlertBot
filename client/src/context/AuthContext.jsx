/**
 * src/context/AuthContext.jsx
 *
 * Two authentication paths, depending on how the dashboard is opened:
 *
 * 1. Inside the Telegram Mini App (the real, intended way): Telegram gives
 *    us a signed "initData" string proving which real Telegram user opened
 *    it. We send that to our backend, which verifies the cryptographic
 *    signature (see server.js) and hands back a trustworthy Chat ID - no
 *    typing, no self-reported identity that could be spoofed.
 *
 * 2. Opened directly in a normal browser (e.g. for local testing, or
 *    before the Mini App was set up): falls back to the original "simple
 *    demo authentication" - name + Chat ID typed in manually, persisted in
 *    this browser. Still useful for testing outside Telegram.
 *
 * Either way, the rest of the app just calls useAuth() and doesn't care
 * which path produced the session.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'market-alert-bot:session';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  // Starts true so the app doesn't flash the manual Login screen while we
  // check whether we're actually inside Telegram - see the effect below.
  const [isVerifying, setIsVerifying] = useState(true);

  const login = useCallback((name, chatId) => {
    const next = { name, chatId: String(chatId) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    // Not opened inside Telegram (e.g. a normal browser tab) - nothing to
    // verify, fall straight through to whatever session (or lack of one)
    // was already loaded from localStorage above.
    if (!tg?.initData) {
      setIsVerifying(false);
      return;
    }

    tg.ready();
    tg.expand();

    // Telegram-verified identity is authoritative whenever it's available -
    // it always wins over/replaces any previously stored manual session,
    // since it's cryptographically real rather than self-reported.
    api
      .verifyTelegramInitData(tg.initData)
      .then(({ chatId, name }) => login(name, chatId))
      .catch(() => {
        // Verification failed (e.g. expired init data) - fall back to
        // whatever manual session already existed, if any.
      })
      .finally(() => setIsVerifying(false));
  }, [login]);

  return (
    <AuthContext.Provider value={{ session, login, logout, isAuthenticated: !!session, isVerifying }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
