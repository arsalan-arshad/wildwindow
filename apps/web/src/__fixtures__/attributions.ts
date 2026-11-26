import type { AttributionsResponse } from '@wildwindow/shared/api';

/** Fixture for W-06 attributions UI tests (no network). */
export const attributionsFixture: AttributionsResponse = {
  datasets: [
    {
      title: 'Zebra observations',
      publisher: 'Example Natural History Museum',
      license: 'CC0_1_0',
      citation: 'GBIF.org (2026) GBIF Occurrence Download https://doi.org/10.15468/dl.t515aa',
      doi: '10.15468/dl.t515aa',
    },
    {
      title: 'Alpha checklist',
      publisher: 'GBIF',
      license: 'CC_BY_4_0',
      citation: 'GBIF occurrence download',
      doi: null,
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
      id: 'tide-none',
      name: 'Tides',
      credit:
        'Tide data is not used in the MVP (NoTideProvider). Coastal tide credits will appear when a licensed provider is enabled.',
    },
    {
      id: 'geonames',
      name: 'GeoNames',
      credit: 'Place names © GeoNames (CC BY 4.0).',
      url: 'https://www.geonames.org/',
    },
    {
      id: 'natural-earth',
      name: 'Natural Earth',
      credit: 'Region boundary polygons from Natural Earth (public domain).',
      url: 'https://www.naturalearthdata.com/',
    },
    {
      id: 'suncalc',
      name: 'suncalc',
      credit: 'Sunrise, sunset and golden-hour times via the suncalc library (BSD-2-Clause).',
      url: 'https://github.com/mourner/suncalc',
    },
  ],
};
