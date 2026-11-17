# Region boundary sources

Simplified GeoJSON for WildWindow beta regions (`scotland.geojson`, `sindh.geojson`).

| File               | Region   | Source                                                                                                                                                   | Licence                                                                                     | Retrieved  |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| `scotland.geojson` | Scotland | [Natural Earth](https://www.naturalearthdata.com/) 10m Admin-1 States/Provinces — all features with `geonunit=Scotland`, dissolved into one MultiPolygon | Public domain ([Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)) | 2026-11-17 |
| `sindh.geojson`    | Sindh    | Natural Earth 10m Admin-1 — feature `iso_3166_2=PK-SD` (`name=Sind`)                                                                                     | Public domain                                                                               | 2026-11-17 |

Upstream file used: `ne_10m_admin_1_states_provinces.geojson` from the [natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) repository (`master` as of the retrieval date).

Simplification: Shapely `simplify(..., tolerance=0.02, preserve_topology=True)` (degrees) so the committed polygons stay small for seeds and tests. Acceptance points Glasgow (−4.25, 55.86) and Karachi (67.01, 24.86) remain inside the simplified polygons.

Do **not** use these boundaries for exact wildlife pins — only for region coverage (ARCHITECTURE §5 / No-Pin Promise).
