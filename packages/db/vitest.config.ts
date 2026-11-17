import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@wildwindow/db',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    // Integration tests need PostGIS (docker compose / CI service).
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
