/** Species activity patterns from `data/beta-species.yaml` / ARCHITECTURE §3.3. */
export type ActivityPattern = 'diurnal' | 'crepuscular' | 'nocturnal' | 'tidal';

export const ACTIVITY_PATTERNS = [
  'diurnal',
  'crepuscular',
  'nocturnal',
  'tidal',
] as const satisfies readonly ActivityPattern[];

export function isActivityPattern(value: string): value is ActivityPattern {
  return (ACTIVITY_PATTERNS as readonly string[]).includes(value);
}
