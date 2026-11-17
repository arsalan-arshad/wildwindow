import { Client } from 'pg';

export type RolePasswords = {
  readonly apiPassword: string;
  readonly workerPassword: string;
};

async function ensureLoginRole(
  client: Client,
  roleName: 'ww_api' | 'ww_worker',
  password: string,
): Promise<void> {
  const existing = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [roleName]);
  const template =
    existing.rowCount === 0
      ? `SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS cmd`
      : `SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', $1::text, $2::text) AS cmd`;
  const formatted = await client.query<{ cmd: string }>(template, [roleName, password]);
  const cmd = formatted.rows[0]?.cmd;
  if (cmd === undefined) {
    throw new Error(`failed to format role DDL for ${roleName}`);
  }
  await client.query(cmd);
}

async function quoteIdent(client: Client, value: string): Promise<string> {
  const result = await client.query<{ q: string }>(`SELECT quote_ident($1) AS q`, [value]);
  const quoted = result.rows[0]?.q;
  if (quoted === undefined) {
    throw new Error('quote_ident returned no row');
  }
  return quoted;
}

/**
 * Create/update `ww_api` and `ww_worker` and apply ARCHITECTURE §6.3 privileges.
 * Idempotent. Run as the migrations owner (DATABASE_URL / postgres).
 */
export async function applyRoles(
  connectionString: string,
  passwords: RolePasswords,
): Promise<void> {
  if (passwords.apiPassword.length === 0 || passwords.workerPassword.length === 0) {
    throw new Error('WW_API_DB_PASSWORD and WW_WORKER_DB_PASSWORD must be non-empty');
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await ensureLoginRole(client, 'ww_api', passwords.apiPassword);
    await ensureLoginRole(client, 'ww_worker', passwords.workerPassword);

    const dbNameResult = await client.query<{ db: string }>(`SELECT current_database() AS db`);
    const dbName = dbNameResult.rows[0]?.db;
    if (dbName === undefined) {
      throw new Error('current_database() returned no row');
    }
    const dbIdent = await quoteIdent(client, dbName);

    await client.query(`GRANT CONNECT ON DATABASE ${dbIdent} TO ww_api, ww_worker`);

    // Schemas: ww_api must never have USAGE on raw.
    await client.query(`REVOKE ALL ON SCHEMA raw FROM PUBLIC`);
    await client.query(`REVOKE ALL ON SCHEMA raw FROM ww_api`);
    await client.query(`GRANT USAGE ON SCHEMA ref, pub, app TO ww_api`);
    await client.query(`GRANT USAGE ON SCHEMA raw, ref, pub, app TO ww_worker`);

    // ww_api: read ref/pub; write caches; full DML on app.
    await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ref TO ww_api`);
    await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA pub TO ww_api`);
    await client.query(
      `GRANT INSERT, UPDATE, DELETE ON TABLE pub.weather_cache, pub.forecast_cache TO ww_api`,
    );
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO ww_api`,
    );
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO ww_api`);

    // ww_worker: DML on raw/ref/pub; ingest_runs only in app.
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA raw TO ww_worker`,
    );
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ref TO ww_worker`,
    );
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pub TO ww_worker`,
    );
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA raw, ref, pub TO ww_worker`);
    await client.query(`GRANT INSERT, UPDATE ON TABLE app.ingest_runs TO ww_worker`);
    await client.query(`GRANT USAGE, SELECT ON SEQUENCE app.ingest_runs_id_seq TO ww_worker`);

    // Future tables created by the owner keep the same policy.
    await client.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA ref GRANT SELECT ON TABLES TO ww_api;
      ALTER DEFAULT PRIVILEGES IN SCHEMA pub GRANT SELECT ON TABLES TO ww_api;
      ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ww_api;
      ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO ww_api;
      ALTER DEFAULT PRIVILEGES IN SCHEMA raw GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ww_worker;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ref GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ww_worker;
      ALTER DEFAULT PRIVILEGES IN SCHEMA pub GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ww_worker;
      ALTER DEFAULT PRIVILEGES IN SCHEMA raw GRANT USAGE, SELECT ON SEQUENCES TO ww_worker;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ref GRANT USAGE, SELECT ON SEQUENCES TO ww_worker;
      ALTER DEFAULT PRIVILEGES IN SCHEMA pub GRANT USAGE, SELECT ON SEQUENCES TO ww_worker;
    `);
  } finally {
    await client.end();
  }
}

/** Build a role connection URL from the owner DATABASE_URL. */
export function roleConnectionUrl(
  ownerUrl: string,
  role: 'ww_api' | 'ww_worker',
  password: string,
): string {
  const url = new URL(ownerUrl);
  url.username = role;
  url.password = password;
  return url.toString();
}
