import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { type ChallengeSummary } from '@/lib/challenge';
import { displayCommonName, type SpeciesDetail } from '@/lib/species';
import type { RegionId } from '@/lib/regions';

export type ChallengeBannerProps = {
  readonly region: RegionId;
  /** Override navigation in tests. */
  readonly onOpenChallenge?: (slug: string) => void;
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

export function ChallengeBanner({ region, onOpenChallenge }: ChallengeBannerProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const api = useApiClient();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');

  const challengeQuery = useQuery({
    queryKey: ['challenges', 'current'],
    queryFn: async () => {
      const response = await api.challenges.current();
      return response as ChallengeSummary;
    },
  });

  const challenge = challengeQuery.data;

  const speciesQuery = useQuery({
    queryKey: ['species', challenge?.taxonId, region, 'banner'],
    enabled: challenge !== undefined,
    queryFn: async () => {
      if (challenge === undefined) {
        throw new Error('challenge required');
      }
      const detail = await api.species.get(challenge.taxonId, { region });
      return detail as SpeciesDetail;
    },
  });

  if (challengeQuery.isLoading) {
    return (
      <View
        style={[styles.banner, { backgroundColor: surface, borderColor: border }]}
        testID="home-challenge-banner-loading"
      >
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (challengeQuery.isError) {
    if (isNotFoundError(challengeQuery.error)) {
      return null;
    }
    return null;
  }

  if (challenge === undefined) {
    return null;
  }

  const speciesName =
    speciesQuery.data !== undefined
      ? displayCommonName(speciesQuery.data.commonNames, i18n.language)
      : t('home.challenge.speciesFallback', { id: challenge.taxonId });

  const open = () => {
    if (onOpenChallenge !== undefined) {
      onOpenChallenge(challenge.slug);
      return;
    }
    router.push('/(tabs)/challenge' as never);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      testID="home-challenge-banner"
      style={({ pressed }) => [
        styles.banner,
        {
          backgroundColor: surface,
          borderColor: border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text style={[styles.kicker, { color: tint }]}>{t('home.challenge.kicker')}</Text>
      <Text style={styles.title} testID="home-challenge-banner-title">
        {challenge.title}
      </Text>
      <Text style={[styles.species, { color: muted }]} testID="home-challenge-banner-species">
        {speciesName}
      </Text>
      <Text style={[styles.cta, { color: tint }]}>{t('home.challenge.open')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
  },
  species: {
    marginTop: 4,
    fontSize: 14,
  },
  cta: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
});
