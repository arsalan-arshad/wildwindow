import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@wildwindow/scoring',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
