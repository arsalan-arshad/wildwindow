import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  type ListRenderItem,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AreaResponse, PlaceSummary } from '@wildwindow/shared';

import { CoarseCellMap } from '@/components/area/CoarseCellMap';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { saveSelectedCellR7 } from '@/lib/area-selection';
import { useApiClient } from '@/lib/api-context';
import { getLayoutDirection } from '@/lib/i18n';
import {
  resolveMyLocationCell,
  type ForegroundLocationProvider,
  type MyLocationResult,
} from '@/lib/my-location';
import { usePreferences } from '@/lib/preferences-context';
import type { PreferenceStorage } from '@/lib/preferences';

const SEARCH_DEBOUNCE_MS = 300;

export type AreaPickerProps = {
  readonly taxonId?: string;
  /** Injected location provider (tests). */
  readonly locationProvider?: ForegroundLocationProvider;
  /** Injected preference storage (tests). */
  readonly preferenceStorage?: PreferenceStorage;
  /** Called after a cell is chosen (tests / navigation). */
  readonly onAreaChosen?: (payload: { cellR7: string; area: AreaResponse }) => void;
  /** Continue to forecast when taxon + covered area are ready. */
  readonly onContinue?: (payload: { taxonId: string; cellR7: string }) => void;
};

export function AreaPicker({
  taxonId,
  locationProvider,
  preferenceStorage,
  onAreaChosen,
  onContinue,
}: AreaPickerProps) {
  const { t } = useTranslation();
  const api = useApiClient();
  const { region } = usePreferences();
  const direction = getLayoutDirection();

  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCellR7, setSelectedCellR7] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<AreaResponse | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'pending' | 'denied' | 'error'>(
    'idle',
  );
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
    };
  }, [query]);

  const regionSlug = region ?? 'scotland';

  const placesQuery = useQuery({
    queryKey: ['places', regionSlug, debouncedQuery],
    enabled: debouncedQuery.length > 0,
    queryFn: async () => {
      const response = await api.places.search({
        q: debouncedQuery,
        region: regionSlug,
      });
      return response.places as PlaceSummary[];
    },
  });

  async function applyCell(cellR7: string): Promise<AreaResponse> {
    setSelecting(true);
    try {
      if (preferenceStorage !== undefined) {
        await saveSelectedCellR7(cellR7, preferenceStorage);
      } else {
        await saveSelectedCellR7(cellR7);
      }
      const area = (await api.areas.get(cellR7)) as AreaResponse;
      setSelectedCellR7(cellR7);
      setSelectedArea(area);
      onAreaChosen?.({ cellR7, area });
      return area;
    } finally {
      setSelecting(false);
    }
  }

  async function handleUseMyLocation(): Promise<void> {
    setLocationStatus('pending');
    const provider: ForegroundLocationProvider = locationProvider ?? {
      requestForegroundPermissionsAsync: () => Location.requestForegroundPermissionsAsync(),
      getCurrentPositionAsync: () => Location.getCurrentPositionAsync({}),
    };

    const result: MyLocationResult = await resolveMyLocationCell({
      location: provider,
      onCell: async (cellR7) => {
        await applyCell(cellR7);
      },
    });

    if (result.ok) {
      setLocationStatus('idle');
      return;
    }
    setLocationStatus(result.reason === 'denied' ? 'denied' : 'error');
  }

  const renderPlace: ListRenderItem<PlaceSummary> = ({ item }) => (
    <Pressable
      accessibilityRole="button"
      testID={`place-row-${item.id}`}
      onPress={() => {
        void applyCell(item.cellR7);
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: surface,
          borderColor: border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text style={styles.placeName}>{item.name}</Text>
      <Text style={[styles.placeMeta, { color: muted }]}>
        {t(`regions.${item.regionSlug}.name`, { defaultValue: item.regionSlug })}
      </Text>
    </Pressable>
  );

  const covered = selectedArea?.covered === true;
  const canContinue =
    taxonId !== undefined &&
    taxonId.length > 0 &&
    selectedCellR7 !== null &&
    covered &&
    selectedArea !== null;

  return (
    <View style={[styles.root, { direction }]} testID="area-picker">
      <Text style={styles.heading}>{t('area.picker.title')}</Text>
      <Text style={[styles.subheading, { color: muted }]}>{t('area.picker.subtitle')}</Text>

      <TextInput
        testID="area-search"
        value={query}
        onChangeText={setQuery}
        placeholder={t('area.picker.searchPlaceholder')}
        placeholderTextColor={muted}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        style={[
          styles.search,
          {
            color: text,
            backgroundColor: surface,
            borderColor: border,
          },
        ]}
      />

      <PrimaryButton
        label={
          locationStatus === 'pending'
            ? t('area.picker.locating')
            : t('area.picker.useMyLocation')
        }
        testID="area-use-my-location"
        variant="secondary"
        disabled={locationStatus === 'pending' || selecting}
        onPress={() => {
          void handleUseMyLocation();
        }}
        style={styles.locationButton}
      />

      {locationStatus === 'denied' ? (
        <Text style={[styles.status, { color: muted }]} testID="area-location-denied">
          {t('area.picker.locationDenied')}
        </Text>
      ) : null}
      {locationStatus === 'error' ? (
        <Text style={[styles.status, { color: muted }]} testID="area-location-error">
          {t('area.picker.locationError')}
        </Text>
      ) : null}

      <CoarseCellMap cellR7={selectedCellR7} />

      {selecting ? (
        <View style={styles.centered} testID="area-loading">
          <ActivityIndicator color={tint} />
        </View>
      ) : null}

      {selectedArea !== null ? (
        <View
          style={[styles.areaCard, { backgroundColor: surface, borderColor: border }]}
          testID="area-selection"
        >
          <Text style={styles.areaLabel} testID="area-label">
            {selectedArea.label}
          </Text>
          {!selectedArea.covered ? (
            <Text style={[styles.notCovered, { color: muted }]} testID="area-not-covered">
              {t('area.picker.notCovered')}
            </Text>
          ) : (
            <Text style={[styles.covered, { color: muted }]} testID="area-covered">
              {t('area.picker.covered', {
                region: selectedArea.regionSlug
                  ? t(`regions.${selectedArea.regionSlug}.name`, {
                      defaultValue: selectedArea.regionSlug,
                    })
                  : t(`regions.${regionSlug}.name`),
              })}
            </Text>
          )}
        </View>
      ) : null}

      {canContinue ? (
        <PrimaryButton
          label={t('area.picker.continue')}
          testID="area-continue"
          onPress={() => {
            if (taxonId === undefined || selectedCellR7 === null) return;
            onContinue?.({ taxonId, cellR7: selectedCellR7 });
          }}
          style={styles.continueButton}
        />
      ) : null}

      {debouncedQuery.length > 0 ? (
        placesQuery.isLoading ? (
          <View style={styles.centered} testID="area-places-loading">
            <ActivityIndicator color={tint} />
          </View>
        ) : null
      ) : null}

      {debouncedQuery.length > 0 && placesQuery.isError ? (
        <Text style={[styles.status, { color: muted }]} testID="area-places-error">
          {t('area.picker.searchError')}
        </Text>
      ) : null}

      {debouncedQuery.length > 0 && placesQuery.isSuccess ? (
        <FlatList
          data={placesQuery.data}
          keyExtractor={(item) => item.id}
          renderItem={renderPlace}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: muted }]} testID="area-places-empty">
              {t('area.picker.searchEmpty')}
            </Text>
          }
          style={styles.listFlex}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 20,
  },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  locationButton: {
    marginBottom: 12,
  },
  status: {
    fontSize: 13,
    marginBottom: 8,
  },
  centered: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  areaCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 4,
    marginTop: 12,
  },
  areaLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  notCovered: {
    fontSize: 14,
    lineHeight: 20,
  },
  covered: {
    fontSize: 14,
    lineHeight: 20,
  },
  continueButton: {
    marginTop: 12,
  },
  listFlex: {
    flexGrow: 0,
    marginTop: 12,
    maxHeight: 220,
  },
  list: {
    gap: 8,
    paddingBottom: 16,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  placeMeta: {
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 16,
    fontSize: 15,
  },
});
