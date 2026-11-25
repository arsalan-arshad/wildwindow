import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/schema/index.ts', 'src/migrate.ts', 'src/seed.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node22',
  // Keep CLI entries self-contained so Docker can run `node dist/migrate.js` /
  // `node dist/seed.js` without pnpm/tsx (Railway migrate image).
  splitting: false,
  external: ['pg', 'drizzle-orm', '@wildwindow/shared', '@wildwindow/geoprivacy', 'h3-js', 'zod'],
});
