import { describe, expect, it } from 'vitest';

import { collectDatasetAttributions } from './upsert-datasets.js';

describe('collectDatasetAttributions', () => {
  it('dedupes by dataset key and keeps the first license', () => {
    const attributions = collectDatasetAttributions([
      { datasetKey: 'ds-b', license: 'CC0_1_0' },
      { datasetKey: 'ds-a', license: 'CC_BY_4_0' },
      { datasetKey: 'ds-b', license: 'CC_BY_4_0' },
    ]);
    expect(attributions).toEqual([
      { datasetKey: 'ds-a', license: 'CC_BY_4_0' },
      { datasetKey: 'ds-b', license: 'CC0_1_0' },
    ]);
  });
});
