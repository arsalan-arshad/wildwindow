import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SeasonalityChart } from '@/components/species/SeasonalityChart';
import { TierBadge } from '@/components/species/TierBadge';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { isReviewedCard } from '@/lib/field-card';
import { getLayoutDirection } from '@/lib/i18n';
import {
  canRequestForecast,
  displayCommonName,
  formatReviewedAt,
  type SeasonalityResponse,
  type SpeciesDetail,
} from '@/lib/species';
import type { RegionId } from '@/lib/regions';

export type SpeciesDetailViewProps = {
  readonly taxonId: string;
  readonly region: RegionId;
  /** Override forecast CTA in tests. */
  readonly onGetForecast?: (taxonId: string) => void;
  /** Open the full field card (S-08). */
  readonly onOpenFieldCard?: (taxonId: string) => void;
};

export function SpeciesDetailView({
  taxonId,
  region,
  onGetForecast,
  onOpenFieldCard,
}: SpeciesDetailViewProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');

  const detailQuery = useQuery({
    queryKey: ['species', taxonId, region],
    queryFn: async () => {
      const detail = await api.species.get(taxonId, { region });
      return detail as SpeciesDetail;
    },
  });

  const seasonalityQuery = useQuery({
    queryKey: ['species', taxonId, region, 'seasonality'],
    queryFn: async () => {
      const seasonality = await api.species.seasonality(taxonId, { region });
      return seasonality as SeasonalityResponse;
    },
  });

  if (detailQuery.isLoading) {
    return (
      <View style={styles.centered} testID="species-detail-loading">
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (detailQuery.isError || detailQuery.data === undefined) {
    return (
      <View style={styles.centered} testID="species-detail-error">
        <Text style={{ color: muted }}>{t('species.detail.error')}</Text>
      </View>
    );
  }

  const detail = detailQuery.data;
  const common = displayCommonName(detail.commonNames, i18n.language);
  const showForecast = canRequestForecast(detail.tier);

  return (
    <ScrollView
      style={[styles.scroll, { direction }]}
      contentContainerStyle={styles.content}
      testID="species-detail"
    >
      <Text style={styles.commonName} testID="species-detail-name">
        {common}
      </Text>
      <Text style={[styles.scientific, { color: muted }]}>{detail.scientificName}</Text>

      <View style={styles.badgeRow}>
        <TierBadge tier={detail.tier} />
        <Text style={[styles.group, { color: muted }]}>
          {t(`species.groups.${detail.group}`, { defaultValue: detail.group })}
        </Text>
      </View>

      {detail.tier === 'no_forecast' ? (
        <View
          style={[styles.callout, { backgroundColor: surface, borderColor: border }]}
          testID="species-no-forecast-explanation"
        >
          <Text style={styles.calloutTitle}>{t('species.detail.noForecastTitle')}</Text>
          <Text style={[styles.calloutBody, { color: muted }]}>
            {t('species.detail.noForecastBody')}
          </Text>
        </View>
      ) : null}

      {seasonalityQuery.isLoading ? (
        <View style={styles.chartLoading} testID="species-seasonality-loading">
          <ActivityIndicator color={tint} />
        </View>
      ) : null}

      {seasonalityQuery.isSuccess ? <SeasonalityChart weeks={seasonalityQuery.data.weeks} /> : null}

      {seasonalityQuery.isError ? (
        <Text style={[styles.chartError, { color: muted }]} testID="species-seasonality-error">
          {t('species.detail.seasonalityError')}
        </Text>
      ) : null}

      {isReviewedCard(detail.card) ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onOpenFieldCard?.(taxonId);
          }}
          style={[styles.cardSummary, { backgroundColor: surface, borderColor: border }]}
          testID="species-field-card-summary"
        >
          <Text style={styles.cardTitle}>{t('species.detail.fieldCardTitle')}</Text>
          <Text style={[styles.cardBody, { color: muted }]}>
            {t('species.detail.fieldCardReady')}
          </Text>
          <Text style={styles.reviewed} testID="species-card-reviewed">
            {t('species.detail.reviewedBy', {
              name: detail.card.reviewedBy,
              date: formatReviewedAt(detail.card.reviewedAt, i18n.language),
            })}
          </Text>
          <Text style={[styles.openCard, { color: tint }]} testID="species-open-field-card">
            {t('species.detail.openFieldCard')}
          </Text>
        </Pressable>
      ) : (
        <View
          style={[styles.cardSummary, { backgroundColor: surface, borderColor: border }]}
          testID="species-field-card-summary"
        >
          <Text style={styles.cardTitle}>{t('species.detail.fieldCardTitle')}</Text>
          <Text style={[styles.cardBody, { color: muted }]} testID="species-card-missing">
            {t('species.detail.fieldCardMissing')}
          </Text>
        </View>
      )}

      {showForecast ? (
        <PrimaryButton
          label={t('species.detail.getForecast')}
          testID="species-get-forecast"
          onPress={() => {
            onGetForecast?.(taxonId);
          }}
          style={styles.forecastCta}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  commonName: {
    fontSize: 26,
    fontWeight: '700',
  },
  scientific: {
    fontSize: 15,
    fontStyle: 'italic',
    marginTop: -4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  group: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  callout: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  calloutBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  chartLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  chartError: {
    fontSize: 14,
  },
  cardSummary: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  reviewed: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  openCard: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  forecastCta: {
    marginTop: 8,
  },
});
