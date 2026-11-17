# WildWindow: Product Requirements (PRD), MVP v1

| | |
|---|---|
| Status | Draft v1.0, 17 Nov 2026 |
| Owner | Arsalan Arshad (solo founder and engineer) |
| Working name | WildWindow (placeholder; check trademark and domain) |
| Beta regions | Scotland (UK) and Sindh (Pakistan) |
| Related docs | [ARCHITECTURE.md](ARCHITECTURE.md), [TASKS.md](TASKS.md), [../AGENTS.md](../AGENTS.md) |

---

## 1. Problem

Wildlife photographers have to stitch together several tools to plan one shoot:

- **Science and ID apps** (iNaturalist, eBird, Merlin) tell you *what* an animal is.
- **Photo planners** (PhotoPills, The Photographer's Ephemeris, Locationscout) tell you *where a good view is* and *when the light is good*, but only for landscapes and fixed spots.
- **Weather, tide and camera-settings advice** live somewhere else again (forecast sites, YouTube).

No product answers the question: **"When and how do I photograph this species near me this week, without harming it?"**

There is also an ethics problem. Exact pins and shared spots draw crowds, baiting and nest disturbance. For example, social posts drew crowds to capercaillie leks in Scotland, and iNaturalist users describe working out the location of hidden rare records from the same user's nearby common records. Experienced photographers stop sharing what they know, so beginners keep asking "where do you find these animals?"

South Asia (Pakistan included) has an active bird-photography scene, but it runs on Facebook groups and YouTube with no dedicated tool.

## 2. Product vision

**WildWindow is a wildlife photo forecast.** Pick a species and an area, and you get:

1. A weekly **Window score (0–100)** with the best days and the best 2-hour block, built from historic sightings (season and time of day), golden hour, weather and, for coastal species, tides.
2. A **"why this score"** breakdown, so the score can be checked and trusted.
3. A **species field card**: starting camera settings, fieldcraft and ethics for that species.
4. The **No-Pin Promise**: the app shows every species at area level only, and sensitive species at a coarse level (or not at all during breeding season). It never shows an exact pin.
5. A monthly **"Same Species, Different Countries"** challenge (for example Kingfisher Month: Glasgow vs Karachi) with shareable cards. This is the growth loop.

**Later:** a Pro subscription ($4.99/month or $39.99/year), and a creator field-guides marketplace that pays creators such as Libby Penman for location-safe species guides.

> The score is a **relative index, not a probability**. Never write "82% chance" anywhere, in the app or in marketing. Write "Window score 82/100".

## 3. Users and personas

| ID | Persona | Context | Needs | Today's workaround |
|---|---|---|---|---|
| P1 | **Hobby wildlife photographer** ("Sana", Karachi; "Euan", Glasgow) | Owns a long lens and shoots at weekends | Which week and hour to go, what the light and weather will be, which settings to use | Reads eBird and iNaturalist by hand, asks in Facebook groups |
| P2 | **Upgrader** (phone to first camera) | New to wildlife, keen to learn | Simple guidance: where in general, when, and how to shoot without disturbing animals | YouTube, Reddit |
| P3 | **Semi-pro / creator** (for example Libby Penman) | Has an audience and sells workshops or guides | Content hooks, a safe way to share what they know, income later | Gumroad, Patreon, Instagram |
| P4 | **Conservation-minded naturalist** | Records sightings and worries about leaks | Proof that the app will not expose sensitive species | Doesn't share, or only uses obscured iNaturalist |
| P5 | **Admin / moderator** (the founder at first) | Runs the app | Curate species cards, approve challenge entries, check data jobs | n/a |

The primary MVP persona is **P1**, with **P2** close behind. **P3** matters for go-to-market but gets no dedicated product surface in the MVP.

## 4. Goals and non-goals

### Goals (MVP)

- G1. Give a useful, explainable Window score for about **40–60 beta species** across Scotland and Sindh.
- G2. Make the No-Pin Promise **technically enforced**, not just a policy: no API or UI path returns locations finer than a species' sensitivity tier allows.
- G3. Run the first monthly challenge (**Kingfisher Month**) with entries from both countries and shareable cards.
- G4. Use only data whose licence allows the use (GBIF CC0 / CC BY first).
- G5. Ship iOS, Android (Expo) and a public web site (Next.js) as a solo founder in about **8–12 weeks**.

### Non-goals (MVP)

- NG1. Our own AI species-ID model, or any ML training on iNaturalist data.
- NG2. A public map of exact user sightings, or any "pin drop" sharing.
- NG3. Social features: feed, likes, followers, DMs, comments.
- NG4. Gamified "collect them all" and leaderboards (Atlas Quest and Veld own that space).
- NG5. Global coverage. MVP covers two regions only.
- NG6. Payments and the creator marketplace (designed for later, not built in the MVP).
- NG7. Children's accounts and features. Users must be 13 or older.

## 5. MVP scope (MoSCoW)

### Must have

| ID | Feature |
|---|---|
| M1 | Region and species catalogue for Scotland and Sindh, with common and scientific names (English first; Urdu names where available) |
| M2 | Area selection: search a town or place, or "use my location", which is snapped to an area cell straight away. The exact location is never stored or sent to third parties. |
| M3 | Weekly Window score per species and area, with 7 daily scores, best day, best 2-hour block and a confidence label (High / Medium / Low) |
| M4 | "Why this score" breakdown: seasonality, time of day, light, weather, tide |
| M5 | 52-week seasonality chart per species and region |
| M6 | Golden hour and blue hour times for the area (computed on the device) |
| M7 | Species field card: starting camera settings, fieldcraft, ethics and the legal notes for the region |
| M8 | No-Pin Promise enforcement (sensitivity tiers, coarse cells, minimum-count suppression, breeding-season lockout, reporting delays), with an in-app explanation page |
| M9 | Accounts (Apple, Google, email link). Browsing works without an account. |
| M10 | Watchlist: save species and area pairs (up to 3 per user in the MVP, which matches the planned free tier) |
| M11 | Personal logbook: add a photo with species, EXIF date and camera settings. The photo's GPS is stripped and the location is private by default. |
| M12 | Monthly challenge: browse the current challenge, submit an entry from the logbook, see the gallery grouped by country, share a card |
| M13 | Data attribution page (GBIF download DOIs, dataset licences, weather and tide credits) |
| M14 | Admin: edit species cards and sensitivity tiers, moderate challenge entries, see ingestion run status |
| M15 | Account deletion and data export (App Store and UK GDPR requirement) |

### Should have

| ID | Feature |
|---|---|
| S1 | Tide factor for coastal species where a tide provider is set up (Scotland first) |
| S2 | Shareable "This week's Window" forecast card (image) for Instagram Stories and WhatsApp |
| S3 | Public web species pages (SEO) showing seasonality and the field card, with no maps for sensitive species |
| S4 | Urdu UI strings for the Sindh beta (i18n set up from day one; translations can follow) |
| S5 | Offline cache of the last forecast and species cards on the device |
| S6 | Backtest report that checks the score against a held-out year of data |

### Won't have (MVP), planned later

| ID | Feature | When |
|---|---|---|
| W1 | Pro subscription: unlimited watchlist, alerts, offline region packs, trip planner. $4.99/month or $39.99/year, through RevenueCat (mobile) and Stripe (web) | Post-MVP phase P1 |
| W2 | Push alerts ("Kingfisher window above 80 this Saturday") | Post-MVP (Pro) |
| W3 | Creator field-guides marketplace with a 20–30% platform commission | Post-MVP phase P2 |
| W4 | eBird data | Only after written permission from Cornell Lab |
| W5 | AI species-ID helper (for example the BioCLIP 2 open model, run on our server) | Maybe; never the core product |
| W6 | More regions | One new region a month after launch |

## 6. User stories and acceptance criteria

The screen IDs (S-xx) refer to section 7.

### Epic A: Discover and forecast

**US-01: Choose a region and species.** As P1, I want to browse or search species in my region so that I can plan for one.
- AC1: Search matches common names (English, plus Urdu where present) and scientific names, and ignores case and accents.
- AC2: Each result shows its sensitivity badge (Open / Protected / Highly protected / No forecast).
- AC3: Species with tier `no_forecast` appear with an explanation and no score.

**US-02: Choose an area.** As P1, I want to choose my area by searching or by my location so that the forecast is local.
- AC1: "Use my location" asks for foreground location permission only, snaps to an H3 res-7 cell on the device, and sends only the cell ID to the API.
- AC2: Place search returns places within the beta regions. Outside them it shows "Not covered yet".
- AC3: The app never stores or logs the raw latitude and longitude, on the server or in analytics.

**US-03: See this week's Window.** As P1, I want a weekly score for a species in my area so that I know whether and when to go.
- AC1: The response shows a weekly score (0–100), 7 daily scores, the best day, the best 2-hour block (local time) and a confidence label.
- AC2: The score is shown at the cell resolution allowed for the species' tier. For tier `protected` the area label is coarse (for example "Lower Clyde area").
- AC3: When a `highly_protected` species is inside its breeding lockout, the app shows "Resting season: no forecast" with the reason instead of a score.
- AC4: When confidence is Low, the score is shown as a range (for example "40–65") with "Limited data in this area".
- AC5: A forecast loads in under 1.5 s (p95) from a warm cache.

**US-04: Understand the score.** As P1/P4, I want to see why the score is what it is so that I can trust it.
- AC1: The breakdown shows each factor (Seasonality, Time of day, Light, Weather, Tide) with its value and a one-line reason.
- AC2: A factor that doesn't apply (for example Tide for an inland species) shows "Not used".
- AC3: The breakdown names the scoring version (for example `v1.0`).

**US-05: See seasonality.** As P2, I want a 52-week chart of when a species is reported in my region so that I can plan months ahead.
- AC1: The chart is effort-normalised (the relative reporting rate, not raw counts) and labelled that way.
- AC2: The chart is shown at region level only, for every tier.

**US-06: See light times.** As P1, I want golden and blue hour times for my area and day so that I can plan the light.
- AC1: Times are computed on the device for the cell centre and shown in the region's local time zone.
- AC2: The times match a reference implementation within ±1 minute in tests.

### Epic B: Learn how to shoot

**US-07: Read the species field card.** As P2, I want starting camera settings and fieldcraft for a species so that I get a usable shot.
- AC1: The card shows suggested shutter speed, aperture, ISO approach, focus mode and drive mode, for a typical scene (perched, in flight, low light).
- AC2: The card has an Ethics section (distance, no baiting, no playback, nest rules) and the region's legal notes (for example: in Scotland, disturbing a Schedule 1 bird at its nest needs a licence from NatureScot).
- AC3: Cards show "Reviewed by [name], [date]". The app does not publish a card until an admin marks it reviewed.

### Epic C: Protect wildlife (No-Pin Promise)

**US-08: Trust the app with sensitive species.** As P4, I want proof that sensitive locations can't leak so that I am happy to use and recommend it.
- AC1: The No-Pin Promise screen explains the tiers, resolutions, delays and lockouts in plain words.
- AC2: No public endpoint returns raw occurrence records or coordinates. This is enforced by automated tests and by database permissions.
- AC3: Asking for the same species and area many times, or from nearby cells, never gives more precise information than the tier allows. Cells snap deterministically (no random jitter that averages out).
- AC4: Cells below the minimum record or observer count are suppressed or merged into their parent cell.

### Epic D: Account, watchlist, logbook

**US-09: Sign in.** As a user, I want to sign in with Apple, Google or an email link so that my data syncs.
- AC1: Browsing species and forecasts works without an account.
- AC2: Watchlist, logbook and challenge entries need an account.

**US-10: Watchlist.** As P1, I want to save species and area pairs so that Home shows my forecasts.
- AC1: A user can save up to 3 pairs in the MVP. Trying to add a 4th shows a friendly limit message (no paywall in the MVP).
- AC2: Home lists the saved pairs with this week's score and best day.

**US-11: Logbook.** As P1, I want to log my photos with species and settings so that I keep a private record.
- AC1: The app reads EXIF date, camera, lens, focal length, shutter, aperture and ISO on the device.
- AC2: GPS EXIF is removed before upload. The uploaded file has no location metadata, and a test checks this.
- AC3: Entries are private by default. Only the owner can see an entry's location, which is stored encrypted and at cell level unless the user opts to keep the exact point for themselves.
- AC4: The user can edit and delete entries. Deleting an entry deletes the photo from storage.

**US-12: Delete and export my data.** As a user, I want to export or delete my account.
- AC1: Export gives a JSON file and photo links within 24 hours (in the MVP it can be generated on request).
- AC2: Deletion removes the account, logbook, photos, watchlist and challenge entries within 30 days, and signs the user out.

### Epic E: Same Species, Different Countries challenge

**US-13: Join the monthly challenge.** As P1, I want to enter my photo of this month's species so that I take part in a global challenge.
- AC1: The challenge screen shows the species, dates, rules, ethics pledge and entry count per country.
- AC2: A user submits an entry from a logbook entry of the right species. They must tick the ethics pledge (no baiting, no playback, no nest disturbance).
- AC3: An entry shows only its country and region name (for example "Sindh, Pakistan"). It never shows coordinates or a finer area.
- AC4: Entries go public after admin approval, and no sooner than 7 days after they are submitted.
- AC5: Only `open` tier species can be challenge species.

**US-14: Share a card.** As P1/P3, I want a shareable image of my entry or forecast so that I can post it on Instagram or WhatsApp.
- AC1: The card (1080×1920 Story and 1080×1080 square) shows the photo, species, country, the WildWindow mark and a link.
- AC2: Cards never contain coordinates or a map of a sensitive species.

### Epic F: Admin

**US-15: Curate content.** As P5, I want to edit species cards, tiers and lockout months so that the content stays correct.
- AC1: Every change to a tier or lockout is audit-logged with the admin, the time and the old and new values.
- AC2: Raising a tier takes effect in public outputs within one aggregation run, or straight away for forecast cache invalidation.

**US-16: Moderate entries.** As P5, I want an approval queue for challenge entries.
- AC1: Approve or reject with a reason, and the user is told the outcome.

**US-17: Monitor data.** As P5, I want to see ingestion runs (source, DOI, record counts, rejected-by-licence count, status).

## 7. Screens

### Mobile (Expo)

| ID | Screen | Stories |
|---|---|---|
| S-01 | Onboarding (3 cards: what it does, No-Pin Promise, pick your region) | US-01, US-08 |
| S-02 | Sign in (Apple / Google / email link) | US-09 |
| S-03 | Home: "This week" (watchlist forecasts, current challenge banner) | US-10, US-13 |
| S-04 | Species search and browse (by region, with group filters: birds, mammals, marine) | US-01 |
| S-05 | Species detail (seasonality chart, field card summary, sensitivity badge) | US-05, US-07 |
| S-06 | Area picker (search, "use my location", a coarse cell map) | US-02 |
| S-07 | Forecast detail (weekly score, 7-day strip, best block, light times, weather, tide, breakdown) | US-03, US-04, US-06 |
| S-08 | Field card (settings, fieldcraft, ethics, legal notes) | US-07 |
| S-09 | No-Pin Promise explainer | US-08 |
| S-10 | Logbook list | US-11 |
| S-11 | Add or edit log entry | US-11 |
| S-12 | Log entry detail | US-11 |
| S-13 | Challenge home (rules, countries, gallery) | US-13 |
| S-14 | Submit challenge entry | US-13 |
| S-15 | Share card preview | US-14 |
| S-16 | Profile and settings (region, units, language, privacy, export, delete account) | US-12 |
| S-17 | About data and attributions | M13 |

### Web (Next.js)

| ID | Page |
|---|---|
| W-01 | Landing page and waitlist |
| W-02 | No-Pin Promise (public pledge page) |
| W-03 | Species pages `/[region]/[species]` (seasonality and field card; SEO) |
| W-04 | Challenge gallery `/challenges/[slug]` |
| W-05 | Share card image routes (`/api/og/...`) |
| W-06 | Privacy policy, terms, attributions |
| W-07 | Admin: species cards editor, tier and lockout editor, moderation queue, ingestion runs (sign-in required, admin role only) |

## 8. Success metrics

These targets are proposals for the private beta (50–100 testers across both regions). Review them after 4 weeks.

| Area | Metric | Beta target |
|---|---|---|
| Activation | % of new users who see a forecast (species + area) in their first session | ≥ 60% |
| Engagement | % of weekly active users who open at least one forecast detail | ≥ 50% |
| Retention | Week-4 retention of beta users | ≥ 25% |
| Usefulness | "The forecast helped me plan a shoot" (in-app survey, agree or strongly agree) | ≥ 40% |
| Score quality | Backtest: top-quartile Window weeks have ≥ 2× the reporting rate of bottom-quartile weeks in a held-out year | Pass for ≥ 70% of beta species with High confidence |
| Growth loop | Kingfisher Month approved entries | ≥ 40 total, from both countries |
| Sharing | Share cards created per 100 weekly active users | ≥ 10 |
| Trust | Location-leak incidents (any public output finer than the tier allows) | **0**; any leak is a P0 incident |
| Reliability | Crash-free sessions | ≥ 99.5% |
| Performance | Forecast API p95 (warm cache) | < 400 ms on the server, < 1.5 s end to end |

## 9. Ethics, privacy and legal requirements

### 9.1 The No-Pin Promise (public text, draft)

> **WildWindow will never put a pin on a wild animal.**
> We show where species are likely at the level of an area, never an exact spot. For sensitive species we use much larger areas, delay recent records, and switch off forecasts completely in breeding season. We never publish the location of your photos. Our location-protection code is open source, so anyone can check it.

### 9.2 Sensitivity tiers (must)

These values must match `ARCHITECTURE.md §5` and `data/sensitive-species.yaml`.

| Tier | Example (beta) | Public resolution | Record delay | Minimum to publish a cell | Breeding lockout |
|---|---|---|---|---|---|
| `open` | Common kingfisher, red squirrel, grey seal, rose-ringed parakeet | H3 res 7 (~5 km² cells) | none | ≥ 5 records and ≥ 3 observers | no |
| `protected` | Eurasian otter, mountain hare, smooth-coated otter, Indus river dolphin | H3 res 5 (~250 km² cells) | 30 days | ≥ 10 records and ≥ 5 observers | optional, set per species |
| `highly_protected` | Osprey, white-tailed eagle, nesting green turtle | H3 res 4 (~1,770 km²), shown only as a named area label (for example "Highland area"); no map cells | 365 days | ≥ 20 records and ≥ 8 observers | **yes** |
| `no_forecast` | Capercaillie | Not shown on any map and never forecast | n/a | n/a | always |

Rules:
- E1. The tier is set per species and per region. If in doubt, choose the higher tier. Only an admin can lower a tier, and the change is audit-logged.
- E2. No public endpoint returns raw records or coordinates. The forecast is computed on the server, and the response holds only cell IDs at the tier's resolution or coarser.
- E3. Cells snap deterministically. No random jitter, because repeated queries average it out.
- E4. A cell that fails the minimum is merged into its parent until it passes. If it never passes, it is suppressed.
- E5. User content (logbook, challenge) never publishes a location finer than country and region.
- E6. A named conservation reviewer signs off the tier list for each region before public launch.
- E7. The field ethics on every species card follows the Audubon guide to ethical bird photography: no baiting, no playback for photos, keep your distance, leave nests alone.
- E8. Legal notes per region. Scotland: Schedule 1 birds (Wildlife and Countryside Act 1981, as amended in Scotland) need a NatureScot licence for photography at or near the nest. Sindh: point users to the provincial wildlife law and the protected-area permit rules. Get the exact wording checked before launch.

### 9.3 Privacy (must)

- PR1. Data minimisation: the user's location is snapped to a res-7 cell on the device. Raw coordinates are never sent, logged or put in analytics.
- PR2. Weather and tide providers are called with **cell centre** coordinates, never the user's position.
- PR3. Photo GPS EXIF is removed before upload, and the server checks again.
- PR4. Logbook locations are encrypted at rest and visible only to the owner.
- PR5. No advertising SDKs. Product analytics are first-party or privacy-focused (PostHog), with no location properties.
- PR6. Account deletion and data export are in the app (Apple App Store rule; UK GDPR).
- PR7. Users must be 13 or older. Nothing in the MVP is aimed at children.
- PR8. Billing honesty (for later Pro): no weekly plans, no hidden trials, cancelling is easy and linked from settings.

### 9.4 Data licensing (must)

| Source | MVP use | Rule |
|---|---|---|
| GBIF occurrences | **Primary source** | Use only records licensed **CC0 1.0** or **CC BY 4.0**. Drop CC BY-NC. Keep the licence and dataset on every row, and cite the GBIF download DOI on the attribution page. |
| iNaturalist | Through GBIF (research-grade observations) | If the direct API is used: about 1 request/s and 10,000 requests/day at most. **Never** use its data or images to train AI models. |
| eBird | **Off** (feature flag `EBIRD_ENABLED=false`) | The API is non-commercial only. Get written permission from Cornell Lab (ebird@cornell.edu) before any use. |
| Open-Meteo | Development and testing only, unless a commercial plan is bought | The free tier is non-commercial. The default production provider must allow commercial use (see ARCHITECTURE §3.4). |
| Tides | Coastal species, where a provider is set up | Check each provider's licence and pricing before use. |

## 10. Assumptions and open questions

- Q1. Is there enough CC0/CC BY data for Sindh species? Expect Low confidence for many of them, and mark it clearly. Pakistani beta testers' logbooks don't feed public data in the MVP.
- Q2. Which tide provider covers Karachi under a licence we can use? Until one is found, tide is "Not used" for Sindh.
- Q3. Who are the conservation reviewers? One for Scotland and one for Sindh, before public launch.
- Q4. Final name and domain (WildWindow is a placeholder).
- Q5. Urdu translation: in-house or a community volunteer?
