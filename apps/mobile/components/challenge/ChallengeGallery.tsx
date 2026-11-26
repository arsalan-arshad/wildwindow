import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  type ListRenderItem,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import type { ChallengeCountryCount, ChallengeEntryPublic } from '@/lib/challenge';

export type ChallengeGalleryProps = {
  readonly slug: string;
  readonly countryCounts: readonly ChallengeCountryCount[];
};

type CountryFilter = 'all' | string;

export function ChallengeGallery({ slug, countryCounts }: ChallengeGalleryProps) {
  const { t } = useTranslation();
  const api = useApiClient();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const [country, setCountry] = useState<CountryFilter>('all');

  const filters = useMemo(() => {
    const chips: { readonly id: CountryFilter; readonly label: string }[] = [
      { id: 'all', label: t('challenge.gallery.allCountries') },
    ];
    for (const row of countryCounts) {
      chips.push({
        id: row.countryCode,
        label: t('challenge.gallery.countryChip', {
          code: row.countryCode,
          count: row.count,
        }),
      });
    }
    return chips;
  }, [countryCounts, t]);

  const entriesQuery = useInfiniteQuery({
    queryKey: ['challenges', slug, 'entries', country],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const response = await api.challenges.entries(slug, {
        ...(country !== 'all' ? { country } : {}),
        ...(pageParam !== undefined ? { cursor: pageParam } : {}),
      });
      return {
        entries: response.entries as ChallengeEntryPublic[],
        nextCursor: response.nextCursor,
      };
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const entries = useMemo(
    () => entriesQuery.data?.pages.flatMap((page) => page.entries) ?? [],
    [entriesQuery.data],
  );

  const renderItem: ListRenderItem<ChallengeEntryPublic> = ({ item }) => (
    <View
      style={[styles.card, { backgroundColor: surface, borderColor: border }]}
      testID={`challenge-gallery-item-${item.id}`}
    >
      <Image
        source={{ uri: item.photoUrl }}
        style={styles.photo}
        accessibilityIgnoresInvertColors
        testID={`challenge-gallery-photo-${item.id}`}
      />
      <Text style={styles.place} testID={`challenge-gallery-place-${item.id}`}>
        {item.regionLabel}
      </Text>
      <Text style={[styles.country, { color: muted }]}>{item.countryCode}</Text>
    </View>
  );

  return (
    <View style={styles.root} testID="challenge-gallery">
      <Text style={styles.title}>{t('challenge.gallery.title')}</Text>
      <Text style={[styles.subtitle, { color: muted }]}>{t('challenge.gallery.subtitle')}</Text>

      <View style={styles.filters} testID="challenge-gallery-filters">
        {filters.map((chip) => {
          const selected = chip.id === country;
          return (
            <Pressable
              key={chip.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`challenge-gallery-filter-${chip.id}`}
              onPress={() => {
                setCountry(chip.id);
              }}
              style={[
                styles.chip,
                {
                  borderColor: selected ? tint : border,
                  backgroundColor: selected ? tint : surface,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: selected ? '#ffffff' : muted }]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {entriesQuery.isLoading ? (
        <View style={styles.centered} testID="challenge-gallery-loading">
          <ActivityIndicator color={tint} />
        </View>
      ) : null}

      {entriesQuery.isError ? (
        <Text style={[styles.empty, { color: muted }]} testID="challenge-gallery-error">
          {t('challenge.gallery.error')}
        </Text>
      ) : null}

      {entriesQuery.isSuccess && entries.length === 0 ? (
        <Text style={[styles.empty, { color: muted }]} testID="challenge-gallery-empty">
          {t('challenge.gallery.empty')}
        </Text>
      ) : null}

      {entries.length > 0 ? (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            entriesQuery.hasNextPage ? (
              <Pressable
                accessibilityRole="button"
                testID="challenge-gallery-more"
                onPress={() => {
                  void entriesQuery.fetchNextPage();
                }}
                disabled={entriesQuery.isFetchingNextPage}
                style={[styles.more, { borderColor: border }]}
              >
                <Text style={{ color: tint }}>
                  {entriesQuery.isFetchingNextPage
                    ? t('challenge.gallery.loadingMore')
                    : t('challenge.gallery.loadMore')}
                </Text>
              </Pressable>
            ) : undefined
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
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
    gap: 10,
    paddingBottom: 8,
  },
  row: {
    gap: 10,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#d5e0d9',
  },
  place: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  country: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 2,
  },
  centered: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  empty: {
    fontSize: 14,
    paddingVertical: 16,
  },
  more: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
