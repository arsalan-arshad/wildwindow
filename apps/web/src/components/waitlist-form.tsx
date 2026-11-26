'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import {
  WaitlistSignupRequestSchema,
  type WaitlistPlatform,
  type WaitlistRegionSlug,
  type WaitlistRole,
  type WaitlistSource,
} from '@wildwindow/shared/api/waitlist';

import { trackEvent } from '@/lib/analytics';
import { getBrowserApiClient } from '@/lib/api';

const REGIONS: { value: WaitlistRegionSlug; label: string }[] = [
  { value: 'scotland', label: 'Scotland' },
  { value: 'sindh', label: 'Sindh' },
  { value: 'both', label: 'Both' },
  { value: 'other', label: 'Other / not sure' },
];

const ROLES: { value: WaitlistRole; label: string }[] = [
  { value: 'hobby_photographer', label: 'Hobby photographer' },
  { value: 'new_to_wildlife', label: 'New to wildlife photography' },
  { value: 'creator_educator', label: 'Creator / educator' },
  { value: 'naturalist_conservation', label: 'Naturalist / conservation' },
  { value: 'other', label: 'Other' },
];

const PLATFORMS: { value: WaitlistPlatform; label: string }[] = [
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'web', label: 'Web' },
  { value: 'unsure', label: 'Not sure yet' },
];

export type WaitlistFormProps = {
  readonly source?: WaitlistSource;
};

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export function WaitlistForm({ source = 'waitlist' }: WaitlistFormProps) {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    const raw = {
      email: String(data.get('email') ?? ''),
      name: String(data.get('name') ?? '') || undefined,
      regionSlug: (String(data.get('regionSlug') ?? '') || undefined) as
        WaitlistRegionSlug | undefined,
      role: (String(data.get('role') ?? '') || undefined) as WaitlistRole | undefined,
      platform: (String(data.get('platform') ?? '') || undefined) as WaitlistPlatform | undefined,
      favouriteSpecies: String(data.get('favouriteSpecies') ?? '') || undefined,
      consent: data.get('consent') === 'on' ? (true as const) : false,
      source,
      company: String(data.get('company') ?? ''),
    };

    const parsed = WaitlistSignupRequestSchema.safeParse(raw);
    if (!parsed.success) {
      setStatus('error');
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Please check the form and try again.');
      return;
    }

    setStatus('submitting');
    try {
      // Duplicates also return 200 `{ ok: true }` (no email enumeration).
      await getBrowserApiClient().waitlist.join(parsed.data);
      const analyticsProps: Record<string, string> = {};
      if (parsed.data.source !== undefined) {
        analyticsProps['source'] = parsed.data.source;
      }
      if (parsed.data.role !== undefined) {
        analyticsProps['role'] = parsed.data.role;
      }
      if (parsed.data.platform !== undefined) {
        analyticsProps['platform'] = parsed.data.platform;
      }
      trackEvent('waitlist_submitted', analyticsProps);
      setStatus('success');
      form.reset();
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
    }
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        className="rounded-xl border border-forest-600/20 bg-mist px-5 py-6 text-ink"
      >
        <p className="font-[family-name:var(--font-fraunces)] text-2xl text-forest-800">
          You’re on the list.
        </p>
        <p className="mt-2 text-ink-muted">
          We’ll be in touch when the beta opens. If you joined before, you’re already covered.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2" htmlFor="waitlist-email">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1.5 w-full rounded-md border border-forest-800/20 bg-paper px-3 py-2.5 text-ink outline-none ring-gold focus:ring-2"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-ink">
            Name <span className="font-normal text-ink-muted">(optional)</span>
          </span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            className="mt-1.5 w-full rounded-md border border-forest-800/20 bg-paper px-3 py-2.5 text-ink outline-none ring-gold focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Region</span>
          <select
            name="regionSlug"
            defaultValue=""
            className="mt-1.5 w-full rounded-md border border-forest-800/20 bg-paper px-3 py-2.5 text-ink outline-none ring-gold focus:ring-2"
          >
            <option value="">Select…</option>
            {REGIONS.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Role</span>
          <select
            name="role"
            defaultValue=""
            className="mt-1.5 w-full rounded-md border border-forest-800/20 bg-paper px-3 py-2.5 text-ink outline-none ring-gold focus:ring-2"
          >
            <option value="">Select…</option>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-ink">Platform</span>
          <select
            name="platform"
            defaultValue=""
            className="mt-1.5 w-full rounded-md border border-forest-800/20 bg-paper px-3 py-2.5 text-ink outline-none ring-gold focus:ring-2"
          >
            <option value="">Select…</option>
            {PLATFORMS.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-ink">
            Favourite species <span className="font-normal text-ink-muted">(optional)</span>
          </span>
          <input
            name="favouriteSpecies"
            type="text"
            maxLength={200}
            className="mt-1.5 w-full rounded-md border border-forest-800/20 bg-paper px-3 py-2.5 text-ink outline-none ring-gold focus:ring-2"
          />
        </label>
      </div>

      {/* Honeypot — hidden from humans */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0">
        <label>
          Company
          <input name="company" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          name="consent"
          type="checkbox"
          required
          className="mt-1 size-4 rounded border-forest-800/30 text-forest-600 focus:ring-gold"
        />
        <span>
          I agree to the{' '}
          <Link
            href="/privacy"
            className="font-medium text-forest-600 underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
        </span>
      </label>

      {errorMessage !== null ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded-md bg-gold px-5 py-3 font-semibold text-forest-950 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
      >
        {status === 'submitting' ? 'Joining…' : 'Join the waitlist'}
      </button>
    </form>
  );
}
