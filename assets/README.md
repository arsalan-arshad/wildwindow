# WildWindow — Official Brand Assets & Design System

Official vector and raster brand identity assets for **WildWindow** — the wildlife photo forecast app. Built for fieldcraft, conservation trust, and high outdoor legibility with strict adherence to the **No-Pin Promise**.

- **Beta Regions:** Scotland (UK) &amp; Sindh (Pakistan)
- **Live Deployment:** [wildwindow.arsalandev.studio](https://wildwindow.arsalandev.studio)
- **Tone:** Fieldcraft + conservation trust. Light-forward, outdoor legible, honest index scoring (never "% chance").

---

## 1. Asset Catalog & Specifications

### Vector Marks (`brand/`)

| File                        | Format          | Description                                                                            |
| :-------------------------- | :-------------- | :------------------------------------------------------------------------------------- |
| `brand/mark.svg`            | SVG             | Official WildWindow aperture &amp; kingfisher mark on cream-mist canvas (`#F4F7F5`).   |
| `brand/mark-on-dark.svg`    | SVG             | Vector mark calibrated for dark/night mode surfaces (`#122026`).                       |
| `brand/logo-horizontal.svg` | SVG             | Primary horizontal wordmark with display serif, spaced metadata, and No-Pin badge.     |
| `brand/style-tile.png`      | PNG (1920×1200) | Visual identity specification: color tokens, typography hierarchy, and Do/Don't rules. |

### App Icons & Favicons (`icons/` &amp; `favicon/`)

| File                           | Dimensions  | Purpose                                                                |
| :----------------------------- | :---------- | :--------------------------------------------------------------------- |
| `icons/icon-1024.png`          | 1024×1024   | Master App Store &amp; Google Play icon (solid cream-mist background). |
| `icons/icon-512.png`           | 512×512     | PWA / web standard application icon.                                   |
| `icons/icon-192.png`           | 192×192     | Mobile PWA home screen icon.                                           |
| `icons/adaptive-icon.png`      | 1024×1024   | Android adaptive icon foreground layer (within safe zone).             |
| `icons/splash-icon.png`        | 1024×1024   | Mobile launch splash icon centered mark.                               |
| `favicon/favicon.ico`          | 32×32 (ICO) | Root multi-standard browser favicon.                                   |
| `favicon/favicon-32.png`       | 32×32       | Web favicon PNG.                                                       |
| `favicon/apple-touch-icon.png` | 180×180     | iOS Safari home screen bookmark touch icon.                            |

### Splash & Launch Screens (`splash/`)

| File                      | Dimensions | Purpose                                                                     |
| :------------------------ | :--------- | :-------------------------------------------------------------------------- |
| `splash/splash-light.png` | 1284×2778  | Light-forward, high-contrast outdoor splash screen (iPhone 6.7" / Android). |

### App Store Mobile Screenshots (`screenshots/`)

High-resolution 1290×2796 (iPhone 6.7" portrait display / Google Play tablet compatible):

1. `screenshots/01-window-score.png` — **Window Score &amp; Best 2-Hour Block** (Score 84/100, dawn golden hour, river pool slack, explainable factor model).
2. `screenshots/02-species-browse.png` — **Species Browse &amp; Seasonality** (54 beta species across Scotland &amp; Sindh with 12-month phenology curves).
3. `screenshots/03-area-picker.png` — **Coarse Area Cells &amp; No-Pin Promise** (H3 Res-7 12 km² hexagonal cells; zero GPS coordinate leakage).
4. `screenshots/04-field-card.png` — **Fieldcraft &amp; Camera Presets** (500mm f/5.6 1/2000s, perch approach distance, Schedule 1 legal protections).
5. `screenshots/05-no-pin-promise.png` — **Ethical Geoprivacy Explainer** (Comparison between destructive pin drops and WildWindow timing intelligence).
6. `screenshots/06-challenge-share.png` — **Same Species, Different Countries Challenge** (Kingfisher Month: Glasgow vs Thatta twin share cards).

### Marketing &amp; Open Graph Banners (`banners/`, `og/`, `marketing/`)

| File                                  | Dimensions | Platform / Use                                        |
| :------------------------------------ | :--------- | :---------------------------------------------------- |
| `og/og-1200x630.png`                  | 1200×630   | Primary Next.js Open Graph social sharing image.      |
| `og/default-og.png`                   | 1200×630   | Default web social fallback card.                     |
| `og/challenge-og-template.png`        | 1200×630   | Twin-region monthly challenge dynamic OG share card.  |
| `banners/twitter-header-1500x500.png` | 1500×500   | Twitter / X profile header banner.                    |
| `social/twitter-card.png`             | 1200×675   | Twitter / X feed card post graphic.                   |
| `social/linkedin-share.png`           | 1200×627   | LinkedIn &amp; Facebook feed share banner.            |
| `banners/play-feature-graphic.png`    | 1024×500   | Google Play Store listing promotional banner.         |
| `banners/app-store-banner.png`        | 1200×630   | Apple App Store editorial banner.                     |
| `marketing/waitlist-banner.png`       | 1200×630   | Designed waitlist share/mock (includes painted copy). |
| `marketing/hero-placeholder.png`      | 1920×1080  | Designed landing share/mock (includes painted copy).  |

> **Live web pages:** do **not** underlay these marketing composites behind HTML heroes — the painted headlines/CTAs stack with live copy (WPO-106). Keep them for social/docs; live `/` and `/waitlist` use the HTML composition + brand mark atmosphere.

### Social Media Post Templates (`social/`)

| File                                | Dimensions | Format                                                  |
| :---------------------------------- | :--------- | :------------------------------------------------------ |
| `social/social-post-1080x1080.png`  | 1080×1080  | Square post ("This Week's Window: Common Kingfisher").  |
| `social/social-story-1080x1920.png` | 1080×1920  | Vertical story ("Kingfisher Month: Glasgow vs Thatta"). |

---

## 2. Design System Tokens

```css
:root {
  /* Surfaces & Canvases (Light-first for outdoor field readability) */
  --color-surface-canvas: #f4f7f5; /* Off-White */
  --color-surface-card: #ffffff; /* Pure White */
  --color-surface-mist: #e8eef0; /* Soft Mist */

  /* Brand Hero & Accents */
  --color-brand-water: #2f6f7e; /* Deep Teal */
  --color-brand-reed: #6b8f71; /* Sage Green */
  --color-brand-copper: #d97b3a; /* Copper Kingfisher */
  --color-brand-azure: #25b9cc; /* Plumage Azure Cyan */
  --color-brand-sky: #c8d8e4; /* Calm Sky Grey */

  /* Typography */
  --color-text-primary: #1c2a2f; /* Deep Ink (WCAG AA > 7:1) */
  --color-text-secondary: #4e6b74; /* Slate Teal */
  --color-text-muted: #7898a1; /* Muted Caption */
}
```

---

## 3. App wiring (thin copies)

Canonical files stay under `assets/`. Runtime hosts that require local paths get thin copies only:

| Consumer           | Path                                                                                                  | Source                                                                             |
| :----------------- | :---------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| Next.js App Router | `apps/web/src/app/favicon.ico`, `apps/web/src/app/icon.png`                                           | `assets/favicon` (do **not** also put `favicon.ico` in `public/` — Next conflicts) |
| Next.js public     | `apps/web/public/favicon-32.png`, `icon-*.png`, `apple-touch-icon.png`, `og/`, `brand/`, `marketing/` | `assets/favicon`, `icons`, `og`, `brand`, `marketing`                              |
| Expo               | `apps/mobile/assets/images/icon.png`, `splash-icon.png`, `android-icon-*.png`, `favicon.png`          | `assets/icons`, `favicon` (+ cream `#F4F7F5` adaptive background)                  |

Re-copy from `assets/` when the brand pack updates. Do not invent new art in app folders.

## 4. Brand Principles

1. **Light-Forward First:** Wildlife photographers check forecasts outdoors in bright daylight. Avoid dark-mode-first canvases.
2. **Honest Index Scoring:** The score is a relative index from `0–100`. Never write "82% chance" or guarantee sightings.
3. **The No-Pin Promise:** Enforce geoprivacy at every level. Never store or expose exact GPS pins or nesting coordinates.
4. **Conservation Trust:** Prioritize animal welfare over viral social pins.

### Still needed (optional follow-ups)

- Android adaptive **monochrome** layer (Expo still ships a scaffold PNG).
- Licensed photography to replace marketing hero / waitlist banner composites when ready.
