/** Coastal tide preference from `data/beta-species.yaml` / ARCHITECTURE §3.3. */
export type TidePref = 'high' | 'low' | 'rising' | 'falling' | 'none';

export const TIDE_PREFS = [
  'high',
  'low',
  'rising',
  'falling',
  'none',
] as const satisfies readonly TidePref[];

export function isTidePref(value: string): value is TidePref {
  return (TIDE_PREFS as readonly string[]).includes(value);
}
