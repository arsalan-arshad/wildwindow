import {
  AdminChallengeEntriesQuerySchema,
  AdminChallengeEntriesResponseSchema,
  AdminChallengeEntryPatchSchema,
  AdminChallengeEntrySchema,
  AdminIngestRunsResponseSchema,
  AdminSessionSchema,
  AdminSpeciesCardPatchSchema,
  AdminSpeciesQuerySchema,
  AdminSpeciesResponseSchema,
  AdminTaxonRegionPatchSchema,
  AdminTaxonRegionSchema,
  type AdminChallengeEntriesQuery,
  type AdminChallengeEntriesResponse,
  type AdminChallengeEntry,
  type AdminChallengeEntryPatch,
  type AdminIngestRunsResponse,
  type AdminSession,
  type AdminSpeciesCardPatch,
  type AdminSpeciesQuery,
  type AdminSpeciesResponse,
  type AdminTaxonRegion,
  type AdminTaxonRegionPatch,
} from './api/admin.js';
import { AreaResponseSchema, type AreaResponse } from './api/areas.js';
import { AttributionsResponseSchema, type AttributionsResponse } from './api/attributions.js';
import {
  BugReportRequestSchema,
  BugReportResponseSchema,
  type BugReportRequest,
  type BugReportRequestInput,
  type BugReportResponse,
} from './api/bug-reports.js';
import {
  ChallengeEntriesQuerySchema,
  ChallengeEntriesResponseSchema,
  ChallengeResponseSchema,
  ChallengeSubmitOkSchema,
  ChallengeSubmitRequestSchema,
  type ChallengeEntriesQuery,
  type ChallengeEntriesResponse,
  type ChallengeResponse,
  type ChallengeSubmitOk,
  type ChallengeSubmitRequest,
} from './api/challenges.js';
import {
  ForecastQuerySchema,
  ForecastResponseSchema,
  type ForecastQuery,
  type ForecastResponse,
} from './api/forecast.js';
import { HealthOkSchema, type HealthOk } from './api/health.js';
import {
  LogbookCreateRequestSchema,
  LogbookEntryOwnerSchema,
  LogbookListResponseSchema,
  LogbookPatchRequestSchema,
  type LogbookCreateRequest,
  type LogbookEntryOwner,
  type LogbookListResponse,
  type LogbookPatchRequest,
} from './api/logbook.js';
import {
  MeDeleteOkSchema,
  MeExportOkSchema,
  MePatchRequestSchema,
  MeProfileSchema,
  WatchlistCreateRequestSchema,
  WatchlistItemSchema,
  WatchlistResponseSchema,
  type MeDeleteOk,
  type MeExportOk,
  type MePatchRequest,
  type MeProfile,
  type WatchlistCreateRequest,
  type WatchlistItem,
  type WatchlistResponse,
} from './api/me.js';
import {
  PlacesQuerySchema,
  PlacesResponseSchema,
  type PlacesQuery,
  type PlacesResponse,
} from './api/places.js';
import { RegionsResponseSchema, type RegionsResponse } from './api/regions.js';
import {
  RegionSpeciesQuerySchema,
  RegionSpeciesResponseSchema,
  SeasonalityQuerySchema,
  SeasonalityResponseSchema,
  SpeciesDetailQuerySchema,
  SpeciesDetailSchema,
  SpeciesMapQuerySchema,
  SpeciesMapResponseSchema,
  type RegionSpeciesQuery,
  type RegionSpeciesResponse,
  type SeasonalityQuery,
  type SeasonalityResponse,
  type SpeciesDetail,
  type SpeciesDetailQuery,
  type SpeciesMapQuery,
  type SpeciesMapResponse,
} from './api/species.js';
import {
  PresignUploadRequestSchema,
  PresignUploadResponseSchema,
  type PresignUploadRequest,
  type PresignUploadResponse,
} from './api/uploads.js';
import {
  WaitlistSignupOkSchema,
  WaitlistSignupRequestSchema,
  type WaitlistSignupOk,
  type WaitlistSignupRequest,
} from './api/waitlist.js';

export type CreateApiClientOptions = {
  readonly baseUrl: string;
  readonly getToken?: () => string | undefined | Promise<string | undefined>;
  readonly fetch?: typeof fetch;
};

export type ApiClient = {
  readonly health: {
    get: () => Promise<HealthOk>;
  };
  readonly regions: {
    list: () => Promise<RegionsResponse>;
    species: (slug: string, query?: RegionSpeciesQuery) => Promise<RegionSpeciesResponse>;
  };
  readonly species: {
    get: (taxonId: string, query: SpeciesDetailQuery) => Promise<SpeciesDetail>;
    seasonality: (taxonId: string, query: SeasonalityQuery) => Promise<SeasonalityResponse>;
    map: (taxonId: string, query: SpeciesMapQuery) => Promise<SpeciesMapResponse>;
  };
  readonly places: {
    search: (query: PlacesQuery) => Promise<PlacesResponse>;
  };
  readonly areas: {
    get: (cellR7: string) => Promise<AreaResponse>;
  };
  readonly forecast: {
    get: (query: ForecastQuery) => Promise<ForecastResponse>;
  };
  readonly attributions: {
    list: () => Promise<AttributionsResponse>;
  };
  readonly waitlist: {
    join: (body: WaitlistSignupRequest) => Promise<WaitlistSignupOk>;
  };
  readonly bugReports: {
    create: (body: BugReportRequestInput) => Promise<BugReportResponse>;
  };
  readonly me: {
    get: () => Promise<MeProfile>;
    patch: (body: MePatchRequest) => Promise<MeProfile>;
    delete: () => Promise<MeDeleteOk>;
    export: () => Promise<MeExportOk>;
    watchlist: {
      list: () => Promise<WatchlistResponse>;
      add: (body: WatchlistCreateRequest) => Promise<WatchlistItem>;
      remove: (id: string) => Promise<void>;
    };
    logbook: {
      list: () => Promise<LogbookListResponse>;
      create: (body: LogbookCreateRequest) => Promise<LogbookEntryOwner>;
      get: (id: string) => Promise<LogbookEntryOwner>;
      patch: (id: string, body: LogbookPatchRequest) => Promise<LogbookEntryOwner>;
      remove: (id: string) => Promise<void>;
    };
  };
  readonly uploads: {
    presign: (body: PresignUploadRequest) => Promise<PresignUploadResponse>;
  };
  readonly challenges: {
    current: () => Promise<ChallengeResponse>;
    get: (slug: string) => Promise<ChallengeResponse>;
    entries: (slug: string, query?: ChallengeEntriesQuery) => Promise<ChallengeEntriesResponse>;
    submit: (slug: string, body: ChallengeSubmitRequest) => Promise<ChallengeSubmitOk>;
  };
  readonly admin: {
    session: () => Promise<AdminSession>;
    species: {
      get: (taxonId: string, query: AdminSpeciesQuery) => Promise<AdminSpeciesResponse>;
      patch: (taxonId: string, body: AdminSpeciesCardPatch) => Promise<AdminSpeciesResponse>;
    };
    taxonRegion: {
      get: (taxonId: string, region: string) => Promise<AdminTaxonRegion>;
      patch: (
        taxonId: string,
        region: string,
        body: AdminTaxonRegionPatch,
      ) => Promise<AdminTaxonRegion>;
    };
    challengeEntries: {
      list: (query?: AdminChallengeEntriesQuery) => Promise<AdminChallengeEntriesResponse>;
      get: (id: string) => Promise<AdminChallengeEntry>;
      patch: (id: string, body: AdminChallengeEntryPatch) => Promise<AdminChallengeEntry>;
    };
    ingestRuns: {
      list: () => Promise<AdminIngestRunsResponse>;
    };
  };
};

function stripTrailingSlashes(value: string): string {
  // Linear-time trim (avoid `/\/+$/` ReDoS on long slash runs).
  let end = value.length;
  while (end > 0 && value.charAt(end - 1) === '/') {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

function joinUrl(baseUrl: string, path: string): string {
  const base = stripTrailingSlashes(baseUrl);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function toSearchParams(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value.length > 0) {
      params.set(key, value);
    }
  }
  const encoded = params.toString();
  return encoded.length > 0 ? `?${encoded}` : '';
}

/**
 * Typed HTTP client for Nest `/v1` (ARCHITECTURE §7).
 * Browser and mobile use this with `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL`.
 */
export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const fetcher = options.fetch ?? fetch;

  async function requestJson<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    parse: ((data: unknown) => T) | null,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
    };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const token = options.getToken !== undefined ? await options.getToken() : undefined;
    if (token !== undefined && token.length > 0) {
      headers['authorization'] = `Bearer ${token}`;
    }

    const init: RequestInit = {
      method,
      headers,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetcher(joinUrl(options.baseUrl, path), init);

    if (response.status === 204 || parse === null) {
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        throw apiErrorFromBody(data, response.status);
      }
      return undefined as T;
    }

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw apiErrorFromBody(data, response.status);
    }

    return parse(data);
  }

  return {
    health: {
      get: () => requestJson('GET', '/v1/health', (data) => HealthOkSchema.parse(data)),
    },
    regions: {
      list: () => requestJson('GET', '/v1/regions', (data) => RegionsResponseSchema.parse(data)),
      species: (slug, query = {}) => {
        const parsed = RegionSpeciesQuerySchema.parse(query);
        const qs = toSearchParams({
          q: parsed.q,
          group: parsed.group,
        });
        return requestJson('GET', `/v1/regions/${encodeURIComponent(slug)}/species${qs}`, (data) =>
          RegionSpeciesResponseSchema.parse(data),
        );
      },
    },
    species: {
      get: (taxonId, query) => {
        const parsed = SpeciesDetailQuerySchema.parse(query);
        const qs = toSearchParams({ region: parsed.region });
        return requestJson('GET', `/v1/species/${encodeURIComponent(taxonId)}${qs}`, (data) =>
          SpeciesDetailSchema.parse(data),
        );
      },
      seasonality: (taxonId, query) => {
        const parsed = SeasonalityQuerySchema.parse(query);
        const qs = toSearchParams({ region: parsed.region });
        return requestJson(
          'GET',
          `/v1/species/${encodeURIComponent(taxonId)}/seasonality${qs}`,
          (data) => SeasonalityResponseSchema.parse(data),
        );
      },
      map: (taxonId, query) => {
        const parsed = SpeciesMapQuerySchema.parse(query);
        const qs = toSearchParams({ region: parsed.region });
        return requestJson('GET', `/v1/species/${encodeURIComponent(taxonId)}/map${qs}`, (data) =>
          SpeciesMapResponseSchema.parse(data),
        );
      },
    },
    places: {
      search: (query) => {
        const parsed = PlacesQuerySchema.parse(query);
        const qs = toSearchParams({ q: parsed.q, region: parsed.region });
        return requestJson('GET', `/v1/places${qs}`, (data) => PlacesResponseSchema.parse(data));
      },
    },
    areas: {
      get: (cellR7) =>
        requestJson('GET', `/v1/areas/${encodeURIComponent(cellR7)}`, (data) =>
          AreaResponseSchema.parse(data),
        ),
    },
    forecast: {
      get: (query) => {
        const parsed = ForecastQuerySchema.parse(query);
        const qs = toSearchParams({
          taxonId: parsed.taxonId,
          cell: parsed.cell,
          start: parsed.start,
        });
        return requestJson('GET', `/v1/forecast${qs}`, (data) =>
          ForecastResponseSchema.parse(data),
        );
      },
    },
    attributions: {
      list: () =>
        requestJson('GET', '/v1/attributions', (data) => AttributionsResponseSchema.parse(data)),
    },
    waitlist: {
      async join(body) {
        const parsed = WaitlistSignupRequestSchema.parse(body);
        return requestJson(
          'POST',
          '/v1/waitlist',
          (data) => WaitlistSignupOkSchema.parse(data),
          parsed,
        );
      },
    },
    bugReports: {
      async create(body) {
        const parsed: BugReportRequest = BugReportRequestSchema.parse(body);
        return requestJson(
          'POST',
          '/v1/bug-reports',
          (data) => BugReportResponseSchema.parse(data),
          parsed,
        );
      },
    },
    me: {
      get: () => requestJson('GET', '/v1/me', (data) => MeProfileSchema.parse(data)),
      patch: (body) => {
        const parsed = MePatchRequestSchema.parse(body);
        return requestJson('PATCH', '/v1/me', (data) => MeProfileSchema.parse(data), parsed);
      },
      delete: () => requestJson('DELETE', '/v1/me', (data) => MeDeleteOkSchema.parse(data)),
      export: () => requestJson('POST', '/v1/me/export', (data) => MeExportOkSchema.parse(data)),
      watchlist: {
        list: () =>
          requestJson('GET', '/v1/me/watchlist', (data) => WatchlistResponseSchema.parse(data)),
        add: (body) => {
          const parsed = WatchlistCreateRequestSchema.parse(body);
          return requestJson(
            'POST',
            '/v1/me/watchlist',
            (data) => WatchlistItemSchema.parse(data),
            parsed,
          );
        },
        remove: (id) => requestJson('DELETE', `/v1/me/watchlist/${encodeURIComponent(id)}`, null),
      },
      logbook: {
        list: () =>
          requestJson('GET', '/v1/me/logbook', (data) => LogbookListResponseSchema.parse(data)),
        create: (body) => {
          const parsed = LogbookCreateRequestSchema.parse(body);
          return requestJson(
            'POST',
            '/v1/me/logbook',
            (data) => LogbookEntryOwnerSchema.parse(data),
            parsed,
          );
        },
        get: (id) =>
          requestJson('GET', `/v1/me/logbook/${encodeURIComponent(id)}`, (data) =>
            LogbookEntryOwnerSchema.parse(data),
          ),
        patch: (id, body) => {
          const parsed = LogbookPatchRequestSchema.parse(body);
          return requestJson(
            'PATCH',
            `/v1/me/logbook/${encodeURIComponent(id)}`,
            (data) => LogbookEntryOwnerSchema.parse(data),
            parsed,
          );
        },
        remove: (id) => requestJson('DELETE', `/v1/me/logbook/${encodeURIComponent(id)}`, null),
      },
    },
    uploads: {
      presign: (body) => {
        const parsed = PresignUploadRequestSchema.parse(body);
        return requestJson(
          'POST',
          '/v1/uploads/presign',
          (data) => PresignUploadResponseSchema.parse(data),
          parsed,
        );
      },
    },
    challenges: {
      current: () =>
        requestJson('GET', '/v1/challenges/current', (data) => ChallengeResponseSchema.parse(data)),
      get: (slug) =>
        requestJson('GET', `/v1/challenges/${encodeURIComponent(slug)}`, (data) =>
          ChallengeResponseSchema.parse(data),
        ),
      entries: (slug, query = {}) => {
        const parsed = ChallengeEntriesQuerySchema.parse(query);
        const qs = toSearchParams({ country: parsed.country, cursor: parsed.cursor });
        return requestJson(
          'GET',
          `/v1/challenges/${encodeURIComponent(slug)}/entries${qs}`,
          (data) => ChallengeEntriesResponseSchema.parse(data),
        );
      },
      submit: (slug, body) => {
        const parsed = ChallengeSubmitRequestSchema.parse(body);
        return requestJson(
          'POST',
          `/v1/challenges/${encodeURIComponent(slug)}/entries`,
          (data) => ChallengeSubmitOkSchema.parse(data),
          parsed,
        );
      },
    },
    admin: {
      session: () =>
        requestJson('GET', '/v1/admin/session', (data) => AdminSessionSchema.parse(data)),
      species: {
        get: (taxonId, query) => {
          const parsed = AdminSpeciesQuerySchema.parse(query);
          const qs = toSearchParams({ region: parsed.region });
          return requestJson(
            'GET',
            `/v1/admin/species/${encodeURIComponent(taxonId)}${qs}`,
            (data) => AdminSpeciesResponseSchema.parse(data),
          );
        },
        patch: (taxonId, body) => {
          const parsed = AdminSpeciesCardPatchSchema.parse(body);
          return requestJson(
            'PATCH',
            `/v1/admin/species/${encodeURIComponent(taxonId)}`,
            (data) => AdminSpeciesResponseSchema.parse(data),
            parsed,
          );
        },
      },
      taxonRegion: {
        get: (taxonId, region) =>
          requestJson(
            'GET',
            `/v1/admin/taxon-region/${encodeURIComponent(taxonId)}/${encodeURIComponent(region)}`,
            (data) => AdminTaxonRegionSchema.parse(data),
          ),
        patch: (taxonId, region, body) => {
          const parsed = AdminTaxonRegionPatchSchema.parse(body);
          return requestJson(
            'PATCH',
            `/v1/admin/taxon-region/${encodeURIComponent(taxonId)}/${encodeURIComponent(region)}`,
            (data) => AdminTaxonRegionSchema.parse(data),
            parsed,
          );
        },
      },
      challengeEntries: {
        list: (query = {}) => {
          const parsed = AdminChallengeEntriesQuerySchema.parse(query);
          const qs = toSearchParams({ status: parsed.status });
          return requestJson('GET', `/v1/admin/challenge-entries${qs}`, (data) =>
            AdminChallengeEntriesResponseSchema.parse(data),
          );
        },
        get: (id) =>
          requestJson('GET', `/v1/admin/challenge-entries/${encodeURIComponent(id)}`, (data) =>
            AdminChallengeEntrySchema.parse(data),
          ),
        patch: (id, body) => {
          const parsed = AdminChallengeEntryPatchSchema.parse(body);
          return requestJson(
            'PATCH',
            `/v1/admin/challenge-entries/${encodeURIComponent(id)}`,
            (data) => AdminChallengeEntrySchema.parse(data),
            parsed,
          );
        },
      },
      ingestRuns: {
        list: () =>
          requestJson('GET', '/v1/admin/ingest-runs', (data) =>
            AdminIngestRunsResponseSchema.parse(data),
          ),
      },
    },
  };
}

function apiErrorFromBody(data: unknown, status: number): ApiClientError {
  const code =
    typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string'
      ? data.code
      : 'HTTP_ERROR';
  const message =
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string'
      ? data.message
      : `Request failed with status ${String(status)}`;
  return new ApiClientError(code, message, status);
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}
