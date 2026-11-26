'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AdminIngestRun } from '@wildwindow/shared/api';
import { ApiClientError, type ApiClient } from '@wildwindow/shared/client';

import { formatAdminTime } from '@/lib/admin/format-admin-time';
import { useAuth } from '@/lib/auth/auth-context';

export type IngestRunsTableProps = {
  /** Injectable for tests. Defaults to auth context client. */
  readonly apiClient?: ApiClient | null;
};

function cell(value: string | number | null): string {
  if (value === null) {
    return '—';
  }
  return String(value);
}

export function IngestRunsTable({ apiClient: injected }: IngestRunsTableProps = {}) {
  const auth = useAuth();
  const apiClient = injected !== undefined ? injected : auth.apiClient;

  const [runs, setRuns] = useState<AdminIngestRun[]>([]);
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
      const response = await apiClient.admin.ingestRuns.list();
      setRuns(response.runs);
      setMessage(
        response.runs.length === 0
          ? 'No ingestion runs yet.'
          : `Loaded ${String(response.runs.length)} run${response.runs.length === 1 ? '' : 's'}.`,
      );
    } catch (err: unknown) {
      setRuns([]);
      setError(err instanceof ApiClientError ? err.message : 'Failed to load ingestion runs.');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4" aria-labelledby="ingest-runs-heading">
      <h2 id="ingest-runs-heading" className="font-display text-2xl text-ink">
        Ingestion runs
      </h2>
      <p className="text-sm text-ink-muted">
        GBIF download and load status. Counters show licence, coordinate and other rejects — never
        raw occurrence points.
      </p>

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

      <div className="overflow-x-auto rounded-lg border border-forest-800/15">
        <table className="min-w-full text-left text-sm" data-testid="ingest-runs-table">
          <thead className="bg-mist/60 text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Region</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Loaded</th>
              <th className="px-3 py-2 font-medium">Rej. licence</th>
              <th className="px-3 py-2 font-medium">Rej. coords</th>
              <th className="px-3 py-2 font-medium">Rej. other</th>
              <th className="px-3 py-2 font-medium">GBIF key</th>
              <th className="px-3 py-2 font-medium">DOI</th>
              <th className="px-3 py-2 font-medium">Started</th>
              <th className="px-3 py-2 font-medium">Finished</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={14}
                  className="px-3 py-4 text-ink-muted"
                  data-testid="ingest-runs-empty"
                >
                  No runs to show.
                </td>
              </tr>
            ) : null}
            {runs.map((run) => (
              <tr
                key={run.id}
                className="border-t border-forest-800/10"
                data-testid={`ingest-run-${run.id}`}
              >
                <td className="px-3 py-2 text-ink">{run.id}</td>
                <td className="px-3 py-2">{run.source}</td>
                <td className="px-3 py-2">{run.regionSlug}</td>
                <td className="px-3 py-2">{run.kind}</td>
                <td className="px-3 py-2">
                  <span className="uppercase tracking-wide">{run.status}</span>
                </td>
                <td className="px-3 py-2 tabular-nums">{cell(run.total)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(run.loaded)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(run.rejectedLicence)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(run.rejectedCoords)}</td>
                <td className="px-3 py-2 tabular-nums">{cell(run.rejectedOther)}</td>
                <td className="px-3 py-2 break-all">{cell(run.gbifDownloadKey)}</td>
                <td className="px-3 py-2 break-all">{cell(run.doi)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatAdminTime(run.startedAt)} UTC
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatAdminTime(run.finishedAt)} UTC
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
