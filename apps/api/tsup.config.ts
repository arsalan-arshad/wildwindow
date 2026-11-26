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
  // @wildwindow/shared pulls `yaml`. Bundling yaml into ESM wraps CJS with a
  // dynamic-require shim that crashes on boot: Dynamic require of "process".
  // Keep yaml (and leave firebase-admin) external — root node_modules ships them.
  external: ['yaml'],
  banner: {
    js: "import 'reflect-metadata';",
  },
});
