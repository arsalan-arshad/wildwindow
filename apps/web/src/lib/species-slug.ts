/**
 * SEO slug helpers for W-03 species pages (`/[region]/[species]`).
 */

/** Lowercase kebab-case from an English common name (or any display label). */
export function slugifySpeciesName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'species';
}

/**
 * Prefer a unique slug per region. On collision, append the taxon id.
 * Callers pass already-chosen slugs for the region when resolving.
 */
export function uniqueSpeciesSlug(
  englishName: string,
  taxonId: string,
  taken: ReadonlySet<string>,
): string {
  const base = slugifySpeciesName(englishName);
  if (!taken.has(base)) {
    return base;
  }
  const withId = `${base}-${taxonId}`;
  if (!taken.has(withId)) {
    return withId;
  }
  let n = 2;
  while (taken.has(`${withId}-${String(n)}`)) {
    n += 1;
  }
  return `${withId}-${String(n)}`;
}
