/**
 * Minimal GitHub Issues client for T9.11 bug reports.
 * Token stays in server env; never logged or returned to clients.
 */

export type CreateGithubIssueInput = {
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
};

export type CreateGithubIssueResult = {
  readonly number: number;
  readonly htmlUrl: string;
};

export type GithubIssuesClient = {
  createIssue: (input: CreateGithubIssueInput) => Promise<CreateGithubIssueResult>;
};

export type GithubIssuesClientOptions = {
  readonly owner: string;
  readonly repo: string;
  readonly token: string;
  readonly fetch?: typeof fetch;
  readonly apiBaseUrl?: string;
};

type GithubIssueResponse = {
  readonly number?: unknown;
  readonly html_url?: unknown;
};

export function createGithubIssuesClient(options: GithubIssuesClientOptions): GithubIssuesClient {
  const fetcher = options.fetch ?? fetch;
  const apiBase = (options.apiBaseUrl ?? 'https://api.github.com').replace(/\/+$/, '');

  return {
    async createIssue(input) {
      const response = await fetcher(
        `${apiBase}/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}/issues`,
        {
          method: 'POST',
          headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${options.token}`,
            'content-type': 'application/json',
            'x-github-api-version': '2022-11-28',
            'user-agent': 'wildwindow-api-bug-reports',
          },
          body: JSON.stringify({
            title: input.title,
            body: input.body,
            labels: [...input.labels],
          }),
        },
      );

      if (!response.ok) {
        // Do not include response body — it may echo title/body or auth hints.
        throw new Error(`GitHub Issues API returned ${String(response.status)}`);
      }

      const data = (await response.json()) as GithubIssueResponse;
      if (typeof data.number !== 'number' || !Number.isInteger(data.number) || data.number < 1) {
        throw new Error('GitHub Issues API response missing issue number');
      }
      if (typeof data.html_url !== 'string' || data.html_url.length === 0) {
        throw new Error('GitHub Issues API response missing html_url');
      }

      return { number: data.number, htmlUrl: data.html_url };
    },
  };
}
