/**
 * Linear-time Bearer parse (avoid `/^Bearer\s+/i` ReDoS on long space runs).
 * Same approach as waitlist admin token extraction.
 */
export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }
  const trimmed = authorization.trim();
  if (trimmed.length < 7 || trimmed.slice(0, 6).toLowerCase() !== 'bearer') {
    return undefined;
  }
  const afterBearer = trimmed.slice(6);
  if (afterBearer.length === 0 || (afterBearer[0] !== ' ' && afterBearer[0] !== '\t')) {
    return undefined;
  }
  const token = afterBearer.trimStart();
  return token.length > 0 ? token : undefined;
}
