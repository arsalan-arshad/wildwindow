/**
 * List species cards that still load as `draft` (T8.2 acceptance).
 * Usage: `pnpm data:cards:draft` or `pnpm --filter @wildwindow/shared list-draft-cards`
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpeciesCardsFromDir } from '../src/species-cards.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const cardsRoot = process.argv[2] ?? path.join(repoRoot, 'data', 'species-cards');

async function main(): Promise<void> {
  const cards = await loadSpeciesCardsFromDir(cardsRoot);
  const drafts = cards.filter((card) => card.status === 'draft');
  const reviewed = cards.filter((card) => card.status === 'reviewed');

  // eslint-disable-next-line no-console -- CLI output
  console.log(
    `Species cards in ${cardsRoot}: total=${String(cards.length)} draft=${String(drafts.length)} reviewed=${String(reviewed.length)}`,
  );

  if (drafts.length === 0) {
    // eslint-disable-next-line no-console -- CLI output
    console.log('No draft cards.');
    return;
  }

  // eslint-disable-next-line no-console -- CLI output
  console.log('Still draft:');
  for (const card of drafts) {
    // eslint-disable-next-line no-console -- CLI output
    console.log(`  - ${card.region}/${card.slug}.md  (${card.scientificName})`);
  }
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- CLI error path
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
