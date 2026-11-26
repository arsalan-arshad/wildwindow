import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@wildwindow/shared/analytics': path.resolve(
        __dirname,
        '../../packages/shared/src/analytics.ts',
      ),
      '@wildwindow/shared/sentry-scrub': path.resolve(
        __dirname,
        '../../packages/shared/src/sentry-scrub.ts',
      ),
      '@wildwindow/geoprivacy': path.resolve(__dirname, '../../packages/geoprivacy/src/index.ts'),
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
