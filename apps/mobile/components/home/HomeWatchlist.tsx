import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChallengeBanner } from '@/components/home/ChallengeBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { useAuth } from '@/lib/auth/auth-context';
import {
  forecastStartForRegion,
  mediumDate,
  type ForecastResponse,
  weekScoreDisplay,
  weekdayShort,
} from '@/lib/forecast';
import { getLayoutDirection } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences-context';
import type { RegionId } from '@/lib/regions';
import { displayCommonName, type SpeciesDetail } from '@/lib/species';
import {
  isAtWatchlistLimit,
  WATCHLIST_LIMIT_FREE_DEFAULT,
  type WatchlistItemWire,
  type WatchlistResponseWire,
} from '@/lib/watchlist';

export type HomeWatchlistProps = {
  /** Injected clock for forecast week start (tests). */
  readonly now?: Date;
  readonly onSignIn?: () => void;
  readonly onAdd?: () => void;
  readonly onOpenPair?: (payload: { taxonId: string; cellR7: string }) => void;
  readonly onOpenChallenge?: (slug: string) => void;
};

type PairRowProps = {
  readonly item: WatchlistItemWire;
  readonly region: RegionId;
  readonly now: Date;
  readonly muted: string;
  readonly surface: string;
  readonly border: string;
  readonly tint: string;
  readonly removing: boolean;
  readonly onOpen: () => void;
  readonly onRemove: () => void;
};

function PairRow({
  item,
  region,
  now,
  muted,
  surface,
  border,
  tint,
  removing,
  onOpen,
  onRemove,
}: PairRowProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const start = forecastStartForRegion(region, now);

  const speciesQuery = useQuery({
    queryKey: ['species', item.taxonId, region, 'watchlist'],
    queryFn: async () => {
      const detail = await api.species.get(item.taxonId, { region });
      return detail as SpeciesDetail;
    },
  });

  const forecastQuery = useQuery({
    queryKey: ['forecast', item.taxonId, item.cellR7, start, 'watchlist'],
    queryFn: async () => {
      const response = await api.forecast.get({
        taxonId: item.taxonId,
        cell: item.cellR7,
        start,
      });
      return response as ForecastResponse;
    },
  });

  const common =
    speciesQuery.data !== undefined
      ? displayCommonName(speciesQuery.data.commonNames, i18n.language)
      : t('home.watchlist.taxonFallback', { id: item.taxonId });

  const forecast = forecastQuery.data;
  let scoreLabel = t('home.watchlist.scorePending');
  let bestDayLabel: string | null = null;
  let areaLabel: string | null = null;

  if (forecast?.status === 'ok') {
    const score = weekScoreDisplay(forecast);
    scoreLabel = score.showRange ? score.primary : `${score.primary}/100`;
    bestDayLabel = `${weekdayShort(forecast.bestDay, forecast.timeZone, i18n.language)} · ${mediumDate(forecast.bestDay, forecast.timeZone, i18n.language)}`;
    areaLabel = forecast.areaLabel;
  } else if (forecast !== undefined) {
    scoreLabel =
      forecast.status === 'lockout'
        ? t('home.watchlist.status.lockout')
        : forecast.status === 'not_covered'
          ? t('home.watchlist.status.notCovered')
          : t('home.watchlist.status.unavailable');
    areaLabel = forecast.areaLabel;
  } else if (forecastQuery.isError) {
    scoreLabel = t('home.watchlist.scoreError');
  }

  return (
    <View
      style={[styles.row, { backgroundColor: surface, borderColor: border }]}
      testID={`home-watchlist-row-${item.id}`}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.rowMain}
        testID={`home-watchlist-open-${item.id}`}
      >
        <Text style={styles.rowTitle}>{common}</Text>
        {areaLabel !== null ? (
          <Text style={[styles.rowMeta, { color: muted }]} numberOfLines={1}>
            {areaLabel}
          </Text>
        ) : null}
        <View style={styles.scoreRow}>
          <Text
            style={[styles.scoreValue, { color: tint }]}
            testID={`home-watchlist-score-${item.id}`}
          >
            {scoreLabel}
          </Text>
          {bestDayLabel !== null ? (
            <Text
              style={[styles.bestDay, { color: muted }]}
              testID={`home-watchlist-best-day-${item.id}`}
            >
              {t('home.watchlist.bestDay', { day: bestDayLabel })}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: removing }}
        disabled={removing}
        onPress={onRemove}
        testID={`home-watchlist-remove-${item.id}`}
        style={({ pressed }) => [
          styles.removeBtn,
          { borderColor: border, opacity: removing || pressed ? 0.55 : 1 },
        ]}
      >
        <Text style={styles.removeLabel}>{t('home.watchlist.remove')}</Text>
      </Pressable>
    </View>
  );
}

export function HomeWatchlist({
  now,
  onSignIn,
  onAdd,
  onOpenPair,
  onOpenChallenge,
}: HomeWatchlistProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { status, user } = useAuth();
  const { region } = usePreferences();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');

  const signedIn = status === 'signed_in' && user !== null;
  const regionSlug: RegionId = region ?? 'scotland';
  const clock = now ?? new Date();

  const listQuery = useQuery({
    queryKey: ['me', 'watchlist', user?.uid ?? 'anon'],
    enabled: signedIn,
    queryFn: async () => {
      const response = await api.me.watchlist.list();
      const wire = response as WatchlistResponseWire;
      return {
        items: wire.items,
        limit: wire.limit > 0 ? wire.limit : WATCHLIST_LIMIT_FREE_DEFAULT,
      };
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.me.watchlist.remove(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', 'watchlist'] });
    },
  });

  const goSignIn = () => {
    if (onSignIn !== undefined) {
      onSignIn();
      return;
    }
    router.push('/sign-in');
  };

  const goAdd = () => {
    if (onAdd !== undefined) {
      onAdd();
      return;
    }
    router.push('/(tabs)/explore' as never);
  };

  if (!signedIn) {
    return (
      <ScrollView
        style={[styles.scroll, { direction }]}
        contentContainerStyle={styles.content}
        testID="home-signed-out"
      >
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={[styles.body, { color: muted }]}>{t('home.signInBody')}</Text>
        <PrimaryButton
          label={t('auth.signIn')}
          onPress={goSignIn}
          testID="home-sign-in"
          style={styles.cta}
        />
        <ChallengeBanner
          region={regionSlug}
          {...(onOpenChallenge !== undefined ? { onOpenChallenge } : {})}
        />
      </ScrollView>
    );
  }

  if (listQuery.isLoading) {
    return (
      <View style={[styles.centered, { direction }]} testID="home-loading">
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (listQuery.isError) {
    return (
      <View style={[styles.pad, { direction }]} testID="home-error">
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={[styles.body, { color: muted }]}>{t('home.watchlist.error')}</Text>
        <PrimaryButton
          label={t('shell.errorRetry')}
          onPress={() => {
            void listQuery.refetch();
          }}
          variant="secondary"
          testID="home-retry"
          style={styles.cta}
        />
      </View>
    );
  }

  const items = listQuery.data?.items ?? [];
  const limit = listQuery.data?.limit ?? WATCHLIST_LIMIT_FREE_DEFAULT;
  const atLimit = isAtWatchlistLimit(items.length, limit);

  return (
    <ScrollView
      style={[styles.scroll, { direction }]}
      contentContainerStyle={styles.content}
      testID="home-watchlist"
    >
      <Text style={styles.title}>{t('home.title')}</Text>
      <Text style={[styles.subtitle, { color: muted }]}>{t('home.subtitle')}</Text>

      <ChallengeBanner
        region={regionSlug}
        {...(onOpenChallenge !== undefined ? { onOpenChallenge } : {})}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.watchlist.title')}</Text>
        <Text style={[styles.capacity, { color: muted }]} testID="home-watchlist-capacity">
          {t('home.watchlist.capacity', { count: items.length, limit })}
        </Text>
      </View>

      {atLimit ? (
        <View
          style={[styles.limitBox, { backgroundColor: surface, borderColor: border }]}
          testID="home-watchlist-limit"
        >
          <Text style={styles.limitTitle}>{t('home.watchlist.limitTitle')}</Text>
          <Text style={[styles.limitBody, { color: muted }]}>{t('home.watchlist.limitBody')}</Text>
        </View>
      ) : (
        <PrimaryButton
          label={t('home.watchlist.add')}
          onPress={goAdd}
          testID="home-watchlist-add"
          style={styles.addCta}
        />
      )}

      {items.length === 0 ? (
        <Text style={[styles.empty, { color: muted }]} testID="home-watchlist-empty">
          {t('home.watchlist.empty')}
        </Text>
      ) : (
        <View style={styles.list} testID="home-watchlist-list">
          {items.map((item) => (
            <PairRow
              key={item.id}
              item={item}
              region={regionSlug}
              now={clock}
              muted={muted}
              surface={surface}
              border={border}
              tint={tint}
              removing={removeMutation.isPending && removeMutation.variables === item.id}
              onOpen={() => {
                if (onOpenPair !== undefined) {
                  onOpenPair({ taxonId: item.taxonId, cellR7: item.cellR7 });
                  return;
                }
                router.push(
                  `/forecast?taxonId=${encodeURIComponent(item.taxonId)}&cell=${encodeURIComponent(item.cellR7)}` as never,
                );
              }}
              onRemove={() => {
                removeMutation.mutate(item.id);
              }}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { marginTop: 6, marginBottom: 16, fontSize: 15, lineHeight: 22 },
  body: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  cta: { marginTop: 16, alignSelf: 'stretch', marginBottom: 24 },
  addCta: { marginBottom: 12, alignSelf: 'stretch' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  capacity: { fontSize: 13 },
  limitBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  limitTitle: { fontSize: 16, fontWeight: '700' },
  limitBody: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  empty: { marginTop: 20, fontSize: 15, textAlign: 'center' },
  list: { gap: 10 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  rowMain: { flexGrow: 1 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  rowMeta: { marginTop: 4, fontSize: 13 },
  scoreRow: { marginTop: 10, gap: 4 },
  scoreValue: { fontSize: 22, fontWeight: '700' },
  bestDay: { fontSize: 13 },
  removeBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeLabel: { fontSize: 14, fontWeight: '600' },
});
