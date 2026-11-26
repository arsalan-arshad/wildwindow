import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, useThemeColor } from '@/components/Themed';
import { formatLastUpdated, useIsOnline } from '@/lib/online';

export type LastUpdatedProps = {
  /** From TanStack Query `dataUpdatedAt` (ms since epoch). */
  readonly dataUpdatedAt: number;
};

/**
 * Shows "Last updated …" when the device is offline and cached data is present (T6.13).
 */
export function LastUpdated({ dataUpdatedAt }: LastUpdatedProps) {
  const { t, i18n } = useTranslation();
  const isOnline = useIsOnline();
  const muted = useThemeColor({}, 'textMuted');

  if (isOnline || dataUpdatedAt <= 0) {
    return null;
  }

  const when = formatLastUpdated(dataUpdatedAt, i18n.language);

  return (
    <Text style={[styles.text, { color: muted }]} testID="last-updated">
      {t('offline.lastUpdated', { when })}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});
