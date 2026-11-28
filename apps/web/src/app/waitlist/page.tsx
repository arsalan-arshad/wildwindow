import type { Metadata } from 'next';

import { WaitlistForm } from '@/components/waitlist-form';

export const metadata: Metadata = {
  title: 'Waitlist',
  description: 'Join the WildWindow waitlist for the Scotland and Sindh beta.',
};

export default function WaitlistPage() {
  return (
    <main className="bg-paper">
      {/*
        One HTML banner composition only. Do not underlay assets/marketing/waitlist-banner.png —
        that pack graphic ships its own headlines/CTAs and stacks under this copy (WPO-106).
      */}
      <div className="relative isolate overflow-hidden border-b border-forest-800/10 bg-forest-950">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgb(47_107_79/0.5),transparent_50%),radial-gradient(ellipse_at_85%_80%,rgb(196_137_42/0.18),transparent_45%)]"
          aria-hidden
        />
        <div
          className="hero-mist pointer-events-none absolute -inset-[10%] bg-[radial-gradient(circle_at_70%_30%,rgb(243_226_194/0.16),transparent_40%)]"
          aria-hidden
        />
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
