import type { Metadata } from 'next';

import { NoPinPromise } from '@/components/no-pin-promise';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'No-Pin Promise',
  description:
    'WildWindow will never put a pin on a wild animal. How sensitivity tiers, delays, and breeding lockouts protect wildlife.',
};

export default function NoPinPage() {
  return (
    <main className="bg-paper">
      <NoPinPromise />
    </main>
  );
}
