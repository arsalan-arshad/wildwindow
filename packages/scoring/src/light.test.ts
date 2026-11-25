import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { SCORING_V1 } from './config/v1.js';
import { candidateBlocks, lightForDay, sunAltitudeDeg, type LightDay } from './light.js';
import { zonedLocalDateTime } from './tz.js';

/**
 * Reference civil dawn/dusk (local clock, rounded to the minute).
 *
 * Source: timeanddate.com sunrise/sunset tables for each city
 * (Civil Twilight Start / End columns), retrieved 2026-11-25:
 * - https://www.timeanddate.com/sun/uk/glasgow?month=6&year=2024
 * - https://www.timeanddate.com/sun/uk/glasgow?month=9&year=2024
 * - https://www.timeanddate.com/sun/pakistan/karachi?month=6&year=2024
 * - https://www.timeanddate.com/sun/pakistan/karachi?month=9&year=2024
 *
 * Coordinates are approximate city centres (also used as display-cell centres).
 * Acceptance: ±1 minute vs these published civil twilight times.
 */
const PLACES = {
  glasgow: {
    lat: 55.8642,
    lng: -4.2518,
    timeZone: 'Europe/London',
  },
  karachi: {
    lat: 24.8607,
    lng: 67.0011,
    timeZone: 'Asia/Karachi',
  },
} as const;

type CivilRef = {
  readonly place: keyof typeof PLACES;
  readonly date: string;
  readonly label: string;
  readonly civilDawn: string;
  readonly civilDusk: string;
};

const CIVIL_REFS: readonly CivilRef[] = [
  {
    place: 'glasgow',
    date: '2024-06-21',
    label: 'June solstice',
    civilDawn: '03:29',
    civilDusk: '23:08',
  },
  {
    place: 'glasgow',
    date: '2024-09-22',
    label: 'September equinox',
    civilDawn: '06:25',
    civilDusk: '19:51',
  },
  {
    place: 'karachi',
    date: '2024-06-21',
    label: 'June solstice',
    civilDawn: '05:17',
    civilDusk: '19:50',
  },
  {
    place: 'karachi',
    date: '2024-09-22',
    label: 'September equinox',
    civilDawn: '05:57',
    civilDusk: '18:50',
  },
];

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  if (h === undefined || m === undefined) {
    throw new Error(`bad hm ${hm}`);
  }
  return h * 60 + m;
}

function minutesApart(a: string, b: string): number {
  return Math.abs(hmToMinutes(a) - hmToMinutes(b));
}

function expectWithinOneMinute(actual: string | null, expected: string): void {
  expect(actual).not.toBeNull();
  if (actual === null) {
    return;
  }
  expect(minutesApart(actual, expected), `${actual} vs ${expected}`).toBeLessThanOrEqual(1);
}

function altitudeAtLocal(day: LightDay, hm: string, lat: number, lng: number): number {
  const at = zonedLocalDateTime(day.date, hm, day.timeZone);
  return sunAltitudeDeg(at, { lat, lng });
}

describe('lightForDay', () => {
  it.each(CIVIL_REFS)(
    '$place $label ($date) civil dawn/dusk within ±1 min of timeanddate.com',
    (ref) => {
      const place = PLACES[ref.place];
      const day = lightForDay({
        date: ref.date,
        timeZone: place.timeZone,
        lat: place.lat,
        lng: place.lng,
      });
      expectWithinOneMinute(day.civilDawn, ref.civilDawn);
      expectWithinOneMinute(day.civilDusk, ref.civilDusk);
    },
  );

  it('golden and blue hour windows sit on the §4.2 altitude bands', () => {
    // HH:MM round-trip loses up to ~59s; allow ±1.5° (suncalc refraction vs geometric
    // angle tables also differ by ~0.5° below the horizon).
    const near = (actual: number, expected: number): void => {
      expect(Math.abs(actual - expected)).toBeLessThan(1.5);
    };

    for (const ref of CIVIL_REFS) {
      const place = PLACES[ref.place];
      const day = lightForDay({
        date: ref.date,
        timeZone: place.timeZone,
        lat: place.lat,
        lng: place.lng,
      });
      expect(day.goldenAm).not.toBeNull();
      expect(day.goldenPm).not.toBeNull();
      expect(day.blueAm).not.toBeNull();
      expect(day.bluePm).not.toBeNull();
      if (
        day.goldenAm === null ||
        day.goldenPm === null ||
        day.blueAm === null ||
        day.bluePm === null
      ) {
        continue;
      }

      // Blue abuts golden at −4°; civil abuts blue at −6°.
      expect(day.blueAm[1]).toBe(day.goldenAm[0]);
      expect(day.goldenPm[1]).toBe(day.bluePm[0]);
      expect(day.blueAm[0]).toBe(day.civilDawn);
      expect(day.bluePm[1]).toBe(day.civilDusk);

      // Morning blue: −6° → −4°; morning golden: −4° → +6°.
      near(
        altitudeAtLocal(day, day.blueAm[0], place.lat, place.lng),
        SCORING_V1.light.blueHourLowDeg,
      );
      near(
        altitudeAtLocal(day, day.blueAm[1], place.lat, place.lng),
        SCORING_V1.light.blueHourHighDeg,
      );
      near(
        altitudeAtLocal(day, day.goldenAm[0], place.lat, place.lng),
        SCORING_V1.light.goldenHourLowDeg,
      );
      near(
        altitudeAtLocal(day, day.goldenAm[1], place.lat, place.lng),
        SCORING_V1.light.goldenHourHighDeg,
      );

      // Evening golden: +6° → −4°; evening blue: −4° → −6°.
      near(
        altitudeAtLocal(day, day.goldenPm[0], place.lat, place.lng),
        SCORING_V1.light.goldenHourHighDeg,
      );
      near(
        altitudeAtLocal(day, day.goldenPm[1], place.lat, place.lng),
        SCORING_V1.light.goldenHourLowDeg,
      );
      near(
        altitudeAtLocal(day, day.bluePm[0], place.lat, place.lng),
        SCORING_V1.light.blueHourHighDeg,
      );
      near(
        altitudeAtLocal(day, day.bluePm[1], place.lat, place.lng),
        SCORING_V1.light.blueHourLowDeg,
      );
    }
  });

  it('candidate blocks are 2-hour hour-aligned windows inside civil daylight', () => {
    const day = lightForDay({
      date: '2024-09-22',
      timeZone: PLACES.glasgow.timeZone,
      lat: PLACES.glasgow.lat,
      lng: PLACES.glasgow.lng,
    });
    expect(day.candidateBlocks.length).toBeGreaterThan(0);
    for (const block of day.candidateBlocks) {
      expect(block.start.endsWith(':00')).toBe(true);
      expect(block.end.endsWith(':00')).toBe(true);
      const startMin = hmToMinutes(block.start);
      const endMin = hmToMinutes(block.end);
      expect(endMin - startMin).toBe(120);
      expect(day.civilDawn).not.toBeNull();
      expect(day.civilDusk).not.toBeNull();
      if (day.civilDawn === null || day.civilDusk === null) {
        continue;
      }
      expect(startMin).toBeGreaterThanOrEqual(hmToMinutes(day.civilDawn));
      expect(endMin).toBeLessThanOrEqual(hmToMinutes(day.civilDusk));
    }
  });

  it('polar edge cases do not throw', () => {
    // Near North Pole around June solstice — midnight sun / continuous civil day.
    expect(() =>
      lightForDay({
        date: '2024-06-21',
        timeZone: 'UTC',
        lat: 89,
        lng: 0,
      }),
    ).not.toThrow();

    // Near North Pole around December solstice — polar night.
    expect(() =>
      lightForDay({
        date: '2024-12-21',
        timeZone: 'UTC',
        lat: 89,
        lng: 0,
      }),
    ).not.toThrow();

    const polarNight = lightForDay({
      date: '2024-12-21',
      timeZone: 'UTC',
      lat: 89,
      lng: 0,
    });
    expect(polarNight.candidateBlocks).toEqual([]);

    const midnightSun = lightForDay({
      date: '2024-06-21',
      timeZone: 'UTC',
      lat: 89,
      lng: 0,
    });
    // Continuous civil daylight → 24 hour-aligned candidate blocks.
    expect(midnightSun.candidateBlocks.length).toBe(24);
  });
});

describe('candidateBlocks property', () => {
  it('never returns a block longer or shorter than two hours for normal days', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 2, max: 22 }),
        (dawnH, span) => {
          const duskH = Math.min(24, dawnH + span);
          if (duskH - dawnH < 2) {
            return true;
          }
          const date = '2024-06-15';
          const timeZone = 'UTC';
          const civilDawn = zonedLocalDateTime(
            date,
            `${String(dawnH).padStart(2, '0')}:30`,
            timeZone,
          );
          const civilDusk = zonedLocalDateTime(
            date,
            duskH === 24 ? '23:59' : `${String(duskH).padStart(2, '0')}:00`,
            timeZone,
          );
          const blocks = candidateBlocks({
            date,
            timeZone,
            civilDawn,
            civilDusk,
          });
          for (const b of blocks) {
            const dur = hmToMinutes(b.end) - hmToMinutes(b.start);
            if (dur !== 120) {
              return false;
            }
          }
          return true;
        },
      ),
    );
  });
});
