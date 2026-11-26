import { ImageResponse } from 'next/og';

import type { ChallengeCardModel } from '@/lib/og/challenge-model';
import { CHALLENGE_OG_SIZE, OG_CACHE_CONTROL, OG_COLORS } from '@/lib/og/constants';

export function renderChallengeCardImage(model: ChallengeCardModel): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: OG_COLORS.forest950,
        color: OG_COLORS.paper,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og Satori img */}
        <img
          src={model.photoUrl}
          alt=""
          width={1080}
          height={780}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 220,
            display: 'flex',
            background: `linear-gradient(180deg, rgba(11,31,20,0) 0%, ${OG_COLORS.forest950} 88%)`,
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: '36px 48px 44px',
          backgroundColor: OG_COLORS.forest950,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: OG_COLORS.goldSoft,
          }}
        >
          WildWindow · {model.challengeTitle}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.1,
            color: OG_COLORS.paper,
          }}
        >
          {model.speciesName}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 28,
            color: OG_COLORS.mist,
          }}
        >
          <span>{model.placeLabel}</span>
          <span>{model.siteHost}</span>
        </div>
      </div>
    </div>,
    {
      ...CHALLENGE_OG_SIZE,
      headers: {
        'Cache-Control': OG_CACHE_CONTROL,
      },
    },
  );
}
