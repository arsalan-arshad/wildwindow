'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ChallengeEntryModerationStatusSchema,
  type AdminChallengeEntry,
  type ChallengeEntryModerationStatus,
} from '@wildwindow/shared/api';
import { ApiClientError, type ApiClient } from '@wildwindow/shared/client';

import { formatAdminTime } from '@/lib/admin/format-admin-time';
import { useAuth } from '@/lib/auth/auth-context';

const STATUS_FILTERS: { value: ChallengeEntryModerationStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export type ModerationQueueProps = {
  /** Injectable for tests. Defaults to auth context client. */
  readonly apiClient?: ApiClient | null;
};

export function ModerationQueue({ apiClient: injected }: ModerationQueueProps = {}) {
  const auth = useAuth();
  const apiClient = injected !== undefined ? injected : auth.apiClient;

  const [statusFilter, setStatusFilter] = useState<ChallengeEntryModerationStatus | 'all'>(
    'pending',
  );
  const [entries, setEntries] = useState<AdminChallengeEntry[]>([]);
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (apiClient === null) {
      setError('API is not configured.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query =
        statusFilter === 'all'
          ? {}
          : { status: ChallengeEntryModerationStatusSchema.parse(statusFilter) };
      const response = await apiClient.admin.challengeEntries.list(query);
      setEntries(response.entries);
      setMessage(
        response.entries.length === 0
          ? 'No entries for this filter.'
          : `Loaded ${String(response.entries.length)} entr${response.entries.length === 1 ? 'y' : 'ies'}.`,
      );
    } catch (err: unknown) {
      setEntries([]);
      setError(err instanceof ApiClientError ? err.message : 'Failed to load challenge entries.');
    } finally {
      setLoading(false);
    }
  }, [apiClient, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function setRejectReason(id: string, value: string) {
    setRejectDrafts((prev) => ({ ...prev, [id]: value }));
  }

  async function moderate(
    entry: AdminChallengeEntry,
    nextStatus: ChallengeEntryModerationStatus,
  ): Promise<void> {
    if (apiClient === null) {
      setError('API is not configured.');
      return;
    }
    const rejectReason = rejectDrafts[entry.id]?.trim() ?? '';
    if (nextStatus === 'rejected' && rejectReason.length === 0) {
      setError('A reject reason is required.');
      return;
    }

    setBusyId(entry.id);
    setError(null);
    setMessage(null);
    try {
      const after = await apiClient.admin.challengeEntries.patch(
        entry.id,
        nextStatus === 'rejected'
          ? { status: 'rejected', rejectReason }
          : { status: nextStatus, rejectReason: null },
      );
      setEntries((prev) => {
        if (statusFilter !== 'all' && after.status !== statusFilter) {
          return prev.filter((row) => row.id !== entry.id);
        }
        return prev.map((row) => (row.id === entry.id ? after : row));
      });
      setRejectDrafts((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      setMessage(
        nextStatus === 'approved' ? `Approved entry ${entry.id}.` : `Rejected entry ${entry.id}.`,
      );
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to moderate entry.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="moderation-queue-heading">
      <h2 id="moderation-queue-heading" className="font-display text-2xl text-ink">
        Moderation queue
      </h2>
      <p className="text-sm text-ink-muted">
        Approve or reject challenge entries. Reject requires a reason. Place labels only — no map
        pins or exact coordinates.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-ink-muted">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'all') {
                setStatusFilter('all');
                return;
              }
              const parsed = ChallengeEntryModerationStatusSchema.safeParse(value);
              if (parsed.success) {
                setStatusFilter(parsed.data);
              }
            }}
            className="ml-2 rounded border border-forest-800/20 bg-paper px-2 py-1"
            aria-label="Filter by moderation status"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void load();
          }}
          className="rounded border border-forest-800/30 px-3 py-1 text-sm text-forest-800 disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Refresh'}
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

      {entries.length === 0 && !loading ? (
        <p className="text-sm text-ink-muted" data-testid="moderation-empty">
          Queue is empty for this filter.
        </p>
      ) : null}

      <ul className="space-y-4" data-testid="moderation-list">
        {entries.map((entry) => {
          const busy = busyId === entry.id;
          const draft = rejectDrafts[entry.id] ?? '';
          return (
            <li
              key={entry.id}
              className="rounded-lg border border-forest-800/15 bg-mist/40 p-4"
              data-testid={`moderation-entry-${entry.id}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg text-ink">
                  Entry {entry.id} · {entry.challengeSlug}
                </h3>
                <span className="text-sm uppercase tracking-wide text-ink-muted">
                  {entry.status}
                </span>
              </div>
              <dl className="mt-2 grid gap-1 text-sm text-ink-muted sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium text-ink">Place: </dt>
                  <dd className="inline">
                    {entry.countryCode} · {entry.regionLabel}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-ink">Photo key: </dt>
                  <dd className="inline break-all">{entry.photoKey}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-ink">Created: </dt>
                  <dd className="inline">{formatAdminTime(entry.createdAt)} UTC</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-ink">Publish after: </dt>
                  <dd className="inline">{formatAdminTime(entry.publishAfter)} UTC</dd>
                </div>
                {entry.rejectReason !== null ? (
                  <div className="sm:col-span-2">
                    <dt className="inline font-medium text-ink">Reject reason: </dt>
                    <dd className="inline">{entry.rejectReason}</dd>
                  </div>
                ) : null}
              </dl>

              {entry.status === 'pending' ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="text-ink-muted">Reject reason</span>
                    <textarea
                      value={draft}
                      onChange={(e) => {
                        setRejectReason(entry.id, e.target.value);
                      }}
                      rows={2}
                      className="mt-1 w-full rounded border border-forest-800/20 bg-paper px-3 py-2"
                      placeholder="Required when rejecting"
                      aria-label={`Reject reason for entry ${entry.id}`}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void moderate(entry, 'approved');
                      }}
                      className="rounded bg-forest-800 px-4 py-2 text-sm font-medium text-mist disabled:opacity-60"
                    >
                      {busy ? 'Working…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void moderate(entry, 'rejected');
                      }}
                      className="rounded border border-danger/40 px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
