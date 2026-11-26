import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LastUpdated } from '@/components/LastUpdated';
import { MarkdownBody } from '@/components/markdown/MarkdownBody';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { isReviewedCard, parseCardSettings } from '@/lib/field-card';
import { getLayoutDirection } from '@/lib/i18n';
import { useIsOnline } from '@/lib/online';
import type { RegionId } from '@/lib/regions';
import { displayCommonName, formatReviewedAt, type SpeciesDetail } from '@/lib/species';

export type FieldCardViewProps = {
  readonly taxonId: string;
  readonly region: RegionId;
};

export function FieldCardView({ taxonId, region }: FieldCardViewProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const isOnline = useIsOnline();
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

  if (detailQuery.isLoading && detailQuery.data === undefined) {
    return (
      <View style={styles.centered} testID="field-card-loading">
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (detailQuery.data === undefined) {
    return (
      <View
        style={styles.centered}
        testID={isOnline ? 'field-card-error' : 'field-card-offline-empty'}
      >
        <Text style={{ color: muted }}>
          {isOnline ? t('species.fieldCard.error') : t('offline.unavailable')}
        </Text>
      </View>
    );
  }

  const detail = detailQuery.data;
  const common = displayCommonName(detail.commonNames, i18n.language);
  const card = detail.card;

  // US-07 AC3 / T6.6: never show card body without a review.
  if (!isReviewedCard(card)) {
    return (
      <ScrollView
        style={[styles.scroll, { direction }]}
        contentContainerStyle={styles.content}
        testID="field-card-missing"
      >
        <Text style={styles.title}>{common}</Text>
        <Text style={[styles.scientific, { color: muted }]}>{detail.scientificName}</Text>
        <LastUpdated dataUpdatedAt={detailQuery.dataUpdatedAt} />
        <View
          style={[styles.section, { backgroundColor: surface, borderColor: border }]}
          testID="field-card-unpublished"
        >
          <Text style={styles.sectionTitle}>{t('species.fieldCard.unpublishedTitle')}</Text>
          <Text style={[styles.sectionBody, { color: muted }]}>
            {t('species.fieldCard.unpublishedBody')}
          </Text>
        </View>
      </ScrollView>
    );
  }

  const parsed = parseCardSettings(card.settings);
  const hasSettings = parsed.scenes.length > 0 || parsed.rows.length > 0;

  return (
    <ScrollView
      style={[styles.scroll, { direction }]}
      contentContainerStyle={styles.content}
      testID="field-card"
    >
      <Text style={styles.title} testID="field-card-name">
        {common}
      </Text>
      <Text style={[styles.scientific, { color: muted }]}>{detail.scientificName}</Text>

      <Text style={[styles.reviewed, { color: muted }]} testID="field-card-reviewed">
        {t('species.detail.reviewedBy', {
          name: card.reviewedBy,
          date: formatReviewedAt(card.reviewedAt, i18n.language),
        })}
      </Text>

      <LastUpdated dataUpdatedAt={detailQuery.dataUpdatedAt} />

      {hasSettings ? (
        <View
          style={[styles.section, { backgroundColor: surface, borderColor: border }]}
          testID="field-card-settings"
        >
          <Text style={styles.sectionTitle}>{t('species.fieldCard.settingsTitle')}</Text>
          {parsed.rows.map((row) => (
            <View
              key={`flat-${row.key}`}
              style={styles.settingRow}
              testID={`setting-row-${row.key}`}
            >
              <Text style={[styles.settingKey, { color: muted }]}>
                {t(`species.fieldCard.settingsKeys.${row.key}`, { defaultValue: row.key })}
              </Text>
              <Text style={styles.settingValue}>{row.value}</Text>
            </View>
          ))}
          {parsed.scenes.map((scene) => (
            <View key={scene.id} style={styles.scene} testID={`setting-scene-${scene.id}`}>
              <Text style={styles.sceneTitle}>
                {t(`species.fieldCard.scenes.${scene.id}`, { defaultValue: scene.id })}
              </Text>
              {scene.rows.map((row) => (
                <View
                  key={`${scene.id}-${row.key}`}
                  style={styles.settingRow}
                  testID={`setting-row-${scene.id}-${row.key}`}
                >
                  <Text style={[styles.settingKey, { color: muted }]}>
                    {t(`species.fieldCard.settingsKeys.${row.key}`, { defaultValue: row.key })}
                  </Text>
                  <Text style={styles.settingValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      <View
        style={[styles.section, { backgroundColor: surface, borderColor: border }]}
        testID="field-card-fieldcraft"
      >
        <Text style={styles.sectionTitle}>{t('species.fieldCard.fieldcraftTitle')}</Text>
        <MarkdownBody source={card.bodyMd} testID="field-card-body-md" />
      </View>

      {card.ethicsMd !== null && card.ethicsMd.trim().length > 0 ? (
        <View
          style={[styles.section, { backgroundColor: surface, borderColor: border }]}
          testID="field-card-ethics"
        >
          <Text style={styles.sectionTitle}>{t('species.fieldCard.ethicsTitle')}</Text>
          <MarkdownBody source={card.ethicsMd} testID="field-card-ethics-md" />
        </View>
      ) : null}

      {card.legalMd !== null && card.legalMd.trim().length > 0 ? (
        <View
          style={[styles.section, { backgroundColor: surface, borderColor: border }]}
          testID="field-card-legal"
        >
          <Text style={styles.sectionTitle}>{t('species.fieldCard.legalTitle')}</Text>
          <MarkdownBody source={card.legalMd} testID="field-card-legal-md" />
        </View>
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
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  scientific: {
    fontSize: 15,
    fontStyle: 'italic',
    marginTop: -6,
  },
  reviewed: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  scene: {
    gap: 6,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  sceneTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'transparent',
  },
  settingKey: {
    fontSize: 14,
    flexShrink: 1,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
});
