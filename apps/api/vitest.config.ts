import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: false,
    // E2e suites all call applyRoles / migrate against the same PostGIS;
    // parallel files race on CREATE/ALTER ROLE ("tuple concurrently updated").
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
});
