import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { getLayoutDirection } from '@/lib/i18n';
import { BETA_REGIONS } from '@/lib/preferences';
import type { RegionId } from '@/lib/regions';

export const ONBOARDING_STEP_COUNT = 3;

export type OnboardingFlowProps = {
  readonly onComplete: (region: RegionId) => void | Promise<void>;
  readonly onOpenNoPin: () => void;
  /** Controlled step for tests; omit for internal state. */
  readonly step?: number;
  readonly onStepChange?: (step: number) => void;
};

export function OnboardingFlow({
  onComplete,
  onOpenNoPin,
  step: controlledStep,
  onStepChange,
}: OnboardingFlowProps) {
  const { t } = useTranslation();
  const direction = getLayoutDirection();
  const [internalStep, setInternalStep] = useState(0);
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');

  const isControlled = controlledStep !== undefined;
  const step = isControlled ? controlledStep : internalStep;

  function goTo(next: number) {
    if (!isControlled) {
      setInternalStep(next);
    }
    onStepChange?.(next);
  }

  return (
    <View style={[styles.root, { direction }]} testID="onboarding-flow">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>{t('shell.brand')}</Text>
        <Text style={[styles.progress, { color: muted }]}>
          {t('onboarding.progress', { current: step + 1, total: ONBOARDING_STEP_COUNT })}
        </Text>

        {step === 0 ? (
          <View style={styles.card} testID="onboarding-card-what">
            <Text style={styles.title}>{t('onboarding.what.title')}</Text>
            <Text style={[styles.body, { color: muted }]}>{t('onboarding.what.body')}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.card} testID="onboarding-card-nopin">
            <Text style={styles.title}>{t('onboarding.noPin.title')}</Text>
            <Text style={[styles.body, { color: muted }]}>{t('onboarding.noPin.body')}</Text>
            <PrimaryButton
              label={t('onboarding.noPin.readFull')}
              onPress={onOpenNoPin}
              variant="secondary"
              testID="onboarding-open-nopin"
              style={styles.secondaryCta}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.card} testID="onboarding-card-region">
            <Text style={styles.title}>{t('onboarding.region.title')}</Text>
            <Text style={[styles.body, { color: muted }]}>{t('onboarding.region.body')}</Text>
            <View style={styles.regionList}>
              {BETA_REGIONS.map((region) => {
                const selected = selectedRegion === region.id;
                return (
                  <Pressable
                    key={region.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`region-option-${region.id}`}
                    onPress={() => {
                      setSelectedRegion(region.id);
                    }}
                    style={[
                      styles.regionOption,
                      {
                        backgroundColor: surface,
                        borderColor: selected ? tint : border,
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.regionName}>{t(region.nameKey)}</Text>
                    <Text style={[styles.regionBlurb, { color: muted }]}>{t(region.blurbKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: border }]}>
        {step > 0 ? (
          <PrimaryButton
            label={t('onboarding.back')}
            onPress={() => {
              goTo(step - 1);
            }}
            variant="secondary"
            testID="onboarding-back"
            style={styles.footerSecondary}
          />
        ) : (
          <View style={styles.footerSecondary} />
        )}
        {step < ONBOARDING_STEP_COUNT - 1 ? (
          <PrimaryButton
            label={t('onboarding.continue')}
            onPress={() => {
              goTo(step + 1);
            }}
            testID="onboarding-continue"
            style={styles.footerPrimary}
          />
        ) : (
          <PrimaryButton
            label={t('onboarding.getStarted')}
            onPress={() => {
              if (selectedRegion !== null) {
                void Promise.resolve(onComplete(selectedRegion));
              }
            }}
            disabled={selectedRegion === null}
            testID="onboarding-finish"
            style={styles.footerPrimary}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    flexGrow: 1,
  },
  brand: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.6,
    opacity: 0.55,
    marginBottom: 8,
  },
  progress: {
    fontSize: 13,
    marginBottom: 20,
  },
  card: { gap: 12 },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  body: { fontSize: 17, lineHeight: 26 },
  secondaryCta: { marginTop: 8, alignSelf: 'stretch' },
  regionList: { marginTop: 8, gap: 12 },
  regionOption: {
    borderRadius: 12,
    padding: 16,
  },
  regionName: { fontSize: 18, fontWeight: '700' },
  regionBlurb: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerSecondary: { flex: 1 },
  footerPrimary: { flex: 1.4 },
});
