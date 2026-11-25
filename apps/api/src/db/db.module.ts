import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { createDb, type Database } from '@wildwindow/db';

import { loadApiEnv } from '../config/api-env.js';

import type { Pool } from 'pg';

export const DB = Symbol('WW_DB');
export const DB_POOL = Symbol('WW_DB_POOL');

type DbHandles = {
  readonly db: Database;
  readonly pool: Pool;
};

const DB_HANDLES = Symbol('WW_DB_HANDLES');

@Global()
@Module({
  providers: [
    {
      provide: DB_HANDLES,
      useFactory: (): DbHandles | null => {
        const env = loadApiEnv();
        const url = env.DATABASE_URL_API;
        if (url === undefined || url.length === 0) {
          return null;
        }
        return createDb({ connectionString: url });
      },
    },
    {
      provide: DB,
      inject: [DB_HANDLES],
      useFactory: (handles: DbHandles | null): Database | null => handles?.db ?? null,
    },
    {
      provide: DB_POOL,
      inject: [DB_HANDLES],
      useFactory: (handles: DbHandles | null): Pool | null => handles?.pool ?? null,
    },
  ],
  exports: [DB, DB_POOL],
})
export class DbModule implements OnModuleDestroy {
  constructor(@Inject(DB_POOL) private readonly pool: Pool | null) {}

  async onModuleDestroy(): Promise<void> {
    if (this.pool !== null) {
      await this.pool.end();
    }
  }
}
