/**
 * Field card (S-08) helpers — settings normalisation and review gate.
 * Wire shapes mirror `SpeciesCardSummary` in `./species`.
 */

import type { SpeciesCardSummary } from '@/lib/species';

export const CAMERA_SETTING_KEYS = [
  'shutter',
  'aperture',
  'iso',
  'focusMode',
  'driveMode',
] as const;
export type CameraSettingKey = (typeof CAMERA_SETTING_KEYS)[number];

export type CameraSettingRow = {
  readonly key: string;
  readonly value: string;
};

export type CameraSceneBlock = {
  readonly id: string;
  readonly rows: readonly CameraSettingRow[];
};

export type ParsedCardSettings = {
  readonly scenes: readonly CameraSceneBlock[];
  readonly rows: readonly CameraSettingRow[];
};

const SETTING_ALIASES: Readonly<Record<string, CameraSettingKey>> = {
  shutter: 'shutter',
  shutterSpeed: 'shutter',
  shutter_speed: 'shutter',
  aperture: 'aperture',
  fstop: 'aperture',
  fStop: 'aperture',
  iso: 'iso',
  isoApproach: 'iso',
  iso_approach: 'iso',
  focusMode: 'focusMode',
  focus_mode: 'focusMode',
  focus: 'focusMode',
  driveMode: 'driveMode',
  drive_mode: 'driveMode',
  drive: 'driveMode',
};

const SCENE_ALIASES: Readonly<Record<string, string>> = {
  perched: 'perched',
  flight: 'flight',
  inFlight: 'flight',
  in_flight: 'flight',
  'in flight': 'flight',
  lowLight: 'lowLight',
  low_light: 'lowLight',
  'low light': 'lowLight',
};

function stringifySettingValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsFromRecord(record: Readonly<Record<string, unknown>>): CameraSettingRow[] {
  const rows: CameraSettingRow[] = [];
  for (const [rawKey, rawValue] of Object.entries(record)) {
    if (isPlainObject(rawValue)) {
      continue;
    }
    const value = stringifySettingValue(rawValue);
    if (value === null) {
      continue;
    }
    const alias = SETTING_ALIASES[rawKey] ?? SETTING_ALIASES[rawKey.replace(/\s+/g, '')];
    rows.push({ key: alias ?? rawKey, value });
  }
  return rows;
}

/** Normalise jsonb `settings` into scene blocks and/or flat rows for the field card UI. */
export function parseCardSettings(settings: Readonly<Record<string, unknown>>): ParsedCardSettings {
  const scenes: CameraSceneBlock[] = [];
  const topLevel: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(settings)) {
    if (isPlainObject(rawValue)) {
      const trimmedKey = rawKey.trim();
      const sceneId =
        SCENE_ALIASES[rawKey] ??
        SCENE_ALIASES[rawKey.toLowerCase()] ??
        (trimmedKey.length > 0 ? trimmedKey : 'scene');
      const rows = rowsFromRecord(rawValue);
      if (rows.length > 0) {
        scenes.push({ id: sceneId, rows });
      }
      continue;
    }
    topLevel[rawKey] = rawValue;
  }

  return {
    scenes,
    rows: rowsFromRecord(topLevel),
  };
}

/**
 * Public field cards are reviewed only (ARCHITECTURE §7 / US-07 AC3).
 * Treat missing reviewer or review date as unpublished — never show the body.
 */
export function isReviewedCard(
  card: SpeciesCardSummary | null | undefined,
): card is SpeciesCardSummary {
  if (card === null || card === undefined) {
    return false;
  }
  if (card.reviewedBy.trim().length === 0) {
    return false;
  }
  if (card.reviewedAt.trim().length === 0) {
    return false;
  }
  if (Number.isNaN(Date.parse(card.reviewedAt))) {
    return false;
  }
  return card.bodyMd.trim().length > 0;
}
