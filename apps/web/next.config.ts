import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Railway / Docker needs standalone. Vercel sets VERCEL=1 and uses its own
  // adapter packaging — leave `output` unset there (T9.5).
  ...(process.env['VERCEL'] ? {} : { output: 'standalone' as const }),
  // Monorepo: include files outside apps/web in the trace (pnpm hoisted deps).
  outputFileTracingRoot: path.join(configDir, '../..'),
  transpilePackages: ['@wildwindow/shared', '@wildwindow/geoprivacy'],
  // Shared package root also exports Node-only data scripts; browser code must
  // import `@wildwindow/shared/client` and `@wildwindow/shared/api/waitlist`.
  serverExternalPackages: [],
};

export default nextConfig;
