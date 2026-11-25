import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/env.ts', 'src/client.ts', 'src/api/waitlist.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node22',
  // Keep browser-safe entrypoints self-contained (no cross-chunk imports).
  splitting: false,
});
