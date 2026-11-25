import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node22',
  sourcemap: true,
  clean: true,
  // Single file — Railway runner must not chase workspace package graphs.
  splitting: false,
  // Inline @wildwindow/* so packages/db → geoprivacy/shared does not need
  // nested node_modules under packages/db at runtime (Railway crash after #27).
  // Leave commander external: bundling it into ESM breaks Node builtins
  // (Dynamic require of "events"). The Dockerfile ships apps/worker/node_modules/commander
  // (≥9, with requiredOption) so root-hoisted commander@2 from terser/vitest is not used.
  noExternal: [/^@wildwindow\//],
  external: ['commander'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
