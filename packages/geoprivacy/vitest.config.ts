import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@wildwindow/geoprivacy',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
