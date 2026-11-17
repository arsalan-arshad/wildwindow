import { type z, type ZodTypeAny } from 'zod';

export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/**
 * Parse `source` (default `process.env`) with a Zod object schema.
 * Throws one `EnvValidationError` listing every missing or invalid key.
 */
export function loadEnv<TSchema extends ZodTypeAny>(
  schema: TSchema,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data as z.infer<TSchema>;
  }

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });

  throw new EnvValidationError(issues);
}
