import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@wildwindow/infra',
    include: ['test/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
