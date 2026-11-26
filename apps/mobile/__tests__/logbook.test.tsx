import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { LogbookEntryForm } from '@/components/logbook/LogbookEntryForm';
import { LogbookList } from '@/components/logbook/LogbookList';
import LogbookScreen from '../app/(tabs)/logbook';
import { createMockAuthClient } from '../testing/mock-auth-client';
import { createMockSpeciesApiClient } from '../testing/mock-api-client';
import { renderWithProviders } from '../testing/test-utils';
import type { LogbookEntryOwner, LogbookEntryPublic } from '@wildwindow/shared';
import { containsGpsKey } from '@/lib/logbook/exif';
import type { PreparedLogbookUpload } from '@/lib/logbook/prepare-photo';

const SPECIES = {
  list: [
    {
      taxonId: '2495840',
      scientificName: 'Alcedo atthis',
      commonNames: { en: 'Common kingfisher', ur: 'کinguisher' },
      group: 'bird' as const,
      tier: 'open' as const,
      coastal: true,
      challengeEligible: true,
    },
  ],
  detailById: {},
  seasonalityById: {},
};

const ENTRY: LogbookEntryPublic = {
  id: '10',
  taxonId: '2495840',
  takenAt: '2026-06-15T07:30:00.000Z',
  cellR7: null,
  photoKey: 'uploads/u/a.jpg',
  thumbKey: null,
  exif: { camera: 'Canon EOS R5', shutter: '1/1000', aperture: 'f/5.6', iso: '800' },
  notes: 'Dawn',
  createdAt: '2026-06-15T08:00:00.000Z',
  updatedAt: '2026-06-15T08:00:00.000Z',
};

describe('Logbook screens (T6.9 S-10)', () => {
  it('asks for sign-in when signed out', async () => {
    const view = await renderWithProviders(<LogbookScreen />, {
      authClient: createMockAuthClient({ initialUser: null }),
      apiClient: createMockSpeciesApiClient(SPECIES),
    });

    await waitFor(() => {
      expect(view.getByTestId('logbook-signed-out')).toBeTruthy();
    });
    expect(view.getByTestId('logbook-sign-in')).toBeTruthy();
  });

  it('lists entries for a signed-in user', async () => {
    const apiClient = createMockSpeciesApiClient(SPECIES, {}, {}, { items: [ENTRY] });
    const view = await renderWithProviders(<LogbookList />, {
      authClient: createMockAuthClient({
        initialUser: { uid: 'u1', email: 'ada@example.com', displayName: null },
      }),
      apiClient,
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    });

    await waitFor(() => {
      expect(view.getByTestId('logbook-row-10')).toBeTruthy();
    });
    expect(view.getByText('Dawn')).toBeTruthy();
  });
});

describe('Logbook entry form (T6.9 S-11)', () => {
  it('saves an entry after picking a GPS photo without putting GPS in create exif', async () => {
    const createdBodies: unknown[] = [];
    const prepared: PreparedLogbookUpload = {
      uploadUri: 'file:///stripped.jpg',
      mimeType: 'image/jpeg',
      byteSize: 4,
      blob: new Blob([new Uint8Array([1, 2, 3, 4])]),
      exif: { camera: 'Canon EOS R5', iso: '800' },
      exifRecord: { camera: 'Canon EOS R5', iso: '800' },
      takenAt: '2026-06-15T07:30:00.000Z',
      photoGps: { lat: 55.86, lng: -4.25 },
      suggestedCellR7: '8719582a8ffffff',
    };

    const apiClient = createMockSpeciesApiClient(
      SPECIES,
      {},
      {},
      {
        create: async (body) => {
          createdBodies.push(body);
          const entry: LogbookEntryOwner = {
            id: '99',
            taxonId: body.taxonId ?? null,
            takenAt: body.takenAt,
            cellR7: body.cellR7 ?? null,
            photoKey: body.photoKey,
            thumbKey: null,
            exif: body.exif ?? {},
            notes: body.notes ?? null,
            createdAt: '2026-11-26T12:00:00.000Z',
            updatedAt: '2026-11-26T12:00:00.000Z',
            exactLocation: body.exactLocation ?? null,
          };
          return entry;
        },
      },
    );

    const fetchImpl = jest.fn(async () => new Response(null, { status: 200 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    const onCreated = jest.fn();
    try {
      const view = await renderWithProviders(
        <LogbookEntryForm
          onCreated={onCreated}
          pickImage={async () => ({
            uri: 'file:///with-gps.jpg',
            width: 10,
            height: 10,
            assetId: null,
            fileName: 'with-gps.jpg',
            fileSize: 100,
            type: 'image',
            mimeType: 'image/jpeg',
            exif: {
              Model: 'EOS R5',
              GPSLatitude: 55.86,
              GPSLongitude: -4.25,
            },
          })}
          preparePhoto={async () => prepared}
        />,
        {
          authClient: createMockAuthClient({
            initialUser: { uid: 'u1', email: 'ada@example.com', displayName: null },
          }),
          apiClient,
          initialPreferences: { region: 'scotland', onboardingComplete: true },
        },
      );

      await waitFor(() => {
        expect(view.getByTestId('logbook-form')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(view.getByTestId('logbook-pick-photo'));
      });

      await waitFor(() => {
        expect(view.getByTestId('logbook-preview')).toBeTruthy();
        expect(view.getByTestId('logbook-exact-row')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(view.getByTestId('logbook-species-2495840'));
      });

      await act(async () => {
        fireEvent.changeText(view.getByTestId('logbook-notes'), 'Private dawn shot');
      });

      // Keep exact point OFF (default) — create body must omit exactLocation and GPS in exif.
      await act(async () => {
        fireEvent.press(view.getByTestId('logbook-save'));
      });

      await waitFor(() => {
        expect(onCreated).toHaveBeenCalledWith('99');
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(createdBodies).toHaveLength(1);
    const body = createdBodies[0] as {
      exif: Record<string, unknown>;
      exactLocation?: unknown;
      taxonId?: string;
      notes?: string;
    };
    expect(containsGpsKey(body.exif)).toBe(false);
    expect(body).not.toHaveProperty('exactLocation');
    expect(JSON.stringify(body.exif)).not.toMatch(/GPS|latitude|longitude|"lat"|"lng"/i);
    expect(body.taxonId).toBe('2495840');
    expect(body.notes).toBe('Private dawn shot');
  });
});
