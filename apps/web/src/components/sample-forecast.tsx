'use client';

import { useEffect, useRef, useState } from 'react';

const TARGET_SCORE = 82;

export function SampleForecast() {
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (node === null) {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setScore(TARGET_SCORE);
      setStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) {
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setScore(TARGET_SCORE);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 900;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setScore(Math.round(TARGET_SCORE * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started]);

  return (
    <aside
      ref={rootRef}
      aria-label="Sample forecast"
      className="w-full max-w-sm rounded-2xl border border-paper/20 bg-paper/95 p-5 text-ink shadow-[var(--shadow-soft)] backdrop-blur-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest-600">Sample</p>
      <p className="mt-1 text-sm text-ink-muted">Not a live forecast</p>
      <h2 className="mt-4 font-[family-name:var(--font-fraunces)] text-2xl leading-tight text-forest-800">
        Common kingfisher
      </h2>
      <p className="text-sm italic text-ink-muted">Alcedo atthis</p>
      <p className="mt-2 text-sm text-ink-muted">Glasgow area</p>

      <div className="mt-5 flex items-end gap-3">
        <p className="font-[family-name:var(--font-fraunces)] text-5xl tabular-nums text-forest-800">
          <span className="sr-only">Window score </span>
          {score}
          <span className="text-2xl text-ink-muted">/100</span>
        </p>
        <p className="mb-1 rounded-md bg-gold-soft px-2 py-1 text-sm font-semibold text-forest-800">
          High
        </p>
      </div>
      <p className="mt-1 text-sm text-ink-muted">Window score</p>

      <dl className="mt-5 grid gap-2 text-sm">
        <div className="flex justify-between gap-4 border-t border-forest-800/10 pt-3">
          <dt className="text-ink-muted">Best day</dt>
          <dd className="font-medium">Thursday</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Best 2-hour block</dt>
          <dd className="font-medium">06:30–08:30</dd>
        </div>
      </dl>

      <ul className="mt-5 flex flex-wrap gap-2 text-xs text-ink-muted">
        <li className="rounded-md border border-forest-800/15 px-2 py-1">Season</li>
        <li className="rounded-md border border-forest-800/15 px-2 py-1">Light</li>
        <li className="rounded-md border border-forest-800/15 px-2 py-1">Weather</li>
      </ul>
    </aside>
  );
}
