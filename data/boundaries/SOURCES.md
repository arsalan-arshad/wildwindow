# Region and zone boundary sources

Simplified GeoJSON for WildWindow beta regions and label-only zones.

## Regions (`scotland.geojson`, `sindh.geojson`)

| File               | Region   | Source                                                                                                                                                   | Licence                                                                                     | Retrieved  |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| `scotland.geojson` | Scotland | [Natural Earth](https://www.naturalearthdata.com/) 10m Admin-1 States/Provinces — all features with `geonunit=Scotland`, dissolved into one MultiPolygon | Public domain ([Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)) | 2026-11-17 |
| `sindh.geojson`    | Sindh    | Natural Earth 10m Admin-1 — feature `iso_3166_2=PK-SD` (`name=Sind`)                                                                                     | Public domain                                                                               | 2026-11-17 |

Upstream file used: `ne_10m_admin_1_states_provinces.geojson` from the [natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) repository (`master` as of the retrieval date).

Simplification: Shapely `simplify(..., tolerance=0.02, preserve_topology=True)` (degrees) so the committed polygons stay small for seeds and tests. Acceptance points Glasgow (−4.25, 55.86) and Karachi (67.01, 24.86) remain inside the simplified polygons.

## Zones (`zones/scotland.geojson`, `zones/sindh.geojson`) — labels only (T2.9)

| File                     | Region   | Kind           | Source                                                                                                                                         | Licence                                                                                                                                                                | Retrieved  |
| ------------------------ | -------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `zones/scotland.geojson` | Scotland | `council_area` | [geoBoundaries](https://www.geoboundaries.org/) `gbOpen` GBR ADM2 (ONS Open Geography Portal), features clipped to the Scotland region polygon | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/); Contains OS data © Crown copyright and database right 2026 | 2026-11-25 |
| `zones/sindh.geojson`    | Sindh    | `district`     | geoBoundaries `gbOpen` PAK ADM2 (geoBoundaries / Wikipedia), features clipped to the Sindh region polygon                                      | Public Domain (per geoBoundaries `boundaryLicense` for PAK ADM2)                                                                                                       | 2026-11-25 |

Cite geoBoundaries: Runfola et al. (2020), geoBoundaries: A global database of political administrative boundaries, PLoS ONE 15(4): e0231866.

Simplification: clipped intersection with the beta region, then Shapely `simplify(..., tolerance=0.025, preserve_topology=True)`. These polygons are for **area labels only** — never for exact wildlife pins (ARCHITECTURE §5 / No-Pin Promise).

Do **not** use these boundaries for exact wildlife pins — only for region coverage and coarse area labels.
