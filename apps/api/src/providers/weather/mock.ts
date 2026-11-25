import type { HourlyWeather, WeatherFetchResult, WeatherProvider } from './types.js';

export type MockProviderOptions = {
  /** Fixed hours returned for every call (tests inject fixtures). */
  readonly hours?: readonly HourlyWeather[];
  /** Optional Expires override (defaults to 1h from `now`). */
  readonly expiresAt?: Date | null;
  /** Spy / assert call arguments (cell-centre check). */
  readonly onHourly?: (lat: number, lng: number, fromUtc: Date, hours: number) => void;
  readonly now?: () => Date;
};

/** In-process provider for tests and local offline work (T4.7). */
export class MockProvider implements WeatherProvider {
  readonly id = 'mock' as const;
  private readonly hours: readonly HourlyWeather[];
  private readonly expiresAt: Date | null | undefined;
  private readonly onHourly: MockProviderOptions['onHourly'];
  private readonly now: () => Date;

  constructor(options: MockProviderOptions = {}) {
    this.hours = options.hours ?? [];
    this.expiresAt = options.expiresAt;
    this.onHourly = options.onHourly;
    this.now = options.now ?? (() => new Date());
  }

  hourly(lat: number, lng: number, fromUtc: Date, hours: number): Promise<WeatherFetchResult> {
    this.onHourly?.(lat, lng, fromUtc, hours);
    const expiresAt =
      this.expiresAt === undefined
        ? new Date(this.now().getTime() + 60 * 60 * 1000)
        : this.expiresAt;
    return Promise.resolve({ hours: this.hours, expiresAt });
  }
}
