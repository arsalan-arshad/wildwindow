import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'worker',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    // Integration tests share one PostGIS; avoid concurrent migrate races.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
