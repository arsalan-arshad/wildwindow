import Image from 'next/image';
import Link from 'next/link';

import { SampleForecast } from '@/components/sample-forecast';

const GEOPRIVACY_URL = 'https://github.com/arsalan-arshad/wildwindow/tree/main/packages/geoprivacy';

export function Landing() {
  return (
    <main>
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        {/* Placeholder imagery until licensed photography ships — see assets/marketing/. */}
        <Image
          src="/marketing/hero-placeholder.png"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[var(--color-hero-veil)]" aria-hidden />
        <div
          className="hero-mist pointer-events-none absolute -inset-[12%] bg-[radial-gradient(circle_at_30%_20%,rgb(243_226_194/0.28),transparent_45%),radial-gradient(circle_at_80%_60%,rgb(47_107_79/0.35),transparent_50%)]"
          aria-hidden
        />

        <div className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-6xl flex-col justify-end gap-10 px-5 pb-16 pt-10 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:pb-20">
          <div className="max-w-xl text-paper">
            <p className="font-[family-name:var(--font-fraunces)] text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              WildWindow
            </p>
            <h1 className="mt-5 max-w-lg font-[family-name:var(--font-fraunces)] text-2xl leading-snug sm:text-3xl">
              When to photograph wildlife this week — without pinning it.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-paper/85 sm:text-lg">
              Pick a species and an area. Get a weekly Window score, the best days, and a starting
              field card. Beta: Scotland and Sindh.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/waitlist"
                className="rounded-md bg-gold px-5 py-3 text-base font-semibold text-forest-950 transition hover:brightness-105"
              >
                Join the waitlist
              </Link>
              <Link
                href="/no-pin"
                className="text-sm font-medium text-paper/90 underline-offset-4 hover:underline"
              >
                Read the No-Pin Promise
              </Link>
            </div>
          </div>
          <SampleForecast />
        </div>
      </section>

      <section className="bg-paper px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest-800 sm:text-4xl">
            Planning a wildlife shoot still means stitching five apps together.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            ID apps tell you what you saw. Photo planners help with landscapes. Weather and tides
            live somewhere else. Nothing answers: when and how do I photograph this species near me
            this week, without harming it?
          </p>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            Exact pins and shared spots draw crowds and disturbance. WildWindow is built so the
            product never needs an exact pin.
          </p>
        </div>
      </section>

      <section className="border-y border-forest-800/10 bg-mist px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest-800 sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-10 space-y-8">
            <li className="reveal-step border-l-2 border-gold pl-5">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-forest-600">1</p>
              <h3 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl text-ink">
                Choose species + area
              </h3>
              <p className="mt-2 text-ink-muted">
                Search a place or use your location; we snap to an area cell on device and drop the
                exact point.
              </p>
            </li>
            <li className="reveal-step border-l-2 border-gold pl-5">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-forest-600">2</p>
              <h3 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl text-ink">
                Read this week&apos;s Window
              </h3>
              <p className="mt-2 text-ink-muted">
                A score from 0–100 for the week, best day, best 2-hour block, and a plain-language
                “why” (season, time of day, light, weather, tides where used).
              </p>
            </li>
            <li className="reveal-step border-l-2 border-gold pl-5">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-forest-600">3</p>
              <h3 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl text-ink">
                Take the field card
              </h3>
              <p className="mt-2 text-ink-muted">
                Starting settings, fieldcraft, and ethics for that species and region.
              </p>
            </li>
          </ol>
          <p className="mt-8 text-sm text-ink-muted">
            The Window score is an index for comparing days — not a probability of seeing the
            animal.
          </p>
        </div>
      </section>

      <section id="no-pin" className="scroll-mt-24 bg-paper px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest-800 sm:text-4xl">
            The No-Pin Promise
          </h2>
          <blockquote className="mt-6 border-l-2 border-forest-600 pl-5 text-lg leading-relaxed text-ink">
            WildWindow will never put a pin on a wild animal. We show where species are likely at
            the level of an area, never an exact spot. For sensitive species we use much larger
            areas, delay recent records, and switch off forecasts completely in breeding season. We
            never publish the location of your photos. Our location-protection code is open source,
            so anyone can check it.
          </blockquote>
          <p className="mt-5 text-ink-muted">
            Sensitive species stay coarse or off during breeding. Read the full{' '}
            <Link
              href="/no-pin"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              No-Pin Promise
            </Link>
            , the draft{' '}
            <Link
              href="/privacy"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              privacy policy
            </Link>
            , and inspect{' '}
            <a
              href={GEOPRIVACY_URL}
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
              rel="noopener noreferrer"
            >
              packages/geoprivacy on GitHub
            </a>
            . An npm publish is coming soon.
          </p>
        </div>
      </section>

      <section className="bg-forest-800 px-5 py-20 text-paper sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-fraunces)] text-3xl sm:text-4xl">
            Same species. Different countries.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-paper/85">
            A monthly challenge — for example Kingfisher Month across Scotland and Sindh — with
            shareable cards. Entries show country and region only, never coordinates.
          </p>
          <Link
            href="/waitlist"
            className="mt-8 inline-flex rounded-md bg-gold px-5 py-3 font-semibold text-forest-950 transition hover:brightness-105"
          >
            Join the waitlist to hear when the first challenge opens
          </Link>
        </div>
      </section>

      <section className="bg-mist px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest-800 sm:text-4xl">
            Built with field guides and workshops in mind.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            Semi-pro creators need a safe way to share what they know. After the MVP, WildWindow
            plans a creator field-guides marketplace (location-safe guides). Nothing to sell here
            yet — this is for creators who run workshops and guides.
          </p>
        </div>
      </section>

      <section className="bg-paper px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest-800 sm:text-4xl">
            FAQ
          </h2>
          <dl className="mt-10 space-y-8">
            <div>
              <dt className="font-semibold text-ink">
                Is the Window score a chance of seeing the animal?
              </dt>
              <dd className="mt-2 text-ink-muted">
                No. It is a relative index (0–100) for comparing days and hours — never a “%
                chance”.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Will you show exact locations?</dt>
              <dd className="mt-2 text-ink-muted">
                No. That is the No-Pin Promise. Sensitive species are coarser still, or not forecast
                at all.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Where does the data come from?</dt>
              <dd className="mt-2 text-ink-muted">
                Historic occurrence records under licences we can use (GBIF CC0 / CC BY first), plus
                light, weather, and tides where licensed. See the{' '}
                <Link
                  href="/attributions"
                  className="text-forest-600 underline-offset-2 hover:underline"
                >
                  attributions
                </Link>{' '}
                page.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Which regions?</dt>
              <dd className="mt-2 text-ink-muted">Beta: Scotland (UK) and Sindh (Pakistan).</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Is there an app yet?</dt>
              <dd className="mt-2 text-ink-muted">
                Mobile (iOS/Android) and the full product are in progress. This site is the waitlist
                for early access.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">What do you do with my waitlist email?</dt>
              <dd className="mt-2 text-ink-muted">
                See the{' '}
                <Link
                  href="/privacy"
                  className="text-forest-600 underline-offset-2 hover:underline"
                >
                  privacy policy
                </Link>
                . We use it to contact you about the beta (
                <a
                  href="mailto:contact@arsalandev.studio"
                  className="text-forest-600 underline-offset-2 hover:underline"
                >
                  contact@arsalandev.studio
                </a>
                ).
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
