# Railway service config snippets

Canonical click-path, env checklist, and roles explanation: **[docs/RAILWAY.md](../../docs/RAILWAY.md)**.

| File           | Service             | Dockerfile                |
| -------------- | ------------------- | ------------------------- |
| `api.toml`     | `api`               | `apps/api/Dockerfile`     |
| `web.toml`     | `web`               | `apps/web/Dockerfile`     |
| `worker.toml`  | `worker`            | `apps/worker/Dockerfile`  |
| `migrate.toml` | `migrate` (one-off) | `apps/migrate/Dockerfile` |

PostGIS: prefer the Railway **PostGIS** template (`postgis/postgis:18-3.7`), not the plain Postgres plugin.
