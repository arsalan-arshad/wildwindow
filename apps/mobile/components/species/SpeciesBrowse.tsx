import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  type ListRenderItem,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { TierBadge } from '@/components/species/TierBadge';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { getLayoutDirection } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences-context';
import {
  SPECIES_BROWSE_GROUPS,
  displayCommonName,
  isSpeciesBrowseGroup,
  type SpeciesBrowseGroup,
  type SpeciesListItem,
} from '@/lib/species';

const SEARCH_DEBOUNCE_MS = 300;

export type SpeciesBrowseProps = {
  /** Override navigation in tests. */
  readonly onSelectSpecies?: (taxonId: string) => void;
};

export function SpeciesBrowse({ onSelectSpecies }: SpeciesBrowseProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
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
  const [group, setGroup] = useState<SpeciesBrowseGroup | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
    };
  }, [query]);

  const regionSlug = region ?? 'scotland';

  const speciesQuery = useQuery({
    queryKey: ['regions', regionSlug, 'species', debouncedQuery, group],
    queryFn: async () => {
      const response = await api.regions.species(regionSlug, {
        ...(debouncedQuery.length > 0 ? { q: debouncedQuery } : {}),
        ...(group !== null ? { group } : {}),
      });
      return response.species as SpeciesListItem[];
    },
  });

  const filters = useMemo(
    () =>
      ([null, ...SPECIES_BROWSE_GROUPS] as const).map((value) => ({
        value,
        label:
          value === null ? t('species.browse.filters.all') : t(`species.browse.filters.${value}`),
        testID: value === null ? 'species-filter-all' : `species-filter-${value}`,
      })),
    [t],
  );

  const renderItem: ListRenderItem<SpeciesListItem> = ({ item }) => {
    const common = displayCommonName(item.commonNames, i18n.language);
    return (
      <Pressable
        accessibilityRole="button"
        testID={`species-row-${item.taxonId}`}
        onPress={() => {
          if (onSelectSpecies !== undefined) {
            onSelectSpecies(item.taxonId);
            return;
          }
          router.push(`/species/${encodeURIComponent(item.taxonId)}`);
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
        <View style={styles.rowText}>
          <Text style={styles.commonName}>{common}</Text>
          <Text style={[styles.scientific, { color: muted }]}>{item.scientificName}</Text>
        </View>
        <TierBadge tier={item.tier} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { direction }]} testID="species-browse">
      <Text style={styles.heading}>{t('species.browse.title')}</Text>
      <Text style={[styles.subheading, { color: muted }]}>
        {t('species.browse.subtitle', {
          region: t(`regions.${regionSlug}.name`),
        })}
      </Text>

      <TextInput
        testID="species-search"
        value={query}
        onChangeText={setQuery}
        placeholder={t('species.browse.searchPlaceholder')}
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

      <View style={styles.filters} testID="species-filters">
        {filters.map((filter) => {
          const selected = filter.value === null ? group === null : group === filter.value;
          return (
            <Pressable
              key={filter.testID}
              testID={filter.testID}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                if (filter.value === null) {
                  setGroup(null);
                  return;
                }
                if (isSpeciesBrowseGroup(filter.value)) {
                  setGroup(filter.value);
                }
              }}
              style={[
                styles.chip,
                {
                  borderColor: selected ? tint : border,
                  backgroundColor: selected ? tint : surface,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: selected ? '#ffffff' : text }]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {speciesQuery.isLoading ? (
        <View style={styles.centered} testID="species-browse-loading">
          <ActivityIndicator color={tint} />
        </View>
      ) : null}

      {speciesQuery.isError ? (
        <View style={styles.centered} testID="species-browse-error">
          <Text style={{ color: muted }}>{t('species.browse.error')}</Text>
        </View>
      ) : null}

      {speciesQuery.isSuccess ? (
        <FlatList
          data={speciesQuery.data}
          keyExtractor={(item) => item.taxonId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: muted }]} testID="species-browse-empty">
              {t('species.browse.empty')}
            </Text>
          }
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
  },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  commonName: {
    fontSize: 16,
    fontWeight: '600',
  },
  scientific: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  centered: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 15,
  },
});
