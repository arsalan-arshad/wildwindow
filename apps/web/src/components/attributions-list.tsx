import type { AttributionsResponse } from '@wildwindow/shared/api';

export type AttributionsListProps = {
  readonly data: AttributionsResponse;
};

function doiHref(doi: string): string {
  return doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
}

/** Presentational attributions list (W-06). Data comes from GET /v1/attributions or a fixture. */
export function AttributionsList({ data }: AttributionsListProps) {
  return (
    <div className="space-y-12" data-testid="attributions-list">
      <section aria-labelledby="datasets-heading">
        <h2
          id="datasets-heading"
          className="font-[family-name:var(--font-fraunces)] text-2xl text-ink"
        >
          Occurrence datasets
        </h2>
        <p className="mt-2 text-ink-muted">
          Historic sightings used for Window scores. Only GBIF records licensed CC0 1.0 or CC BY 4.0
          are kept.
        </p>
        {data.datasets.length === 0 ? (
          <p className="mt-6 text-ink-muted" role="status">
            No occurrence datasets have been loaded yet. Credits appear here after GBIF ingestion.
          </p>
        ) : (
          <ul className="mt-6 space-y-5">
            {data.datasets.map((dataset) => (
              <li
                key={`${dataset.title}:${dataset.doi ?? 'no-doi'}:${dataset.license}`}
                className="border-b border-forest-800/10 pb-5 last:border-b-0"
              >
                <h3 className="font-semibold text-ink">{dataset.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {dataset.publisher} · {dataset.license}
                </p>
                <p className="mt-2 text-sm text-ink-muted">{dataset.citation}</p>
                {dataset.doi !== null ? (
                  <p className="mt-2 text-sm">
                    DOI:{' '}
                    <a
                      href={doiHref(dataset.doi)}
                      className="font-medium text-forest-600 underline-offset-2 hover:underline"
                      rel="noopener noreferrer"
                    >
                      {dataset.doi}
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="providers-heading">
        <h2
          id="providers-heading"
          className="font-[family-name:var(--font-fraunces)] text-2xl text-ink"
        >
          Providers and libraries
        </h2>
        <p className="mt-2 text-ink-muted">
          Weather, tides, place names, boundaries, and light calculations.
        </p>
        <ul className="mt-6 space-y-5">
          {data.providers.map((provider) => (
            <li
              key={provider.id}
              data-testid={`provider-${provider.id}`}
              className="border-b border-forest-800/10 pb-5 last:border-b-0"
            >
              <h3 className="font-semibold text-ink">{provider.name}</h3>
              <p className="mt-2 text-sm text-ink-muted">{provider.credit}</p>
              {provider.url !== undefined ? (
                <p className="mt-2 text-sm">
                  <a
                    href={provider.url}
                    className="font-medium text-forest-600 underline-offset-2 hover:underline"
                    rel="noopener noreferrer"
                  >
                    {provider.url}
                  </a>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
