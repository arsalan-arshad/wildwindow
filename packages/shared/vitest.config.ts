import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@wildwindow/shared',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
