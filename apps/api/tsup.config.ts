import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'node22',
  sourcemap: true,
  clean: true,
  splitting: false,
  // Inline only workspace packages so the Railway runner need not copy
  // packages/*/dist. Leave every other npm package external: bundling CJS
  // (yaml, express → debug, …) into ESM installs a broken dynamic-require
  // shim that crashes on boot (Railway: Dynamic require of "process" / "tty").
  skipNodeModulesBundle: true,
  noExternal: [/^@wildwindow\//],
  banner: {
    js: "import 'reflect-metadata';",
  },
});
