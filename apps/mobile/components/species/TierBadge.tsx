import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View, useThemeColor } from '@/components/Themed';
import { palette } from '@/constants/Colors';
import type { SensitivityTier } from '@/lib/species';

export type TierBadgeProps = {
  readonly tier: SensitivityTier;
  readonly testID?: string;
};

const TIER_ACCENT: Record<SensitivityTier, string> = {
  open: palette.moss,
  protected: palette.amber,
  highly_protected: '#9a4a1a',
  no_forecast: palette.danger,
};

export function TierBadge({ tier, testID }: TierBadgeProps) {
  const { t } = useTranslation();
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const accent = TIER_ACCENT[tier];

  return (
    <View
      accessibilityRole="text"
      testID={testID ?? `tier-badge-${tier}`}
      style={[
        styles.badge,
        {
          backgroundColor: surface,
          borderColor: border,
          borderLeftColor: accent,
        },
      ]}
    >
      <Text style={[styles.label, { color: accent }]}>{t(`noPin.tiers.${tier}.name`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
