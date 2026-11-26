/**
 * Extract a DOI from a citation string when it embeds a doi.org URL
 * (worker upsert sets citation to `https://doi.org/<doi>` — T3.8).
 */
export function doiFromCitation(citation: string): string | null {
  const trimmed = citation.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = /(?:https?:\/\/)?(?:dx\.)?doi\.org\/(10\.\S+)/i.exec(trimmed);
  if (match?.[1] === undefined) {
    return null;
  }

  // Strip trailing punctuation that sometimes rides along in prose citations.
  const doi = match[1].replace(/[.,;:)]+$/u, '');
  return doi.length > 0 ? doi : null;
}
