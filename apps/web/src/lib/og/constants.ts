/** Share card sizes (PRD US-14 / T7.4 W-05). */
export const FORECAST_OG_SIZE = { width: 1080, height: 1920 } as const;
export const CHALLENGE_OG_SIZE = { width: 1080, height: 1080 } as const;

/** Edge / CDN cache for generated PNGs (ARCHITECTURE §2.1). */
export const OG_CACHE_CONTROL =
  'public, s-maxage=3600, stale-while-revalidate=86400, immutable' as const;

export const OG_CONTENT_TYPE = 'image/png' as const;

/** Brand colours mirrored from globals.css (Satori has no CSS variables). */
export const OG_COLORS = {
  forest950: '#0b1f14',
  forest800: '#163528',
  forest600: '#2f6b4f',
  mist: '#e8f0ea',
  paper: '#f7faf7',
  ink: '#14201a',
  inkMuted: '#4a5c52',
  gold: '#c4892a',
  goldSoft: '#f3e2c2',
} as const;
