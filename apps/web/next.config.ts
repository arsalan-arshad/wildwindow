import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Required for apps/web/Dockerfile (Railway / container deploy).
  output: 'standalone',
  // Monorepo: include files outside apps/web in the trace (pnpm hoisted deps).
  outputFileTracingRoot: path.join(configDir, '../..'),
};

export default nextConfig;
