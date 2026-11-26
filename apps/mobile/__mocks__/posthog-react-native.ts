export class PostHog {
  readonly capture = jest.fn();

  constructor(
    readonly apiKey: string,
    readonly options: { host: string },
  ) {}
}

export default { PostHog };
