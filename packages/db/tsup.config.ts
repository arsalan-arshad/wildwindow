import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/schema/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node22',
  external: ['pg', 'drizzle-orm', '@wildwindow/shared', '@wildwindow/geoprivacy', 'zod'],
});
