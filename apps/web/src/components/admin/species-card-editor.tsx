'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  type AdminSpeciesCard,
  type AdminSpeciesResponse,
  RegionIdSchema,
} from '@wildwindow/shared/api';
import { ApiClientError, type ApiClient } from '@wildwindow/shared/client';
import type { z } from 'zod';

type RegionId = z.infer<typeof RegionIdSchema>;

import { useAuth } from '@/lib/auth/auth-context';

const REGIONS: { value: RegionId; label: string }[] = [
  { value: 'scotland', label: 'Scotland' },
  { value: 'sindh', label: 'Sindh' },
];

export type SpeciesCardEditorProps = {
  /** Injectable for tests. Defaults to auth context client. */
  readonly apiClient?: ApiClient | null;
};

type EditorState = {
  bodyMd: string;
  ethicsMd: string;
  legalMd: string;
  settingsJson: string;
  status: 'draft' | 'reviewed';
};

function cardToState(card: AdminSpeciesCard | null): EditorState {
  if (card === null) {
    return {
      bodyMd: '',
      ethicsMd: '',
      legalMd: '',
      settingsJson: '{\n  "perched": {},\n  "flight": {},\n  "lowLight": {}\n}',
      status: 'draft',
    };
  }
  return {
    bodyMd: card.bodyMd,
    ethicsMd: card.ethicsMd ?? '',
    legalMd: card.legalMd ?? '',
    settingsJson: JSON.stringify(card.settings, null, 2),
    status: card.status,
  };
}

export function SpeciesCardEditor({ apiClient: injected }: SpeciesCardEditorProps = {}) {
  const auth = useAuth();
  const apiClient = injected !== undefined ? injected : auth.apiClient;

  const [region, setRegion] = useState<RegionId>('scotland');
  const [taxonId, setTaxonId] = useState('');
  const [loaded, setLoaded] = useState<AdminSpeciesResponse | null>(null);
  const [state, setState] = useState<EditorState>(cardToState(null));
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
    try {
      const response = await apiClient.admin.species.get(id, { region });
      setLoaded(response);
      setState(cardToState(response.card));
      setMessage(
        response.cardStatus === 'missing'
          ? 'No card yet — fill the form and save to create one.'
          : `Loaded ${response.cardStatus} card.`,
      );
    } catch (err: unknown) {
      setLoaded(null);
      setError(err instanceof ApiClientError ? err.message : 'Failed to load card.');
    } finally {
      setBusy(false);
    }
  }, [apiClient, region, taxonId]);

  useEffect(() => {
    // Reset editor when region/taxon inputs change after a load.
    setLoaded(null);
    setMessage(null);
  }, [region, taxonId]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (apiClient === null) {
      setError('API is not configured.');
      return;
    }
    const id = taxonId.trim();
    if (!/^\d+$/.test(id)) {
      setError('Enter a numeric GBIF taxon id.');
      return;
    }
    if (state.bodyMd.trim().length === 0) {
      setError('Markdown body is required.');
      return;
    }

    let settings: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(state.settingsJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError('Settings must be a JSON object.');
        return;
      }
      settings = parsed as Record<string, unknown>;
    } catch {
      setError('Settings JSON is invalid.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiClient.admin.species.patch(id, {
        region,
        bodyMd: state.bodyMd,
        ethicsMd: state.ethicsMd.trim().length > 0 ? state.ethicsMd : null,
        legalMd: state.legalMd.trim().length > 0 ? state.legalMd : null,
        settings,
        status: state.status,
      });
      setLoaded(response);
      setState(cardToState(response.card));
      setMessage(`Saved ${response.cardStatus} card (audit-logged).`);
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to save card.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="card-editor-heading">
      <h2 id="card-editor-heading" className="font-display text-2xl text-ink">
        Species card editor
      </h2>
      <p className="text-sm text-ink-muted">
        Edit Markdown field cards. Changes are audit-logged via{' '}
        <code className="text-xs">PATCH /v1/admin/species/:taxonId</code>.
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
            placeholder="e.g. 5229243"
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

      <form
        onSubmit={(e) => {
          void onSave(e);
        }}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="text-ink-muted">Body (Markdown)</span>
          <textarea
            value={state.bodyMd}
            onChange={(e) => {
              setState((s) => ({ ...s, bodyMd: e.target.value }));
            }}
            rows={12}
            className="mt-1 w-full rounded border border-forest-800/20 bg-paper px-3 py-2 font-mono text-sm"
            spellCheck
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">Ethics (Markdown, optional)</span>
          <textarea
            value={state.ethicsMd}
            onChange={(e) => {
              setState((s) => ({ ...s, ethicsMd: e.target.value }));
            }}
            rows={4}
            className="mt-1 w-full rounded border border-forest-800/20 bg-paper px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">Legal notes (Markdown, optional)</span>
          <textarea
            value={state.legalMd}
            onChange={(e) => {
              setState((s) => ({ ...s, legalMd: e.target.value }));
            }}
            rows={3}
            className="mt-1 w-full rounded border border-forest-800/20 bg-paper px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">Settings (JSON)</span>
          <textarea
            value={state.settingsJson}
            onChange={(e) => {
              setState((s) => ({ ...s, settingsJson: e.target.value }));
            }}
            rows={6}
            className="mt-1 w-full rounded border border-forest-800/20 bg-paper px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">Status</span>
          <select
            value={state.status}
            onChange={(e) => {
              const next = e.target.value === 'reviewed' ? 'reviewed' : 'draft';
              setState((s) => ({ ...s, status: next }));
            }}
            className="ml-2 rounded border border-forest-800/20 bg-paper px-2 py-1"
          >
            <option value="draft">draft</option>
            <option value="reviewed">reviewed</option>
          </select>
        </label>
        {loaded?.card?.reviewedBy !== undefined && loaded.card.reviewedBy !== null ? (
          <p className="text-xs text-ink-muted">
            Last reviewed by {loaded.card.reviewedBy}
            {loaded.card.reviewedAt !== null ? ` · ${loaded.card.reviewedAt}` : ''}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-forest-800 px-4 py-2 text-sm font-medium text-mist disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save card'}
        </button>
      </form>
    </section>
  );
}
