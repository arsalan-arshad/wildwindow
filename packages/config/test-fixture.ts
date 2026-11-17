/** Acceptance fixture for T0.2 — must typecheck under strict rules (no implicit any). */
export function identity<T>(value: T): T {
  return value;
}

export const sample: string = identity('ok');
