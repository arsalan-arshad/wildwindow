import Link from 'next/link';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-forest-800/15 bg-mist">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-ink-muted sm:px-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="font-[family-name:var(--font-fraunces)] text-lg text-ink">WildWindow</p>
          <p>Working name · Beta regions: Scotland &amp; Sindh</p>
          <p>© {year} WildWindow</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-forest-600">
            Privacy
          </Link>
          <Link href="/waitlist" className="hover:text-forest-600">
            Waitlist
          </Link>
          <a
            href="https://arsalandev.studio"
            className="hover:text-forest-600"
            rel="noopener noreferrer"
          >
            Built by Arsalan Arshad
          </a>
        </div>
      </div>
    </footer>
  );
}
