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
  noExternal: [/^@wildwindow\//],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
