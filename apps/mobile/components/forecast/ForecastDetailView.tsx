import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LastUpdated } from '@/components/LastUpdated';
import { WatchlistSaveButton } from '@/components/home/WatchlistSaveButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import {
  FACTOR_KEYS,
  findDay,
  formatBlock,
  formatFactorValue,
  formatInterval,
  forecastStartForRegion,
  isNumericFactor,
  lightForDisplayCell,
  mediumDate,
  type FactorKey,
  type ForecastDay,
  type ForecastOk,
  type ForecastResponse,
  weekScoreDisplay,
  weekdayShort,
} from '@/lib/forecast';
import { getLayoutDirection } from '@/lib/i18n';
import { useIsOnline } from '@/lib/online';
import { displayCommonName, type SpeciesDetail } from '@/lib/species';
import type { RegionId } from '@/lib/regions';

export type ForecastDetailViewProps = {
  readonly taxonId: string;
  readonly cell: string;
  readonly region: RegionId;
  /** Injected clock for tests (start date + light). */
  readonly now?: Date;
  /** Override light computation in tests. */
  readonly lightForCell?: typeof lightForDisplayCell;
};

function factorReasonKey(key: FactorKey, value: ForecastDay['factors'][FactorKey]): string {
  if (value === 'not_used') {
    return `forecast.factors.reasons.${key}.notUsed`;
  }
  if (value === 'no_forecast_yet') {
    return `forecast.factors.reasons.${key}.pending`;
  }
  if (typeof value === 'number') {
    if (value >= 0.85) {
      return `forecast.factors.reasons.${key}.high`;
    }
    if (value >= 0.55) {
      return `forecast.factors.reasons.${key}.mid`;
    }
    return `forecast.factors.reasons.${key}.low`;
  }
  return `forecast.factors.reasons.${key}.mid`;
}

export function ForecastDetailView({
  taxonId,
  cell,
  region,
  now,
  lightForCell = lightForDisplayCell,
}: ForecastDetailViewProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const isOnline = useIsOnline();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const accent = useThemeColor({}, 'accent');

  const clock = now ?? new Date();
  const start = forecastStartForRegion(region, clock);

  const forecastQuery = useQuery({
    queryKey: ['forecast', taxonId, cell, start],
    queryFn: async () => {
      const response = await api.forecast.get({ taxonId, cell, start });
      return response as ForecastResponse;
    },
  });

  const speciesQuery = useQuery({
    queryKey: ['species', taxonId, region],
    queryFn: async () => {
      const detail = await api.species.get(taxonId, { region });
      return detail as SpeciesDetail;
    },
  });

  const forecast = forecastQuery.data;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const activeDate = forecast?.status === 'ok' ? (selectedDate ?? forecast.bestDay) : null;

  const activeDay =
    forecast?.status === 'ok' && activeDate !== null
      ? findDay(forecast.days, activeDate)
      : undefined;

  const deviceLight = useMemo(() => {
    if (forecast?.status !== 'ok' || activeDate === null) {
      return null;
    }
    return lightForCell({
      displayCell: forecast.displayCell,
      date: activeDate,
      timeZone: forecast.timeZone,
    });
  }, [forecast, activeDate, lightForCell]);

  if (forecastQuery.isLoading && forecast === undefined) {
    return (
      <View style={styles.centered} testID="forecast-loading">
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (forecast === undefined) {
    return (
      <View style={styles.centered} testID={isOnline ? 'forecast-error' : 'forecast-offline-empty'}>
        <Text style={{ color: muted }}>
          {isOnline ? t('forecast.error') : t('offline.unavailable')}
        </Text>
      </View>
    );
  }

  const common =
    speciesQuery.data !== undefined
      ? displayCommonName(speciesQuery.data.commonNames, i18n.language)
      : null;

  if (forecast.status !== 'ok') {
    return (
      <ScrollView
        style={[styles.scroll, { direction }]}
        contentContainerStyle={styles.content}
        testID={`forecast-status-${forecast.status}`}
      >
        {common !== null ? <Text style={styles.commonName}>{common}</Text> : null}
        {forecast.areaLabel !== null ? (
          <Text style={[styles.areaLabel, { color: muted }]}>{forecast.areaLabel}</Text>
        ) : null}
        <LastUpdated dataUpdatedAt={forecastQuery.dataUpdatedAt} />
        <View
          style={[styles.callout, { backgroundColor: surface, borderColor: border }]}
          testID="forecast-status-callout"
        >
          <Text style={styles.calloutTitle}>
            {forecast.status === 'lockout'
              ? t('forecast.lockout.title')
              : forecast.status === 'not_covered'
                ? t('forecast.notCovered.title')
                : t('forecast.unavailable.title')}
          </Text>
          <Text style={[styles.calloutBody, { color: muted }]}>
            {forecast.status === 'lockout'
              ? (forecast.reason ?? t('forecast.lockout.body'))
              : forecast.status === 'not_covered'
                ? t('forecast.notCovered.body')
                : (forecast.explanations[0] ?? t('forecast.unavailable.body'))}
          </Text>
        </View>
        {forecast.explanations.length > 0 && forecast.status !== 'unavailable' ? (
          <View style={styles.explanations} testID="forecast-status-explanations">
            {forecast.explanations.map((line) => (
              <Text key={line} style={[styles.explanationLine, { color: muted }]}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}
        <WatchlistSaveButton taxonId={taxonId} cellR7={cell} />
      </ScrollView>
    );
  }

  return (
    <OkForecast
      forecast={forecast}
      taxonId={taxonId}
      cell={cell}
      start={start}
      commonName={common}
      activeDate={activeDate ?? forecast.bestDay}
      activeDay={activeDay}
      deviceLight={deviceLight}
      dataUpdatedAt={forecastQuery.dataUpdatedAt}
      muted={muted}
      tint={tint}
      surface={surface}
      border={border}
      accent={accent}
      direction={direction}
      locale={i18n.language}
      onSelectDate={setSelectedDate}
    />
  );
}

type OkForecastProps = {
  readonly forecast: ForecastOk;
  readonly taxonId: string;
  readonly cell: string;
  readonly start: string;
  readonly commonName: string | null;
  readonly activeDate: string;
  readonly activeDay: ForecastDay | undefined;
  readonly deviceLight: ReturnType<typeof lightForDisplayCell>;
  readonly dataUpdatedAt: number;
  readonly muted: string;
  readonly tint: string;
  readonly surface: string;
  readonly border: string;
  readonly accent: string;
  readonly direction: 'ltr' | 'rtl';
  readonly locale: string;
  readonly onSelectDate: (date: string) => void;
};

function OkForecast({
  forecast,
  taxonId,
  cell,
  start,
  commonName,
  activeDate,
  activeDay,
  deviceLight,
  dataUpdatedAt,
  muted,
  tint,
  surface,
  border,
  accent,
  direction,
  locale,
  onSelectDate,
}: OkForecastProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const score = weekScoreDisplay(forecast);
  const bestDay = findDay(forecast.days, forecast.bestDay);
  const dayForFactors = activeDay ?? bestDay;

  return (
    <ScrollView
      style={[styles.scroll, { direction }]}
      contentContainerStyle={styles.content}
      testID="forecast-ok"
    >
      {commonName !== null ? (
        <Text style={styles.commonName} testID="forecast-species-name">
          {commonName}
        </Text>
      ) : null}
      <Text style={[styles.areaLabel, { color: muted }]} testID="forecast-area-label">
        {forecast.areaLabel}
      </Text>

      <LastUpdated dataUpdatedAt={dataUpdatedAt} />

      <WatchlistSaveButton taxonId={taxonId} cellR7={cell} />

      <PrimaryButton
        label={t('share.openForecast')}
        variant="secondary"
        testID="forecast-share-card"
        onPress={() => {
          router.push({
            pathname: '/share',
            params: { kind: 'forecast', taxonId, cell, start },
          });
        }}
      />

      <View style={styles.scoreBlock} testID="forecast-week-score">
        <Text
          style={styles.scoreValue}
          accessibilityLabel={t('forecast.score.a11y', { score: score.primary })}
        >
          {score.primary}
          {score.showRange ? null : <Text style={[styles.scoreOutOf, { color: muted }]}>/100</Text>}
        </Text>
        <Text style={[styles.scoreCaption, { color: muted }]}>{t('forecast.score.label')}</Text>
        <View style={styles.confidenceRow}>
          <View
            style={[styles.confidenceChip, { backgroundColor: surface, borderColor: border }]}
            testID="forecast-confidence"
          >
            <Text style={styles.confidenceText}>
              {t(`forecast.confidence.${forecast.confidence}`)}
            </Text>
          </View>
        </View>
        {score.lowConfidence ? (
          <Text
            style={[styles.lowConfidenceNote, { color: accent }]}
            testID="forecast-low-confidence"
          >
            {t('forecast.score.limitedData')}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('forecast.days.title')}</Text>
        <View style={styles.dayStrip} testID="forecast-day-strip">
          {forecast.days.map((day) => {
            const selected = day.date === activeDate;
            const isBest = day.date === forecast.bestDay;
            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`forecast-day-${day.date}`}
                onPress={() => {
                  onSelectDate(day.date);
                }}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: selected ? tint : surface,
                    borderColor: isBest && !selected ? accent : border,
                    borderWidth: isBest || selected ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.dayWeekday, { color: selected ? '#ffffff' : muted }]}>
                  {weekdayShort(day.date, forecast.timeZone, locale)}
                </Text>
                <Text style={[styles.dayScore, { color: selected ? '#ffffff' : undefined }]}>
                  {day.score}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {dayForFactors !== undefined ? (
        <View
          style={[styles.panel, { backgroundColor: surface, borderColor: border }]}
          testID="forecast-best-block"
        >
          <Text style={styles.panelTitle}>{t('forecast.bestBlock.title')}</Text>
          <Text style={styles.panelValue}>{formatBlock(dayForFactors.bestBlock)}</Text>
          <Text style={[styles.panelMeta, { color: muted }]}>
            {mediumDate(dayForFactors.date, forecast.timeZone, locale)}
            {dayForFactors.date === forecast.bestDay ? ` · ${t('forecast.bestBlock.bestDay')}` : ''}
          </Text>
        </View>
      ) : null}

      <View
        style={[styles.panel, { backgroundColor: surface, borderColor: border }]}
        testID="forecast-light-times"
      >
        <Text style={styles.panelTitle}>{t('forecast.light.title')}</Text>
        <LightRow
          label={t('forecast.light.goldenAm')}
          value={formatInterval(deviceLight?.goldenAm ?? null)}
          muted={muted}
        />
        <LightRow
          label={t('forecast.light.goldenPm')}
          value={formatInterval(deviceLight?.goldenPm ?? null)}
          muted={muted}
        />
        <LightRow
          label={t('forecast.light.blueAm')}
          value={formatInterval(deviceLight?.blueAm ?? null)}
          muted={muted}
        />
        <LightRow
          label={t('forecast.light.bluePm')}
          value={formatInterval(deviceLight?.bluePm ?? null)}
          muted={muted}
        />
        <Text style={[styles.panelMeta, { color: muted }]}>{t('forecast.light.deviceNote')}</Text>
      </View>

      {dayForFactors !== undefined ? (
        <View
          style={[styles.panel, { backgroundColor: surface, borderColor: border }]}
          testID="forecast-weather-tide"
        >
          <Text style={styles.panelTitle}>{t('forecast.conditions.title')}</Text>
          <ConditionRow
            label={t('forecast.factors.weather')}
            value={
              dayForFactors.factors.weather === 'no_forecast_yet'
                ? t('forecast.factors.values.pending')
                : dayForFactors.factors.weather.toFixed(2)
            }
            muted={muted}
          />
          <ConditionRow
            label={t('forecast.factors.tide')}
            value={
              dayForFactors.factors.tide === 'not_used'
                ? t('forecast.factors.values.notUsed')
                : dayForFactors.factors.tide.toFixed(2)
            }
            muted={muted}
          />
        </View>
      ) : null}

      {dayForFactors !== undefined ? (
        <View
          style={[styles.panel, { backgroundColor: surface, borderColor: border }]}
          testID="forecast-breakdown"
        >
          <Text style={styles.panelTitle}>{t('forecast.why.title')}</Text>
          {FACTOR_KEYS.map((key) => {
            const raw = dayForFactors.factors[key];
            const display =
              raw === 'not_used'
                ? t('forecast.factors.values.notUsed')
                : raw === 'no_forecast_yet'
                  ? t('forecast.factors.values.pending')
                  : formatFactorValue(raw);
            return (
              <View key={key} style={styles.factorRow} testID={`forecast-factor-${key}`}>
                <View style={styles.factorHeader}>
                  <Text style={styles.factorName}>{t(`forecast.factors.${key}`)}</Text>
                  <Text style={styles.factorValue}>{display}</Text>
                </View>
                <Text style={[styles.factorReason, { color: muted }]}>
                  {t(factorReasonKey(key, raw))}
                </Text>
                {isNumericFactor(raw) ? (
                  <View style={[styles.factorBarTrack, { backgroundColor: border }]}>
                    <View
                      style={[
                        styles.factorBarFill,
                        { width: `${Math.round(raw * 100)}%`, backgroundColor: tint },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          <Text style={[styles.version, { color: muted }]} testID="forecast-scoring-version">
            {t('forecast.why.version', { version: forecast.scoringVersion })}
          </Text>
        </View>
      ) : null}

      {forecast.explanations.length > 0 ? (
        <View style={styles.explanations} testID="forecast-explanations">
          <Text style={styles.sectionTitle}>{t('forecast.notes.title')}</Text>
          {forecast.explanations.map((line) => (
            <Text key={line} style={[styles.explanationLine, { color: muted }]}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function LightRow({
  label,
  value,
  muted,
}: {
  readonly label: string;
  readonly value: string | null;
  readonly muted: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.conditionRow}>
      <Text style={[styles.conditionLabel, { color: muted }]}>{label}</Text>
      <Text style={styles.conditionValue}>{value ?? t('forecast.light.unavailable')}</Text>
    </View>
  );
}

function ConditionRow({
  label,
  value,
  muted,
}: {
  readonly label: string;
  readonly value: string;
  readonly muted: string;
}) {
  return (
    <View style={styles.conditionRow}>
      <Text style={[styles.conditionLabel, { color: muted }]}>{label}</Text>
      <Text style={styles.conditionValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 14,
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
  areaLabel: {
    fontSize: 15,
    marginTop: -6,
  },
  scoreBlock: {
    gap: 4,
    backgroundColor: 'transparent',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scoreOutOf: {
    fontSize: 22,
    fontWeight: '600',
  },
  scoreCaption: {
    fontSize: 14,
  },
  confidenceRow: {
    flexDirection: 'row',
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  confidenceChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  lowConfidenceNote: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  section: {
    gap: 8,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  dayStrip: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'transparent',
  },
  dayChip: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  dayWeekday: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayScore: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  panel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  panelValue: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  panelMeta: {
    fontSize: 13,
  },
  conditionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  conditionLabel: {
    fontSize: 14,
  },
  conditionValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  factorRow: {
    gap: 4,
    backgroundColor: 'transparent',
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  factorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  factorValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  factorReason: {
    fontSize: 13,
    lineHeight: 18,
  },
  factorBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  factorBarFill: {
    height: 6,
    borderRadius: 3,
  },
  version: {
    fontSize: 12,
    marginTop: 4,
  },
  explanations: {
    gap: 6,
    backgroundColor: 'transparent',
  },
  explanationLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  callout: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  calloutTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  calloutBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
