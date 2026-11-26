import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { useAuth } from '@/lib/auth/auth-context';
import {
  canSubmitChallenge,
  defaultSubmissionLocation,
  filterEligibleLogbookEntries,
  formatTakenAtShort,
  isChallengeOpenForSubmit,
  type ChallengeLogbookCandidate,
  type ChallengeSummary,
} from '@/lib/challenge';
import { getLayoutDirection } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences-context';
import { regionTimeZone } from '@/lib/regions';
import { displayCommonName, type SpeciesDetail } from '@/lib/species';

export type ChallengeSubmitFormProps = {
  readonly slug: string;
  /** Called after a successful submit. */
  readonly onSubmitted?: (entryId: string) => void;
  readonly onSignIn?: () => void;
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

export function ChallengeSubmitForm({
  slug,
  onSubmitted,
  onSignIn,
  now,
}: ChallengeSubmitFormProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { status, user } = useAuth();
  const { region } = usePreferences();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');
  const text = useThemeColor({}, 'text');

  const signedIn = status === 'signed_in' && user !== null;
  const location = defaultSubmissionLocation(region);
  const timeZone = regionTimeZone(region ?? 'scotland');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pledgeAccepted, setPledgeAccepted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const challengeQuery = useQuery({
    queryKey: ['challenges', slug],
    queryFn: async () => {
      const response = await api.challenges.get(slug);
      return response as ChallengeSummary;
    },
  });

  const challenge = challengeQuery.data;

  const speciesQuery = useQuery({
    queryKey: ['species', challenge?.taxonId, region ?? 'scotland', 'challenge-submit'],
    enabled: challenge !== undefined,
    queryFn: async () => {
      if (challenge === undefined) {
        throw new Error('challenge required');
      }
      const detail = await api.species.get(challenge.taxonId, {
        region: region ?? 'scotland',
      });
      return detail as SpeciesDetail;
    },
  });

  const logbookQuery = useQuery({
    queryKey: ['me', 'logbook', user?.uid ?? 'anon', 'challenge-submit'],
    enabled: signedIn && challenge !== undefined,
    queryFn: async () => {
      const response = await api.me.logbook.list();
      return response.items as ChallengeLogbookCandidate[];
    },
  });

  const eligible = useMemo(() => {
    if (challenge === undefined || logbookQuery.data === undefined) {
      return [];
    }
    return filterEligibleLogbookEntries(logbookQuery.data, challenge.taxonId);
  }, [challenge, logbookQuery.data]);

  // Wrong-species (and null-taxon) rows stay out of the picker entirely.
  const ineligibleCount = useMemo(() => {
    if (logbookQuery.data === undefined || challenge === undefined) {
      return 0;
    }
    return logbookQuery.data.length - eligible.length;
  }, [logbookQuery.data, eligible.length, challenge]);

  const submitEnabled = canSubmitChallenge({
    pledgeAccepted,
    logbookEntryId: selectedId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (challenge === undefined || selectedId === null) {
        throw new Error('missing selection');
      }
      return api.challenges.submit(challenge.slug, {
        logbookEntryId: selectedId,
        pledgeAccepted: true as const,
        countryCode: location.countryCode,
        regionLabel: location.regionLabel,
      });
    },
    onSuccess: (result) => {
      setSubmitError(null);
      void queryClient.invalidateQueries({ queryKey: ['challenges'] });
      onSubmitted?.(result.id);
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
          ? (error as { message: string }).message
          : t('challenge.submit.error');
      setSubmitError(message);
    },
  });

  if (challengeQuery.isLoading) {
    return (
      <View style={styles.centered} testID="challenge-submit-loading">
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (challengeQuery.isError || challenge === undefined) {
    return (
      <View style={[styles.centeredPad, { direction }]} testID="challenge-submit-error">
        <Text style={{ color: muted }}>
          {isNotFoundError(challengeQuery.error)
            ? t('challenge.submit.missing')
            : t('challenge.submit.error')}
        </Text>
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={[styles.centeredPad, { direction }]} testID="challenge-submit-signed-out">
        <Text style={styles.title}>{t('challenge.submit.title')}</Text>
        <Text style={[styles.body, { color: muted }]}>{t('challenge.submit.signInBody')}</Text>
        <PrimaryButton
          label={t('auth.signIn')}
          onPress={() => {
            onSignIn?.();
          }}
          testID="challenge-submit-sign-in"
          style={styles.cta}
        />
      </View>
    );
  }

  const open = isChallengeOpenForSubmit(challenge, now ?? new Date());
  const speciesName =
    speciesQuery.data !== undefined
      ? displayCommonName(speciesQuery.data.commonNames, i18n.language)
      : t('challenge.home.speciesFallback', { id: challenge.taxonId });

  return (
    <ScrollView
      style={[styles.scroll, { direction }]}
      contentContainerStyle={styles.content}
      testID="challenge-submit"
    >
      <Text style={styles.title}>{t('challenge.submit.title')}</Text>
      <Text style={[styles.body, { color: muted }]} testID="challenge-submit-species">
        {t('challenge.submit.speciesHint', { species: speciesName })}
      </Text>
      <Text style={[styles.meta, { color: muted }]} testID="challenge-submit-location">
        {t('challenge.submit.locationHint', {
          region: location.regionLabel,
          country: location.countryCode,
        })}
      </Text>

      {!open ? (
        <Text style={[styles.body, { color: danger }]} testID="challenge-submit-closed">
          {t('challenge.submit.closed')}
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>{t('challenge.submit.pickEntry')}</Text>

      {logbookQuery.isLoading ? (
        <View style={styles.centeredInline} testID="challenge-submit-logbook-loading">
          <ActivityIndicator color={tint} />
        </View>
      ) : null}

      {logbookQuery.isError ? (
        <Text style={{ color: muted }} testID="challenge-submit-logbook-error">
          {t('challenge.submit.logbookError')}
        </Text>
      ) : null}

      {logbookQuery.isSuccess && eligible.length === 0 ? (
        <Text style={[styles.body, { color: muted }]} testID="challenge-submit-no-eligible">
          {t('challenge.submit.noEligible', { species: speciesName })}
        </Text>
      ) : null}

      {ineligibleCount > 0 ? (
        <Text style={[styles.meta, { color: muted }]} testID="challenge-submit-filtered">
          {t('challenge.submit.filteredOut', { count: ineligibleCount })}
        </Text>
      ) : null}

      <View style={styles.list} testID="challenge-submit-entries">
        {eligible.map((entry) => {
          const selected = selectedId === entry.id;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`challenge-submit-entry-${entry.id}`}
              onPress={() => {
                setSelectedId(entry.id);
              }}
              style={[
                styles.entry,
                {
                  backgroundColor: surface,
                  borderColor: selected ? tint : border,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
            >
              <Text style={styles.entryTitle}>
                {formatTakenAtShort(entry.takenAt, timeZone, i18n.language)}
              </Text>
              {entry.notes !== null && entry.notes.length > 0 ? (
                <Text style={[styles.entryNotes, { color: muted }]} numberOfLines={2}>
                  {entry.notes}
                </Text>
              ) : (
                <Text style={[styles.entryNotes, { color: muted }]}>
                  {t('challenge.submit.noNotes')}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: pledgeAccepted }}
        testID="challenge-submit-pledge"
        onPress={() => {
          setPledgeAccepted((prev) => !prev);
        }}
        style={[styles.pledgeRow, { borderColor: border, backgroundColor: surface }]}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: pledgeAccepted ? tint : border,
              backgroundColor: pledgeAccepted ? tint : 'transparent',
            },
          ]}
          testID="challenge-submit-pledge-box"
        >
          {pledgeAccepted ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <Text style={[styles.pledgeText, { color: text }]}>{t('challenge.submit.pledge')}</Text>
      </Pressable>

      <PrimaryButton
        label={
          submitMutation.isPending ? t('challenge.submit.working') : t('challenge.submit.submit')
        }
        onPress={() => {
          if (!submitEnabled || !open) {
            return;
          }
          setSubmitError(null);
          submitMutation.mutate();
        }}
        disabled={!submitEnabled || !open || submitMutation.isPending}
        testID="challenge-submit-button"
        style={styles.cta}
      />

      {submitError !== null ? (
        <Text style={[styles.error, { color: danger }]} testID="challenge-submit-error-msg">
          {submitError}
        </Text>
      ) : null}

      {submitMutation.isSuccess ? (
        <Text style={[styles.success, { color: muted }]} testID="challenge-submit-success">
          {t('challenge.submit.success')}
        </Text>
      ) : null}
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
  centeredInline: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  body: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '700',
  },
  list: {
    gap: 10,
  },
  entry: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  entryNotes: {
    marginTop: 4,
    fontSize: 13,
  },
  pledgeRow: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  pledgeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    marginTop: 20,
    alignSelf: 'stretch',
  },
  error: {
    marginTop: 12,
    fontSize: 14,
  },
  success: {
    marginTop: 12,
    fontSize: 14,
  },
});
