import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/env.ts',
    'src/client.ts',
    'src/analytics.ts',
    'src/sentry-scrub.ts',
    'src/api/index.ts',
    'src/api/waitlist.ts',
    'src/api/bug-reports.ts',
    'src/bug-report-scrub.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node22',
  // Keep browser-safe entrypoints self-contained (no cross-chunk imports).
  splitting: false,
  // geoprivacy is workspace-linked; leave it external for Node consumers.
  external: ['@wildwindow/geoprivacy'],
});
