import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View, useThemeColor } from '@/components/Themed';
import { getLayoutDirection } from '@/lib/i18n';

/**
 * S-09 No-Pin Promise explainer — PRD §9.1 public text + §9.2 tiers in plain words.
 * Tier numbers match ARCHITECTURE §5.1 / packages/geoprivacy TIER_POLICY.
 */
const TIER_ROWS = ['open', 'protected', 'highly_protected', 'no_forecast'] as const;

export type NoPinPromiseProps = {
  readonly testID?: string;
};

export function NoPinPromise({ testID = 'no-pin-promise' }: NoPinPromiseProps) {
  const { t } = useTranslation();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const accent = useThemeColor({}, 'accent');

  return (
    <ScrollView testID={testID} style={{ direction }} contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>{t('shell.brand')}</Text>
      <Text style={styles.title}>{t('noPin.title')}</Text>

      <View
        style={[styles.quoteBlock, { borderLeftColor: accent, backgroundColor: surface }]}
        testID="no-pin-pledge"
      >
        <Text style={styles.quoteLead}>{t('noPin.pledgeLead')}</Text>
        <Text style={[styles.quoteBody, { color: muted }]}>{t('noPin.pledgeBody')}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t('noPin.tiersTitle')}</Text>
      <Text style={[styles.sectionIntro, { color: muted }]}>{t('noPin.tiersIntro')}</Text>

      <View style={styles.tierList}>
        {TIER_ROWS.map((tier) => (
          <View
            key={tier}
            testID={`tier-row-${tier}`}
            style={[styles.tierCard, { backgroundColor: surface, borderColor: border }]}
          >
            <Text style={styles.tierName}>{t(`noPin.tiers.${tier}.name`)}</Text>
            <Text style={[styles.tierLine, { color: muted }]}>
              {t(`noPin.tiers.${tier}.resolution`)}
            </Text>
            <Text style={[styles.tierLine, { color: muted }]}>
              {t(`noPin.tiers.${tier}.delay`)}
            </Text>
            <Text style={[styles.tierLine, { color: muted }]}>
              {t(`noPin.tiers.${tier}.minimum`)}
            </Text>
            <Text style={[styles.tierLine, { color: muted }]}>
              {t(`noPin.tiers.${tier}.lockout`)}
            </Text>
            <Text style={[styles.tierExample, { color: muted }]}>
              {t(`noPin.tiers.${tier}.example`)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.footerNote, { color: muted }]}>{t('noPin.openSourceNote')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    opacity: 0.55,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 16,
  },
  quoteBlock: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 28,
    gap: 10,
  },
  quoteLead: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  quoteBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionIntro: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  tierList: { gap: 12 },
  tierCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tierLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  tierExample: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    fontStyle: 'italic',
  },
  footerNote: {
    marginTop: 24,
    fontSize: 14,
    lineHeight: 20,
  },
});
