'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  type AdminTaxonRegion,
  RegionIdSchema,
  SensitivityTierSchema,
} from '@wildwindow/shared/api';
import { ApiClientError, type ApiClient } from '@wildwindow/shared/client';
import type { z } from 'zod';

import { isTierLowering, MONTH_LABELS, TIER_OPTIONS } from '@/lib/admin/tier-rank';
import { useAuth } from '@/lib/auth/auth-context';

type RegionId = z.infer<typeof RegionIdSchema>;
type SensitivityTier = z.infer<typeof SensitivityTierSchema>;

const REGIONS: { value: RegionId; label: string }[] = [
  { value: 'scotland', label: 'Scotland' },
  { value: 'sindh', label: 'Sindh' },
];

export type TierAuditEntry = {
  readonly action: 'taxon_region.update';
  readonly entity: 'taxon_region';
  readonly entityId: string;
  readonly before: AdminTaxonRegion;
  readonly after: AdminTaxonRegion;
  readonly at: string;
};

export type TierLockoutEditorProps = {
  /** Injectable for tests. Defaults to auth context client. */
  readonly apiClient?: ApiClient | null;
  /** Skip the browser confirm dialog (tests pass a stub or set true after asserting). */
  readonly confirmFn?: (message: string) => boolean;
};

export function TierLockoutEditor({
  apiClient: injected,
  confirmFn = (message) => window.confirm(message),
}: TierLockoutEditorProps = {}) {
  const auth = useAuth();
  const apiClient = injected !== undefined ? injected : auth.apiClient;

  const [region, setRegion] = useState<RegionId>('scotland');
  const [taxonId, setTaxonId] = useState('');
  const [current, setCurrent] = useState<AdminTaxonRegion | null>(null);
  const [tier, setTier] = useState<SensitivityTier>('open');
  const [lockoutMonths, setLockoutMonths] = useState<number[]>([]);
  const [reviewer, setReviewer] = useState('');
  const [auditEntry, setAuditEntry] = useState<TierAuditEntry | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (apiClient === null) {
      setError('API is not configured.');
      return;
    }
    const id = taxonId.trim();
    if (!/^\d+$/.test(id)) {
      setError('Enter a numeric GBIF taxon id.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    setAuditEntry(null);
    try {
      const response = await apiClient.admin.taxonRegion.get(id, region);
      setCurrent(response);
      setTier(response.tier);
      setLockoutMonths([...response.lockoutMonths]);
      setReviewer(response.reviewer ?? '');
      setMessage(`Loaded tier ${response.tier}.`);
    } catch (err: unknown) {
      setCurrent(null);
      setError(err instanceof ApiClientError ? err.message : 'Failed to load taxon–region.');
    } finally {
      setBusy(false);
    }
  }, [apiClient, region, taxonId]);

  useEffect(() => {
    setCurrent(null);
    setAuditEntry(null);
    setMessage(null);
  }, [region, taxonId]);

  function toggleMonth(month: number) {
    setLockoutMonths((prev) =>
      prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month].sort((a, b) => a - b),
    );
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (apiClient === null) {
      setError('API is not configured.');
      return;
    }
    if (current === null) {
      setError('Load a taxon–region before saving.');
      return;
    }
    const id = taxonId.trim();

    const lowering = isTierLowering(current.tier, tier);
    const confirmLines = [
      `Update sensitivity for taxon ${id} in ${region}?`,
      '',
      `Tier: ${current.tier} → ${tier}`,
      `Lockout months: [${current.lockoutMonths.join(', ')}] → [${lockoutMonths.join(', ')}]`,
    ];
    if (lowering) {
      confirmLines.push(
        '',
        'This LOWERS the privacy tier. Only proceed if intentional (audit-logged).',
      );
    }

    if (!confirmFn(confirmLines.join('\n'))) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const after = await apiClient.admin.taxonRegion.patch(id, region, {
        tier,
        lockoutMonths,
        ...(reviewer.trim().length > 0 ? { reviewer: reviewer.trim() } : {}),
      });
      const entry: TierAuditEntry = {
        action: 'taxon_region.update',
        entity: 'taxon_region',
        entityId: `${id}:${region}`,
        before: current,
        after,
        at: after.reviewedAt ?? new Date().toISOString(),
      };
      setAuditEntry(entry);
      setCurrent(after);
      setTier(after.tier);
      setLockoutMonths([...after.lockoutMonths]);
      setReviewer(after.reviewer ?? '');
      setMessage('Tier updated. Forecast cache cleared on the API.');
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update tier.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="tier-editor-heading">
      <h2 id="tier-editor-heading" className="font-display text-2xl text-ink">
        Tier and lockout editor
      </h2>
      <p className="text-sm text-ink-muted">
        Sensitivity tiers and breeding lockout months. Every change is audit-logged; lowering a tier
        requires confirmation.
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="text-ink-muted">Region</span>
          <select
            value={region}
            onChange={(e) => {
              const parsed = RegionIdSchema.safeParse(e.target.value);
              if (parsed.success) {
                setRegion(parsed.data);
              }
            }}
            className="ml-2 rounded border border-forest-800/20 bg-paper px-2 py-1"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-ink-muted">Taxon id</span>
          <input
            value={taxonId}
            onChange={(e) => {
              setTaxonId(e.target.value);
            }}
            inputMode="numeric"
            placeholder="e.g. 2433409"
            className="ml-2 w-36 rounded border border-forest-800/20 bg-paper px-2 py-1"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void load();
          }}
          className="rounded border border-forest-800/30 px-3 py-1 text-sm text-forest-800 disabled:opacity-60"
        >
          Load
        </button>
      </div>

      {error !== null ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message !== null ? (
        <p role="status" className="text-sm text-forest-600">
          {message}
        </p>
      ) : null}

      {current !== null ? (
        <form
          onSubmit={(e) => {
            void onSave(e);
          }}
          className="space-y-4"
        >
          <label className="block text-sm">
            <span className="text-ink-muted">Tier</span>
            <select
              value={tier}
              onChange={(e) => {
                const parsed = SensitivityTierSchema.safeParse(e.target.value);
                if (parsed.success) {
                  setTier(parsed.data);
                }
              }}
              className="ml-2 rounded border border-forest-800/20 bg-paper px-2 py-1"
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm text-ink-muted">Lockout months</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <label
                  key={month}
                  className="inline-flex items-center gap-1 rounded border border-forest-800/15 px-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={lockoutMonths.includes(month)}
                    onChange={() => {
                      toggleMonth(month);
                    }}
                  />
                  {MONTH_LABELS[month]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm">
            <span className="text-ink-muted">Reviewer (optional override)</span>
            <input
              value={reviewer}
              onChange={(e) => {
                setReviewer(e.target.value);
              }}
              className="mt-1 w-full max-w-md rounded border border-forest-800/20 bg-paper px-3 py-2"
              placeholder="Defaults to signed-in admin label"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="rounded bg-forest-800 px-4 py-2 text-sm font-medium text-mist disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save tier'}
          </button>
        </form>
      ) : null}

      {auditEntry !== null ? (
        <aside
          aria-label="Audit entry"
          className="rounded-lg border border-forest-800/20 bg-mist/50 p-4 text-sm"
          data-testid="tier-audit-entry"
        >
          <h3 className="font-display text-lg text-ink">Audit entry</h3>
          <dl className="mt-2 grid gap-1 text-ink-muted">
            <div>
              <dt className="inline font-medium text-ink">action: </dt>
              <dd className="inline">{auditEntry.action}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink">entity: </dt>
              <dd className="inline">
                {auditEntry.entity} · {auditEntry.entityId}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink">at: </dt>
              <dd className="inline">{auditEntry.at}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink">before: </dt>
              <dd className="inline">
                tier={auditEntry.before.tier}, lockout=[{auditEntry.before.lockoutMonths.join(', ')}
                ]
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink">after: </dt>
              <dd className="inline">
                tier={auditEntry.after.tier}, lockout=[{auditEntry.after.lockoutMonths.join(', ')}]
              </dd>
            </div>
            {auditEntry.after.reviewer !== null ? (
              <div>
                <dt className="inline font-medium text-ink">reviewer: </dt>
                <dd className="inline">{auditEntry.after.reviewer}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      ) : null}
    </section>
  );
}
