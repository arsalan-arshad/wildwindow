import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@wildwindow/db',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    // Integration tests share one PostGIS; avoid concurrent migrate races.
    fileParallelism: false,
    // Integration tests need PostGIS (docker compose / CI service).
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
