# Sensitivity review — Sindh

Pack for conservation reviewers before public launch (**PRD E6**).
Proposed tiers come from `data/sensitive-species.yaml` joined to the beta species list.
Sign-off updates that YAML (`reviewer`, `reviewedAt`) — do not lower a tier without an audit trail.

- Region: `sindh`
- Generated (UTC): 2026-11-26T08:18:09.090Z
- Species in pack: 26
- Awaiting sign-off: 26
- Missing from sensitive YAML (defaulted to `protected`): 0

## How to use this pack

1. Read each species row: proposed tier, lockout months, and reason.
2. Prefer the **higher** tier when unsure (PRD E1).
3. Confirm or amend lockout months for breeding / nesting seasons.
4. Record `reviewer` and `reviewedAt` on each signed-off row in `data/sensitive-species.yaml`.
5. Only an admin may lower a tier later; the change is audit-logged (PRD US-15).

## Tier policy summary (PRD §9.2 / ARCHITECTURE §5.1)

| Tier               | Public resolution                      | Record delay | Min cell                   | Breeding lockout |
| ------------------ | -------------------------------------- | -----------: | -------------------------- | ---------------- |
| `open`             | H3 res 7 (~5 km²)                      |            0 | ≥ 5 records, ≥ 3 observers | no               |
| `protected`        | H3 res 5 (~250 km²)                    |           30 | ≥ 10 / ≥ 5                 | optional         |
| `highly_protected` | H3 res 4 (~1,770 km²), area label only |          365 | ≥ 20 / ≥ 8                 | **yes**          |
| `no_forecast`      | not shown / never forecast             |          n/a | n/a                        | always           |

### Counts in this pack

| Tier             | Count |
| ---------------- | ----: |
| open             |    16 |
| protected        |     8 |
| highly_protected |     2 |
| no_forecast      |     0 |

## Sindh references

- Provincial wildlife law and protected-area permit rules apply (PRD E8). Confirm exact legal wording with the named Sindh reviewer before launch.
- Prefer higher tiers for turtles, otters, Indus river dolphin, and other locally sensitive taxa.

## Summary table

| Common name             | Scientific                 | Group   | Proposed tier      | Lockout months               | Reason                                                                       | Links                                                                                                                                            | Sign-off  |
| ----------------------- | -------------------------- | ------- | ------------------ | ---------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Green turtle            | _Chelonia mydas_           | reptile | `highly_protected` | Jun, Jul, Aug, Sep, Oct, Nov | Green turtle nesting lockout — PRD §9.2 / ARCHITECTURE §3.3 highly_protected | [GBIF taxon](https://www.gbif.org/species/2442225); [IUCN Red List search](https://www.iucnredlist.org/search?query=Chelonia%20mydas)            | _pending_ |
| Pallas's fish-eagle     | _Haliaeetus leucoryphus_   | bird    | `highly_protected` | Oct, Nov, Dec, Jan, Feb, Mar | Pallas's fish-eagle — prefer higher tier when unsure                         | [GBIF taxon](https://www.gbif.org/species/2480453); [IUCN Red List search](https://www.iucnredlist.org/search?query=Haliaeetus%20leucoryphus)    | _pending_ |
| Chinkara                | _Gazella bennettii_        | mammal  | `protected`        | —                            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).          | [GBIF taxon](https://www.gbif.org/species/5220147); [IUCN Red List search](https://www.iucnredlist.org/search?query=Gazella%20bennettii)         | _pending_ |
| Indian cobra            | _Naja naja_                | reptile | `protected`        | —                            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).          | [GBIF taxon](https://www.gbif.org/species/2470351); [IUCN Red List search](https://www.iucnredlist.org/search?query=Naja%20naja)                 | _pending_ |
| Indian flapshell turtle | _Lissemys punctata_        | reptile | `protected`        | —                            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).          | [GBIF taxon](https://www.gbif.org/species/2442758); [IUCN Red List search](https://www.iucnredlist.org/search?query=Lissemys%20punctata)         | _pending_ |
| Indus river dolphin     | _Platanista gangetica_     | marine  | `protected`        | —                            | Indus river dolphin — PRD §9.2 / ARCHITECTURE §3.3 protected                 | [GBIF taxon](https://www.gbif.org/species/2440764); [IUCN Red List search](https://www.iucnredlist.org/search?query=Platanista%20gangetica)      | _pending_ |
| Jungle cat              | _Felis chaus_              | mammal  | `protected`        | —                            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).          | [GBIF taxon](https://www.gbif.org/species/2435066); [IUCN Red List search](https://www.iucnredlist.org/search?query=Felis%20chaus)               | _pending_ |
| Mugger crocodile        | _Crocodylus palustris_     | reptile | `protected`        | —                            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).          | [GBIF taxon](https://www.gbif.org/species/2441350); [IUCN Red List search](https://www.iucnredlist.org/search?query=Crocodylus%20palustris)      | _pending_ |
| Smooth-coated otter     | _Lutrogale perspicillata_  | mammal  | `protected`        | —                            | Smooth-coated otter — PRD §9.2 / ARCHITECTURE §3.3 protected                 | [GBIF taxon](https://www.gbif.org/species/2433686); [IUCN Red List search](https://www.iucnredlist.org/search?query=Lutrogale%20perspicillata)   | _pending_ |
| Striped hyena           | _Hyaena hyaena_            | mammal  | `protected`        | —                            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).          | [GBIF taxon](https://www.gbif.org/species/5218777); [IUCN Red List search](https://www.iucnredlist.org/search?query=Hyaena%20hyaena)             | _pending_ |
| Asian openbill          | _Anastomus oscitans_       | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/5229410); [IUCN Red List search](https://www.iucnredlist.org/search?query=Anastomus%20oscitans)        | _pending_ |
| Cattle egret            | _Bubulcus ibis_            | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/2480830); [IUCN Red List search](https://www.iucnredlist.org/search?query=Bubulcus%20ibis)             | _pending_ |
| Chital                  | _Axis axis_                | mammal  | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/2440934); [IUCN Red List search](https://www.iucnredlist.org/search?query=Axis%20axis)                 | _pending_ |
| Common crane            | _Grus grus_                | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/2474950); [IUCN Red List search](https://www.iucnredlist.org/search?query=Grus%20grus)                 | _pending_ |
| Common kingfisher       | _Alcedo atthis_            | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/2475532); [IUCN Red List search](https://www.iucnredlist.org/search?query=Alcedo%20atthis)             | _pending_ |
| Golden jackal           | _Canis aureus_             | mammal  | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/5219219); [IUCN Red List search](https://www.iucnredlist.org/search?query=Canis%20aureus)              | _pending_ |
| Great white pelican     | _Pelecanus onocrotalus_    | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/2480350); [IUCN Red List search](https://www.iucnredlist.org/search?query=Pelecanus%20onocrotalus)     | _pending_ |
| Greater flamingo        | _Phoenicopterus roseus_    | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/4352332); [IUCN Red List search](https://www.iucnredlist.org/search?query=Phoenicopterus%20roseus)     | _pending_ |
| Grey francolin          | _Ortygornis pondicerianus_ | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/11273070); [IUCN Red List search](https://www.iucnredlist.org/search?query=Ortygornis%20pondicerianus) | _pending_ |
| Grey-headed swamphen    | _Porphyrio poliocephalus_  | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/5739284); [IUCN Red List search](https://www.iucnredlist.org/search?query=Porphyrio%20poliocephalus)   | _pending_ |
| Indian peafowl          | _Pavo cristatus_           | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/9451184); [IUCN Red List search](https://www.iucnredlist.org/search?query=Pavo%20cristatus)            | _pending_ |
| Little egret            | _Egretta garzetta_         | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/2480876); [IUCN Red List search](https://www.iucnredlist.org/search?query=Egretta%20garzetta)          | _pending_ |
| Rose-ringed parakeet    | _Psittacula krameri_       | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/2479226); [IUCN Red List search](https://www.iucnredlist.org/search?query=Psittacula%20krameri)        | _pending_ |
| Ruddy shelduck          | _Tadorna ferruginea_       | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/2498015); [IUCN Red List search](https://www.iucnredlist.org/search?query=Tadorna%20ferruginea)        | _pending_ |
| Western marsh harrier   | _Circus aeruginosus_       | bird    | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/2480482); [IUCN Red List search](https://www.iucnredlist.org/search?query=Circus%20aeruginosus)        | _pending_ |
| Wild boar               | _Sus scrofa_               | mammal  | `open`             | —                            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).       | [GBIF taxon](https://www.gbif.org/species/7705930); [IUCN Red List search](https://www.iucnredlist.org/search?query=Sus%20scrofa)                | _pending_ |

## Species detail

### Green turtle / سبز کچھوا (_Chelonia mydas_)

| Field             | Value                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | reptile                                                                                                                               |
| Proposed tier     | `highly_protected` — Highly protected (H3 res 4; 365-day record delay; breeding lockout required)                                     |
| Lockout months    | Jun, Jul, Aug, Sep, Oct, Nov                                                                                                          |
| Reason            | Green turtle nesting lockout — PRD §9.2 / ARCHITECTURE §3.3 highly_protected                                                          |
| Links             | [GBIF taxon](https://www.gbif.org/species/2442225); [IUCN Red List search](https://www.iucnredlist.org/search?query=Chelonia%20mydas) |
| Reviewer          | _pending_                                                                                                                             |
| Reviewed at       | _pending_                                                                                                                             |
| In sensitive YAML | yes                                                                                                                                   |

### Pallas's fish-eagle (_Haliaeetus leucoryphus_)

| Field             | Value                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                          |
| Proposed tier     | `highly_protected` — Highly protected (H3 res 4; 365-day record delay; breeding lockout required)                                             |
| Lockout months    | Oct, Nov, Dec, Jan, Feb, Mar                                                                                                                  |
| Reason            | Pallas's fish-eagle — prefer higher tier when unsure                                                                                          |
| Links             | [GBIF taxon](https://www.gbif.org/species/2480453); [IUCN Red List search](https://www.iucnredlist.org/search?query=Haliaeetus%20leucoryphus) |
| Reviewer          | _pending_                                                                                                                                     |
| Reviewed at       | _pending_                                                                                                                                     |
| In sensitive YAML | yes                                                                                                                                           |

### Chinkara (_Gazella bennettii_)

| Field             | Value                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | mammal                                                                                                                                   |
| Proposed tier     | `protected` — Protected (H3 res 5; 30-day record delay; optional breeding lockout)                                                       |
| Lockout months    | —                                                                                                                                        |
| Reason            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).                                                                      |
| Links             | [GBIF taxon](https://www.gbif.org/species/5220147); [IUCN Red List search](https://www.iucnredlist.org/search?query=Gazella%20bennettii) |
| Reviewer          | _pending_                                                                                                                                |
| Reviewed at       | _pending_                                                                                                                                |
| In sensitive YAML | yes                                                                                                                                      |

### Indian cobra (_Naja naja_)

| Field             | Value                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Group             | reptile                                                                                                                          |
| Proposed tier     | `protected` — Protected (H3 res 5; 30-day record delay; optional breeding lockout)                                               |
| Lockout months    | —                                                                                                                                |
| Reason            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).                                                              |
| Links             | [GBIF taxon](https://www.gbif.org/species/2470351); [IUCN Red List search](https://www.iucnredlist.org/search?query=Naja%20naja) |
| Reviewer          | _pending_                                                                                                                        |
| Reviewed at       | _pending_                                                                                                                        |
| In sensitive YAML | yes                                                                                                                              |

### Indian flapshell turtle (_Lissemys punctata_)

| Field             | Value                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | reptile                                                                                                                                  |
| Proposed tier     | `protected` — Protected (H3 res 5; 30-day record delay; optional breeding lockout)                                                       |
| Lockout months    | —                                                                                                                                        |
| Reason            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).                                                                      |
| Links             | [GBIF taxon](https://www.gbif.org/species/2442758); [IUCN Red List search](https://www.iucnredlist.org/search?query=Lissemys%20punctata) |
| Reviewer          | _pending_                                                                                                                                |
| Reviewed at       | _pending_                                                                                                                                |
| In sensitive YAML | yes                                                                                                                                      |

### Indus river dolphin / بلھن (_Platanista gangetica_)

| Field             | Value                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | marine                                                                                                                                      |
| Proposed tier     | `protected` — Protected (H3 res 5; 30-day record delay; optional breeding lockout)                                                          |
| Lockout months    | —                                                                                                                                           |
| Reason            | Indus river dolphin — PRD §9.2 / ARCHITECTURE §3.3 protected                                                                                |
| Links             | [GBIF taxon](https://www.gbif.org/species/2440764); [IUCN Red List search](https://www.iucnredlist.org/search?query=Platanista%20gangetica) |
| Reviewer          | _pending_                                                                                                                                   |
| Reviewed at       | _pending_                                                                                                                                   |
| In sensitive YAML | yes                                                                                                                                         |

### Jungle cat (_Felis chaus_)

| Field             | Value                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Group             | mammal                                                                                                                             |
| Proposed tier     | `protected` — Protected (H3 res 5; 30-day record delay; optional breeding lockout)                                                 |
| Lockout months    | —                                                                                                                                  |
| Reason            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).                                                                |
| Links             | [GBIF taxon](https://www.gbif.org/species/2435066); [IUCN Red List search](https://www.iucnredlist.org/search?query=Felis%20chaus) |
| Reviewer          | _pending_                                                                                                                          |
| Reviewed at       | _pending_                                                                                                                          |
| In sensitive YAML | yes                                                                                                                                |

### Mugger crocodile (_Crocodylus palustris_)

| Field             | Value                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | reptile                                                                                                                                     |
| Proposed tier     | `protected` — Protected (H3 res 5; 30-day record delay; optional breeding lockout)                                                          |
| Lockout months    | —                                                                                                                                           |
| Reason            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).                                                                         |
| Links             | [GBIF taxon](https://www.gbif.org/species/2441350); [IUCN Red List search](https://www.iucnredlist.org/search?query=Crocodylus%20palustris) |
| Reviewer          | _pending_                                                                                                                                   |
| Reviewed at       | _pending_                                                                                                                                   |
| In sensitive YAML | yes                                                                                                                                         |

### Smooth-coated otter / آبی اوٹر (_Lutrogale perspicillata_)

| Field             | Value                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | mammal                                                                                                                                         |
| Proposed tier     | `protected` — Protected (H3 res 5; 30-day record delay; optional breeding lockout)                                                             |
| Lockout months    | —                                                                                                                                              |
| Reason            | Smooth-coated otter — PRD §9.2 / ARCHITECTURE §3.3 protected                                                                                   |
| Links             | [GBIF taxon](https://www.gbif.org/species/2433686); [IUCN Red List search](https://www.iucnredlist.org/search?query=Lutrogale%20perspicillata) |
| Reviewer          | _pending_                                                                                                                                      |
| Reviewed at       | _pending_                                                                                                                                      |
| In sensitive YAML | yes                                                                                                                                            |

### Striped hyena (_Hyaena hyaena_)

| Field             | Value                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Group             | mammal                                                                                                                               |
| Proposed tier     | `protected` — Protected (H3 res 5; 30-day record delay; optional breeding lockout)                                                   |
| Lockout months    | —                                                                                                                                    |
| Reason            | Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).                                                                  |
| Links             | [GBIF taxon](https://www.gbif.org/species/5218777); [IUCN Red List search](https://www.iucnredlist.org/search?query=Hyaena%20hyaena) |
| Reviewer          | _pending_                                                                                                                            |
| Reviewed at       | _pending_                                                                                                                            |
| In sensitive YAML | yes                                                                                                                                  |

### Asian openbill (_Anastomus oscitans_)

| Field             | Value                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                      |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                            |
| Lockout months    | —                                                                                                                                         |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                    |
| Links             | [GBIF taxon](https://www.gbif.org/species/5229410); [IUCN Red List search](https://www.iucnredlist.org/search?query=Anastomus%20oscitans) |
| Reviewer          | _pending_                                                                                                                                 |
| Reviewed at       | _pending_                                                                                                                                 |
| In sensitive YAML | yes                                                                                                                                       |

### Cattle egret (_Bubulcus ibis_)

| Field             | Value                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Group             | bird                                                                                                                                 |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                       |
| Lockout months    | —                                                                                                                                    |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                               |
| Links             | [GBIF taxon](https://www.gbif.org/species/2480830); [IUCN Red List search](https://www.iucnredlist.org/search?query=Bubulcus%20ibis) |
| Reviewer          | _pending_                                                                                                                            |
| Reviewed at       | _pending_                                                                                                                            |
| In sensitive YAML | yes                                                                                                                                  |

### Chital (_Axis axis_)

| Field             | Value                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Group             | mammal                                                                                                                           |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                   |
| Lockout months    | —                                                                                                                                |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                           |
| Links             | [GBIF taxon](https://www.gbif.org/species/2440934); [IUCN Red List search](https://www.iucnredlist.org/search?query=Axis%20axis) |
| Reviewer          | _pending_                                                                                                                        |
| Reviewed at       | _pending_                                                                                                                        |
| In sensitive YAML | yes                                                                                                                              |

### Common crane (_Grus grus_)

| Field             | Value                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                             |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                   |
| Lockout months    | —                                                                                                                                |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                           |
| Links             | [GBIF taxon](https://www.gbif.org/species/2474950); [IUCN Red List search](https://www.iucnredlist.org/search?query=Grus%20grus) |
| Reviewer          | _pending_                                                                                                                        |
| Reviewed at       | _pending_                                                                                                                        |
| In sensitive YAML | yes                                                                                                                              |

### Common kingfisher / عام کنگ فشر (_Alcedo atthis_)

| Field             | Value                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Group             | bird                                                                                                                                 |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                       |
| Lockout months    | —                                                                                                                                    |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                               |
| Links             | [GBIF taxon](https://www.gbif.org/species/2475532); [IUCN Red List search](https://www.iucnredlist.org/search?query=Alcedo%20atthis) |
| Reviewer          | _pending_                                                                                                                            |
| Reviewed at       | _pending_                                                                                                                            |
| In sensitive YAML | yes                                                                                                                                  |

### Golden jackal (_Canis aureus_)

| Field             | Value                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Group             | mammal                                                                                                                              |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                      |
| Lockout months    | —                                                                                                                                   |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                              |
| Links             | [GBIF taxon](https://www.gbif.org/species/5219219); [IUCN Red List search](https://www.iucnredlist.org/search?query=Canis%20aureus) |
| Reviewer          | _pending_                                                                                                                           |
| Reviewed at       | _pending_                                                                                                                           |
| In sensitive YAML | yes                                                                                                                                 |

### Great white pelican (_Pelecanus onocrotalus_)

| Field             | Value                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                         |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                               |
| Lockout months    | —                                                                                                                                            |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                       |
| Links             | [GBIF taxon](https://www.gbif.org/species/2480350); [IUCN Red List search](https://www.iucnredlist.org/search?query=Pelecanus%20onocrotalus) |
| Reviewer          | _pending_                                                                                                                                    |
| Reviewed at       | _pending_                                                                                                                                    |
| In sensitive YAML | yes                                                                                                                                          |

### Greater flamingo (_Phoenicopterus roseus_)

| Field             | Value                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                         |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                               |
| Lockout months    | —                                                                                                                                            |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                       |
| Links             | [GBIF taxon](https://www.gbif.org/species/4352332); [IUCN Red List search](https://www.iucnredlist.org/search?query=Phoenicopterus%20roseus) |
| Reviewer          | _pending_                                                                                                                                    |
| Reviewed at       | _pending_                                                                                                                                    |
| In sensitive YAML | yes                                                                                                                                          |

### Grey francolin (_Ortygornis pondicerianus_)

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Group             | bird                                                                                                                                             |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                                   |
| Lockout months    | —                                                                                                                                                |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                           |
| Links             | [GBIF taxon](https://www.gbif.org/species/11273070); [IUCN Red List search](https://www.iucnredlist.org/search?query=Ortygornis%20pondicerianus) |
| Reviewer          | _pending_                                                                                                                                        |
| Reviewed at       | _pending_                                                                                                                                        |
| In sensitive YAML | yes                                                                                                                                              |

### Grey-headed swamphen (_Porphyrio poliocephalus_)

| Field             | Value                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                           |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                                 |
| Lockout months    | —                                                                                                                                              |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                         |
| Links             | [GBIF taxon](https://www.gbif.org/species/5739284); [IUCN Red List search](https://www.iucnredlist.org/search?query=Porphyrio%20poliocephalus) |
| Reviewer          | _pending_                                                                                                                                      |
| Reviewed at       | _pending_                                                                                                                                      |
| In sensitive YAML | yes                                                                                                                                            |

### Indian peafowl (_Pavo cristatus_)

| Field             | Value                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                  |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                        |
| Lockout months    | —                                                                                                                                     |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                |
| Links             | [GBIF taxon](https://www.gbif.org/species/9451184); [IUCN Red List search](https://www.iucnredlist.org/search?query=Pavo%20cristatus) |
| Reviewer          | _pending_                                                                                                                             |
| Reviewed at       | _pending_                                                                                                                             |
| In sensitive YAML | yes                                                                                                                                   |

### Little egret (_Egretta garzetta_)

| Field             | Value                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                    |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                          |
| Lockout months    | —                                                                                                                                       |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                  |
| Links             | [GBIF taxon](https://www.gbif.org/species/2480876); [IUCN Red List search](https://www.iucnredlist.org/search?query=Egretta%20garzetta) |
| Reviewer          | _pending_                                                                                                                               |
| Reviewed at       | _pending_                                                                                                                               |
| In sensitive YAML | yes                                                                                                                                     |

### Rose-ringed parakeet / طوطا (_Psittacula krameri_)

| Field             | Value                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                      |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                            |
| Lockout months    | —                                                                                                                                         |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                    |
| Links             | [GBIF taxon](https://www.gbif.org/species/2479226); [IUCN Red List search](https://www.iucnredlist.org/search?query=Psittacula%20krameri) |
| Reviewer          | _pending_                                                                                                                                 |
| Reviewed at       | _pending_                                                                                                                                 |
| In sensitive YAML | yes                                                                                                                                       |

### Ruddy shelduck (_Tadorna ferruginea_)

| Field             | Value                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                      |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                            |
| Lockout months    | —                                                                                                                                         |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                    |
| Links             | [GBIF taxon](https://www.gbif.org/species/2498015); [IUCN Red List search](https://www.iucnredlist.org/search?query=Tadorna%20ferruginea) |
| Reviewer          | _pending_                                                                                                                                 |
| Reviewed at       | _pending_                                                                                                                                 |
| In sensitive YAML | yes                                                                                                                                       |

### Western marsh harrier (_Circus aeruginosus_)

| Field             | Value                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Group             | bird                                                                                                                                      |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                            |
| Lockout months    | —                                                                                                                                         |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                                    |
| Links             | [GBIF taxon](https://www.gbif.org/species/2480482); [IUCN Red List search](https://www.iucnredlist.org/search?query=Circus%20aeruginosus) |
| Reviewer          | _pending_                                                                                                                                 |
| Reviewed at       | _pending_                                                                                                                                 |
| In sensitive YAML | yes                                                                                                                                       |

### Wild boar (_Sus scrofa_)

| Field             | Value                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Group             | mammal                                                                                                                            |
| Proposed tier     | `open` — Open (H3 res 7; no record delay; no breeding lockout)                                                                    |
| Lockout months    | —                                                                                                                                 |
| Reason            | Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).                                                            |
| Links             | [GBIF taxon](https://www.gbif.org/species/7705930); [IUCN Red List search](https://www.iucnredlist.org/search?query=Sus%20scrofa) |
| Reviewer          | _pending_                                                                                                                         |
| Reviewed at       | _pending_                                                                                                                         |
| In sensitive YAML | yes                                                                                                                               |

## Sign-off checklist

- [ ] Every species in this region has a confirmed tier
- [ ] Lockout months checked for `highly_protected` (and any `protected` with seasonal risk)
- [ ] No tier was lowered without documented justification
- [ ] `reviewer` + `reviewedAt` written into `data/sensitive-species.yaml` for each row

---

_Generated by `pnpm data:sensitivity-review` (T8.3)._
