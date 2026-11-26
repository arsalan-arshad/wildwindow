import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { reviewedKingfisherDetail, seasonalityFixture } from '@/__fixtures__/species-page';
import { buildSpeciesJsonLd } from '@/lib/json-ld';

import { SpeciesPageView } from './species-page';

describe('SpeciesPageView (W-03)', () => {
  it('renders seasonality, reviewed field card, and JSON-LD — with no map', () => {
    const jsonLd = buildSpeciesJsonLd({
      detail: reviewedKingfisherDetail,
      pageUrl: 'https://example.test/scotland/common-kingfisher',
      siteUrl: 'https://example.test',
      regionName: 'Scotland',
    });

    const { container } = render(
      <SpeciesPageView
        detail={reviewedKingfisherDetail}
        seasonality={seasonalityFixture}
        jsonLd={JSON.stringify(jsonLd)}
      />,
    );

    expect(screen.getByTestId('species-page')).toBeInTheDocument();
    expect(screen.getByTestId('species-page-name')).toHaveTextContent('Common kingfisher');
    expect(screen.getByTestId('species-page-scientific')).toHaveTextContent('Alcedo atthis');
    expect(screen.getByTestId('seasonality-chart')).toBeInTheDocument();
    expect(screen.getByTestId('seasonality-label')).toHaveTextContent(/relative reporting rate/i);
    expect(screen.getByTestId('species-field-card')).toBeInTheDocument();
    expect(screen.getByTestId('field-card-reviewed')).toHaveTextContent(/Test Reviewer/);
    expect(screen.getByTestId('field-card-settings')).toBeInTheDocument();
    expect(screen.getByTestId('setting-scene-perched')).toBeInTheDocument();
    expect(screen.getByTestId('field-card-ethics')).toBeInTheDocument();
    expect(screen.getByTestId('field-card-legal')).toBeInTheDocument();

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).toContain('"@type":"WebPage"');
    expect(script?.textContent).toContain('Alcedo atthis');
    expect(script?.textContent).not.toMatch(/lat|lng|longitude|latitude|coordinates/i);

    // No map UI, cells, or map API references on the public page.
    expect(container.querySelector('[data-testid="species-map"]')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.innerHTML).not.toMatch(/leaflet|mapbox|react-map|MapContainer|mapCells/i);
    expect(container.textContent).not.toMatch(/\bH3\b|cellR7|lat\/lng/i);
  });
});
