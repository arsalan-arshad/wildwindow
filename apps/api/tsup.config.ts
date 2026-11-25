import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'node22',
  sourcemap: true,
  clean: true,
  splitting: false,
  // Inline workspace packages so the Railway runner need not copy packages/*/dist.
  noExternal: [/^@wildwindow\//],
  banner: {
    js: "import 'reflect-metadata';",
  },
});
