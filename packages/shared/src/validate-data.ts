import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { type ZodError } from 'zod';

import {
  BetaSpeciesFileSchema,
  SensitiveSpeciesFileSchema,
  type BetaSpeciesFile,
  type SensitiveSpeciesFile,
} from './data-schemas.js';

export type DataValidationResult = {
  betaSpecies: BetaSpeciesFile;
  sensitiveSpecies: SensitiveSpeciesFile;
};

function formatZodError(label: string, error: ZodError): string {
  const lines = error.issues.map((issue) => {
    const pathLabel = issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)';
    return `  - ${pathLabel}: ${issue.message}`;
  });
  return `${label} is invalid:\n${lines.join('\n')}`;
}

export function validateDataDir(dataDir: string): DataValidationResult {
  const betaPath = path.join(dataDir, 'beta-species.yaml');
  const sensitivePath = path.join(dataDir, 'sensitive-species.yaml');

  const betaRaw: unknown = parseYaml(readFileSync(betaPath, 'utf8'));
  const sensitiveRaw: unknown = parseYaml(readFileSync(sensitivePath, 'utf8'));

  const beta = BetaSpeciesFileSchema.safeParse(betaRaw);
  if (!beta.success) {
    throw new Error(formatZodError('data/beta-species.yaml', beta.error));
  }

  const sensitive = SensitiveSpeciesFileSchema.safeParse(sensitiveRaw);
  if (!sensitive.success) {
    throw new Error(formatZodError('data/sensitive-species.yaml', sensitive.error));
  }

  return { betaSpecies: beta.data, sensitiveSpecies: sensitive.data };
}
