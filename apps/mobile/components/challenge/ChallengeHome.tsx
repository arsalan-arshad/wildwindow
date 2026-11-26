import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChallengeGallery } from '@/components/challenge/ChallengeGallery';
import { MarkdownBody } from '@/components/markdown/MarkdownBody';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import {
  formatChallengeDateRange,
  isChallengeOpenForSubmit,
  totalCountryCount,
  type ChallengeSummary,
} from '@/lib/challenge';
import { getLayoutDirection } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences-context';
import { displayCommonName, type SpeciesDetail } from '@/lib/species';
import type { RegionId } from '@/lib/regions';

export type ChallengeHomeProps = {
  /** Override submit navigation in tests. */
  readonly onSubmit?: (slug: string) => void;
  /** Fixed "now" for open-window checks in tests. */
  readonly now?: Date;
};

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if (!('status' in error)) {
    return false;
  }
  return (error as { status: unknown }).status === 404;
}

export function ChallengeHome({ onSubmit, now }: ChallengeHomeProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const api = useApiClient();
  const { region } = usePreferences();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const regionSlug: RegionId = region ?? 'scotland';

  const challengeQuery = useQuery({
    queryKey: ['challenges', 'current'],
    queryFn: async () => {
      const response = await api.challenges.current();
      return response as ChallengeSummary;
    },
  });

  const challenge = challengeQuery.data;
  const speciesQuery = useQuery({
    queryKey: ['species', challenge?.taxonId, regionSlug, 'challenge'],
    enabled: challenge !== undefined,
    queryFn: async () => {
      if (challenge === undefined) {
        throw new Error('challenge required');
      }
      const detail = await api.species.get(challenge.taxonId, { region: regionSlug });
      return detail as SpeciesDetail;
    },
  });

  if (challengeQuery.isLoading) {
    return (
      <View style={styles.centered} testID="challenge-home-loading">
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (challengeQuery.isError) {
    if (isNotFoundError(challengeQuery.error)) {
      return (
        <View style={[styles.centeredPad, { direction }]} testID="challenge-home-empty">
          <Text style={styles.title}>{t('challenge.home.title')}</Text>
          <Text style={[styles.body, { color: muted }]}>{t('challenge.home.none')}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.centeredPad, { direction }]} testID="challenge-home-error">
        <Text style={[styles.body, { color: muted }]}>{t('challenge.home.error')}</Text>
      </View>
    );
  }

  if (challenge === undefined) {
    return (
      <View style={[styles.centeredPad, { direction }]} testID="challenge-home-empty">
        <Text style={styles.title}>{t('challenge.home.title')}</Text>
        <Text style={[styles.body, { color: muted }]}>{t('challenge.home.none')}</Text>
      </View>
    );
  }

  const speciesName =
    speciesQuery.data !== undefined
      ? displayCommonName(speciesQuery.data.commonNames, i18n.language)
      : t('challenge.home.speciesFallback', { id: challenge.taxonId });
  const dateRange = formatChallengeDateRange(challenge.startsOn, challenge.endsOn, i18n.language);
  const total = totalCountryCount(challenge.countryCounts);
  const open = isChallengeOpenForSubmit(challenge, now ?? new Date());

  return (
    <ScrollView
      style={[styles.scroll, { direction }]}
      contentContainerStyle={styles.content}
      testID="challenge-home"
    >
      <Text style={styles.kicker}>{t('challenge.home.kicker')}</Text>
      <Text style={styles.title} testID="challenge-home-title">
        {challenge.title}
      </Text>
      <Text style={[styles.species, { color: muted }]} testID="challenge-home-species">
        {speciesName}
      </Text>
      <Text style={[styles.dates, { color: muted }]} testID="challenge-home-dates">
        {dateRange}
      </Text>

      <View
        style={[styles.counts, { backgroundColor: surface, borderColor: border }]}
        testID="challenge-home-counts"
      >
        <Text style={styles.countsTitle}>{t('challenge.home.countsTitle')}</Text>
        <Text style={[styles.countsTotal, { color: muted }]}>
          {t('challenge.home.countsTotal', { count: total })}
        </Text>
        {challenge.countryCounts.length === 0 ? (
          <Text style={[styles.countRow, { color: muted }]}>{t('challenge.home.countsEmpty')}</Text>
        ) : (
          challenge.countryCounts.map((row) => (
            <View
              key={row.countryCode}
              style={styles.countLine}
              testID={`challenge-count-${row.countryCode}`}
            >
              <Text style={styles.countCode}>{row.countryCode}</Text>
              <Text style={[styles.countValue, { color: muted }]}>
                {t('challenge.home.countValue', { count: row.count })}
              </Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>{t('challenge.home.rulesTitle')}</Text>
      <MarkdownBody source={challenge.rulesMd} testID="challenge-home-rules" />

      <Text style={styles.sectionTitle}>{t('challenge.home.pledgeTitle')}</Text>
      <Text style={[styles.body, { color: muted }]} testID="challenge-home-pledge">
        {t('challenge.home.pledgeBody')}
      </Text>

      {open ? (
        <PrimaryButton
          label={t('challenge.home.submitCta')}
          onPress={() => {
            if (onSubmit !== undefined) {
              onSubmit(challenge.slug);
              return;
            }
            router.push(`/challenge/submit?slug=${encodeURIComponent(challenge.slug)}` as never);
          }}
          testID="challenge-home-submit"
          style={styles.submit}
        />
      ) : (
        <Text style={[styles.closed, { color: muted }]} testID="challenge-home-closed">
          {t('challenge.home.closed')}
        </Text>
      )}

      <ChallengeGallery slug={challenge.slug} countryCounts={challenge.countryCounts} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredPad: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  species: {
    marginTop: 8,
    fontSize: 17,
  },
  dates: {
    marginTop: 4,
    fontSize: 15,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  counts: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  countsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  countsTotal: {
    marginTop: 4,
    fontSize: 14,
    marginBottom: 8,
  },
  countLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  countRow: {
    fontSize: 14,
  },
  countCode: {
    fontSize: 15,
    fontWeight: '600',
  },
  countValue: {
    fontSize: 15,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '700',
  },
  submit: {
    marginTop: 24,
    alignSelf: 'stretch',
  },
  closed: {
    marginTop: 24,
    fontSize: 14,
  },
});
