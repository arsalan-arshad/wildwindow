import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config for generate/migrate.
 * Runtime migrate uses `src/migrate.ts` + DATABASE_URL (T2.1).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle',
  },
});
