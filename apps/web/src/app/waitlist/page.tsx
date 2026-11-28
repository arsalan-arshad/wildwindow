import type { Metadata } from 'next';
import Image from 'next/image';

import { WaitlistForm } from '@/components/waitlist-form';

export const metadata: Metadata = {
  title: 'Waitlist',
  description: 'Join the WildWindow waitlist for the Scotland and Sindh beta.',
};

export default function WaitlistPage() {
  return (
    <main className="bg-paper">
      <div className="relative isolate overflow-hidden border-b border-forest-800/10">
        {/* Brand waitlist banner — canonical source: assets/marketing/waitlist-banner.png */}
        <Image
          src="/marketing/waitlist-banner.png"
          alt=""
          fill
          className="object-cover opacity-40"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-forest-950/55" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-16 sm:px-8">
          <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-paper sm:text-5xl">
            Join the WildWindow waitlist
          </h1>
          <p className="mt-4 max-w-xl text-lg text-paper/85">
            Early access for the Scotland and Sindh beta. No spam — product updates only.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-5 py-14 sm:px-8">
        <WaitlistForm source="waitlist" />
      </div>
    </main>
  );
}
