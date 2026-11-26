import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { snapToCell } from '@wildwindow/geoprivacy';

import { ShareCardPreview } from '@/components/share/ShareCardPreview';
import { cardUrlHasCoordinates } from '@/lib/share-cards';
import { renderWithProviders } from '../testing/test-utils';

const CELL = snapToCell(55.86, -4.25, 7);
const SITE = 'https://cards.wildwindow.test';

function imageUri(view: {
  getByTestId: (id: string) => { props: { source?: { uri?: string } } };
}): string {
  const image = view.getByTestId('share-card-image');
  const source = image.props.source;
  if (source === undefined || typeof source.uri !== 'string') {
    throw new Error('share-card-image missing source.uri');
  }
  return source.uri;
}

describe('Share card preview (T6.11 S-15)', () => {
  it('previews the forecast OG image URL with no coordinates', async () => {
    const onShare = jest.fn(async () => 'shared' as const);
    const view = await renderWithProviders(
      <ShareCardPreview
        target={{ kind: 'forecast', taxonId: '2481', cell: CELL, start: '2026-11-20' }}
        siteUrl={SITE}
        onShare={onShare}
      />,
    );

    expect(view.getByTestId('share-card-preview')).toBeTruthy();
    expect(view.getByTestId('share-card-title')).toBeTruthy();

    const url = imageUri(view);
    expect(url).toContain('/api/og/forecast?');
    expect(url).toContain('taxonId=2481');
    expect(url).toContain(`cell=${encodeURIComponent(CELL)}`);
    expect(url).toContain('start=2026-11-20');
    expect(cardUrlHasCoordinates(url)).toBe(false);
    expect(url).not.toMatch(/55\.86|-4\.25|lat=|lng=/i);

    fireEvent.press(view.getByTestId('share-card-button'));
    await waitFor(() => {
      expect(onShare).toHaveBeenCalledWith(url);
    });
  });

  it('previews the challenge OG image URL with no coordinates', async () => {
    const onShare = jest.fn(async () => 'shared' as const);
    const view = await renderWithProviders(
      <ShareCardPreview
        target={{
          kind: 'challenge',
          entryId: 'entry-99',
          slug: 'kingfisher-month-2026-11',
        }}
        siteUrl={SITE}
        onShare={onShare}
      />,
    );

    const url = imageUri(view);
    expect(url).toBe(`${SITE}/api/og/challenge/entry-99?slug=kingfisher-month-2026-11`);
    expect(cardUrlHasCoordinates(url)).toBe(false);
    expect(url).not.toMatch(/[-+]?\d{1,3}\.\d{3,}/);

    fireEvent.press(view.getByTestId('share-card-button'));
    await waitFor(() => {
      expect(onShare).toHaveBeenCalledTimes(1);
    });
  });

  it('shows an unavailable message when sharing is not available', async () => {
    const view = await renderWithProviders(
      <ShareCardPreview
        target={{ kind: 'challenge', entryId: 'entry-1' }}
        siteUrl={SITE}
        onShare={async () => 'unavailable'}
      />,
    );

    fireEvent.press(view.getByTestId('share-card-button'));
    await waitFor(() => {
      expect(view.getByTestId('share-card-unavailable')).toBeTruthy();
    });
  });
});
