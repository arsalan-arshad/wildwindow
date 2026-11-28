import type { AttributionsResponse } from '@wildwindow/shared';

/** Fixture for S-17 attributions UI tests (no network). */
export const attributionsFixture: AttributionsResponse = {
  datasets: [
    {
      title: 'Zebra observations',
      publisher: 'Example Natural History Museum',
      license: 'CC0_1_0',
      citation: 'GBIF.org (2026) GBIF Occurrence Download https://doi.org/10.15468/dl.t515aa',
      doi: '10.15468/dl.t515aa',
    },
  ],
  providers: [
    {
      id: 'weather-metno',
      name: 'MET Norway',
      credit:
        'Weather forecasts from the Norwegian Meteorological Institute (api.met.no). Attribution required.',
      url: 'https://www.met.no/en',
    },
    {
      id: 'suncalc',
      name: 'suncalc',
      credit: 'Sunrise, sunset and golden-hour times via the suncalc library (BSD-2-Clause).',
      url: 'https://github.com/mourner/suncalc',
    },
  ],
};
