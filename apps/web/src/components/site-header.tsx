import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-forest-800/10 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="font-[family-name:var(--font-fraunces)] text-xl font-semibold tracking-tight text-forest-800 sm:text-2xl"
        >
          WildWindow
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm text-ink sm:gap-5">
          <Link href="/no-pin" className="hidden hover:text-forest-600 transition-colors sm:inline">
            No-Pin
          </Link>
          <Link href="/privacy" className="hover:text-forest-600 transition-colors">
            Privacy
          </Link>
          <Link
            href="/waitlist"
            className="rounded-md bg-gold px-3.5 py-2 font-semibold text-forest-950 transition hover:brightness-105"
          >
            Waitlist
          </Link>
        </nav>
      </div>
    </header>
  );
}
