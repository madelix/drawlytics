// client/vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load VITE_* from .env files (including .env.local)
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // In dev, proxy /api -> your local Express server
  // In prod builds, you typically don't use Vite dev proxy.
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3000';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
