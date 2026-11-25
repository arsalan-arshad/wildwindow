import { Inject, Injectable, Optional } from '@nestjs/common';
import { weatherCache, type Database } from '@wildwindow/db';
import { and, eq, gt } from 'drizzle-orm';
import { z } from 'zod';

import { DB } from '../../db/db.module.js';

import { weatherCellCentre } from './cell-centre.js';
import {
  HourlyWeatherSchema,
  WEATHER_CACHE_DEFAULT_TTL_MS,
  type HourlyWeather,
  type WeatherProvider,
} from './types.js';
import { WEATHER_PROVIDER } from './weather.tokens.js';

const CachedPayloadSchema = z.object({
  hours: HourlyWeatherSchema.array(),
});

/**
 * Weather facade (T4.7): snaps the request cell to res-5, calls the provider
 * with the **cell centre** (never a user pin), and caches in `pub.weather_cache`.
 */
@Injectable()
export class WeatherService {
  constructor(
    @Inject(WEATHER_PROVIDER) private readonly provider: WeatherProvider,
    @Optional() @Inject(DB) private readonly db: Database | null,
  ) {}

  /**
   * Hourly forecast for an H3 cell. Input may be res-7 (or any res ≥ 5);
   * the network call always uses the res-5 parent centre.
   */
  async hourlyForCell(
    cell: string,
    fromUtc: Date,
    hours: number,
  ): Promise<readonly HourlyWeather[]> {
    const { cellR5, lat, lng } = weatherCellCentre(cell);
    const cached = await this.readCache(cellR5);
    if (cached !== null) {
      return filterWindow(cached, fromUtc, hours);
    }

    const fetched = await this.provider.hourly(lat, lng, fromUtc, hours);
    const expiresAt =
      fetched.expiresAt ?? new Date(this.clock().getTime() + WEATHER_CACHE_DEFAULT_TTL_MS);
    await this.writeCache(cellR5, fetched.hours, expiresAt);
    return filterWindow(fetched.hours, fromUtc, hours);
  }

  private clock(): Date {
    return new Date();
  }

  private async readCache(cellR5: string): Promise<readonly HourlyWeather[] | null> {
    if (this.db === null) {
      return null;
    }
    const now = this.clock();
    const rows = await this.db
      .select()
      .from(weatherCache)
      .where(
        and(
          eq(weatherCache.provider, this.provider.id),
          eq(weatherCache.cellR5, cellR5),
          gt(weatherCache.expiresAt, now),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const parsed = CachedPayloadSchema.safeParse(row.payload);
    return parsed.success ? parsed.data.hours : null;
  }

  private async writeCache(
    cellR5: string,
    hours: readonly HourlyWeather[],
    expiresAt: Date,
  ): Promise<void> {
    if (this.db === null) {
      return;
    }
    const fetchedAt = this.clock();
    const payload = { hours: [...hours] };
    await this.db
      .insert(weatherCache)
      .values({
        provider: this.provider.id,
        cellR5,
        fetchedAt,
        expiresAt,
        payload,
      })
      .onConflictDoUpdate({
        target: [weatherCache.provider, weatherCache.cellR5],
        set: {
          fetchedAt,
          expiresAt,
          payload,
        },
      });
  }
}

function filterWindow(
  hours: readonly HourlyWeather[],
  fromUtc: Date,
  count: number,
): readonly HourlyWeather[] {
  const fromMs = fromUtc.getTime();
  const untilMs = fromMs + count * 60 * 60 * 1000;
  return hours.filter((hour) => {
    const at = Date.parse(hour.timeUtc);
    return !Number.isNaN(at) && at >= fromMs && at < untilMs;
  });
}
