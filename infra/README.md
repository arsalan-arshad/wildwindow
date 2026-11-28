# WildWindow AWS CDK (Milestone H)

TypeScript CDK app for the production AWS path (ARCHITECTURE §11). **Railway** (`infra/railway/`, [docs/RAILWAY.md](../docs/RAILWAY.md)) remains the interim staging host until cutover.

## T9.2 scope (this package)

| Resource          | Notes                                                                     |
| ----------------- | ------------------------------------------------------------------------- |
| VPC               | Public + private-with-egress + isolated; 1 NAT                            |
| RDS PostgreSQL 16 | `db.t4g.micro`, single-AZ; **PostGIS via migration** (`CREATE EXTENSION`) |
| ECR               | API image repository                                                      |
| ECS Fargate       | 256 CPU / 512 MiB, 1 task, private subnets                                |
| ALB               | HTTP :80 → `/v1/health` (TLS/ACM when Arsalan attaches a cert)            |
| Secrets Manager   | Empty shells for API app secrets and DB app-role URLs (no values in CDK)  |

**T9.3 (Railway, live):** scheduled worker jobs + Cloudflare R2 are documented in [`infra/railway/`](./railway/) and [docs/RAILWAY.md](../docs/RAILWAY.md) — daily `purge-deleted`, monthly `ingest:pipeline`, R2 already used by api/worker. **Optional AWS cutover (T9.3b):** EventBridge Scheduler, S3, CloudFront, and KMS on top of this CDK network — not required while Railway is production.

## Commands

```bash
pnpm install
pnpm --filter @wildwindow/infra test    # snapshot + resource assertions
pnpm --filter @wildwindow/infra synth   # cdk synth (no AWS account required)
```

Default region: **eu-west-2**. Override with `CDK_DEFAULT_REGION` / context `stage`.

## Deploy (Arsalan only)

Do **not** `cdk deploy` from agents. Needs:

1. AWS account + IAM for CDK bootstrap
2. Confirm region (default `eu-west-2`)
3. Explicit approval to run `cdk bootstrap` and `cdk deploy`
4. Push an API image to ECR and populate Secrets Manager shells before the service is healthy
