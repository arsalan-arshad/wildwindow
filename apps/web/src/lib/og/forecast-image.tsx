import { ImageResponse } from 'next/og';

import { FORECAST_OG_SIZE, OG_CACHE_CONTROL, OG_COLORS } from '@/lib/og/constants';
import type { ForecastCardModel } from '@/lib/og/forecast-model';

export function renderForecastCardImage(model: ForecastCardModel): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 64px',
        background: `linear-gradient(165deg, ${OG_COLORS.forest950} 0%, ${OG_COLORS.forest800} 48%, #1f4a36 100%)`,
        color: OG_COLORS.paper,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: OG_COLORS.goldSoft,
          }}
        >
          WildWindow
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: OG_COLORS.mist,
            opacity: 0.85,
          }}
        >
          This week&apos;s Window
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            color: OG_COLORS.paper,
          }}
        >
          {model.commonName}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            fontStyle: 'italic',
            color: OG_COLORS.mist,
            opacity: 0.9,
          }}
        >
          {model.scientificName}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            color: OG_COLORS.goldSoft,
            marginTop: 8,
          }}
        >
          {model.areaLabel}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '36px 40px',
          borderRadius: 28,
          backgroundColor: 'rgba(247, 250, 247, 0.1)',
          border: `1px solid rgba(243, 226, 194, 0.28)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: OG_COLORS.goldSoft,
          }}
        >
          {model.scoreLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 140,
              fontWeight: 700,
              lineHeight: 0.9,
              color: OG_COLORS.paper,
            }}
          >
            {model.weekScore}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              paddingBottom: 16,
            }}
          >
            <div style={{ display: 'flex', fontSize: 36, color: OG_COLORS.mist }}>/100</div>
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                fontWeight: 600,
                color: OG_COLORS.forest950,
                backgroundColor: OG_COLORS.goldSoft,
                borderRadius: 10,
                padding: '6px 14px',
              }}
            >
              {model.confidence}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28 }}>
          <span style={{ color: OG_COLORS.mist }}>Best day</span>
          <span style={{ color: OG_COLORS.paper, fontWeight: 600 }}>{model.bestDayLabel}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28 }}>
          <span style={{ color: OG_COLORS.mist }}>Best 2-hour block</span>
          <span style={{ color: OG_COLORS.paper, fontWeight: 600 }}>{model.bestBlockLabel}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 24,
          color: OG_COLORS.mist,
          opacity: 0.9,
        }}
      >
        <span>No exact pins. Ever.</span>
        <span>{model.siteHost}</span>
      </div>
    </div>,
    {
      ...FORECAST_OG_SIZE,
      headers: {
        'Cache-Control': OG_CACHE_CONTROL,
      },
    },
  );
}
