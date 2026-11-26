import { NextResponse } from 'next/server';

import { getSiteUrl, tryGetServerApiClient } from '@/lib/api';
import { renderChallengeCardImage } from '@/lib/og/challenge-image';
import { loadChallengeCardModel } from '@/lib/og/load-challenge-card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  readonly params: Promise<{ readonly entryId: string }>;
};

/**
 * W-05 / T7.4 — Square challenge share card (1080×1080).
 * Path: entryId of a published gallery entry. Optional `?slug=` to target a challenge.
 * Shows photo, species, country+region place label — never coordinates.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { entryId: rawEntryId } = await context.params;
  const entryId = rawEntryId.trim();
  if (entryId.length === 0) {
    return NextResponse.json(
      { code: 'INVALID_ENTRY', message: 'entryId is required' },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const slugParam = url.searchParams.get('slug');
  const slugHint = slugParam !== null && slugParam.trim().length > 0 ? slugParam.trim() : null;

  const client = tryGetServerApiClient();
  if (client === null) {
    return NextResponse.json(
      { code: 'API_UNCONFIGURED', message: 'NEXT_PUBLIC_API_URL is not configured' },
      { status: 503 },
    );
  }

  try {
    const model = await loadChallengeCardModel(client, entryId, getSiteUrl(), slugHint);
    if (model === null) {
      return NextResponse.json(
        { code: 'ENTRY_NOT_FOUND', message: 'Published challenge entry not found' },
        { status: 404 },
      );
    }
    return renderChallengeCardImage(model);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to render challenge card';
    return NextResponse.json({ code: 'OG_RENDER_FAILED', message }, { status: 502 });
  }
}
