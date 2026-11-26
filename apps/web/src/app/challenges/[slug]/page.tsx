import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ChallengePageView } from '@/components/challenge-page';
import { tryGetServerApiClient } from '@/lib/api';
import { formatChallengeDateRange, totalCountryCount } from '@/lib/challenge';

/** ISR: refresh challenge summary and counts periodically (ARCHITECTURE W-04). */
export const revalidate = 3600;

/** Allow on-demand generation when new challenges land after build. */
export const dynamicParams = true;

type RouteParams = {
  readonly slug: string;
};

type PageProps = {
  readonly params: Promise<RouteParams>;
};

export async function generateStaticParams(): Promise<RouteParams[]> {
  const client = tryGetServerApiClient();
  if (client === null) {
    return [];
  }
  try {
    const current = await client.challenges.current();
    return [{ slug: current.slug }];
  } catch {
    // No live challenge (or API down) at build time — ISR fills in on demand.
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const client = tryGetServerApiClient();
  if (client === null) {
    return { title: 'Challenge' };
  }

  try {
    const challenge = await client.challenges.get(slug);
    const total = totalCountryCount(challenge.countryCounts);
    const dates = formatChallengeDateRange(challenge.startsOn, challenge.endsOn);
    return {
      title: challenge.title,
      description: `${challenge.title} — ${dates}. ${String(total)} published ${total === 1 ? 'entry' : 'entries'} across countries. Country and region only; no pins.`,
      openGraph: {
        title: challenge.title,
        description: `Same species, different countries. ${dates}. No exact locations.`,
        type: 'website',
      },
    };
  } catch {
    return { title: 'Challenge' };
  }
}

export default async function ChallengePage({ params }: PageProps) {
  const { slug } = await params;
  const client = tryGetServerApiClient();
  if (client === null) {
    notFound();
  }

  let challenge;
  try {
    challenge = await client.challenges.get(slug);
  } catch {
    notFound();
  }

  return <ChallengePageView challenge={challenge} />;
}
