/**
 * utils/logger.js
 * Deliberately minimal for the MVP — Vercel captures stdout/stderr as logs
 * automatically, so we just need consistent, greppable prefixes.
 * Swappable for a real logging service later without touching call sites.
 */
const timestamp = () => new Date().toISOString();

export const logger = {
  info: (msg, meta = {}) => console.log(`[INFO] ${timestamp()} ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[WARN] ${timestamp()} ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[ERROR] ${timestamp()} ${msg}`, meta),
};
