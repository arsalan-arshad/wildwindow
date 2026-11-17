import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@wildwindow/config',
    include: ['**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
