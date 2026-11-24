# Place name sources

GeoNames dumps used to seed `ref.places` (T2.8 / ARCHITECTURE §3.1).

| Dump     | Region coverage              | Source                                                              | Licence                                                              | Notes                                    |
| -------- | ---------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| `GB.zip` | Filtered to Scotland polygon | [GeoNames export](https://download.geonames.org/export/dump/GB.zip) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (GeoNames) | Keep `P*` populated + `L.PRK` parks only |
| `PK.zip` | Filtered to Sindh polygon    | [GeoNames export](https://download.geonames.org/export/dump/PK.zip) | CC BY 4.0                                                            | Same feature filter                      |

Attribution: place names © GeoNames contributors.

Raw dumps are **not** committed (`data/dumps/` is git-ignored). Run `pnpm data:places` to download and seed. Tests use `packages/db/__fixtures__/geonames-sample.tsv` (no network).

Every stored place is snapped to an H3 res-7 `cell_r7` via `@wildwindow/geoprivacy` `snapToCell` — exact lat/lng from the dump are not stored in `ref.places`.
