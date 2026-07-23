import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local dev only: proxies /api requests to the Express backend running via
// `npm start` in the project root (see server.js). In production the
// dashboard calls the backend's full deployed URL instead (see src/lib/api.js).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
