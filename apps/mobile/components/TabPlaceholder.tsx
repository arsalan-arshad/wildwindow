import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';
import { getLayoutDirection } from '@/lib/i18n';

export type TabPlaceholderProps = {
  readonly titleKey: string;
  readonly testID?: string;
};

export function TabPlaceholder({ titleKey, testID }: TabPlaceholderProps) {
  const { t } = useTranslation();
  const direction = getLayoutDirection();

  return (
    <View style={[styles.container, { direction }]} testID={testID}>
      <Text style={styles.title}>{t(titleKey)}</Text>
      <Text style={styles.subtitle}>{t('shell.placeholder')}</Text>
      <Text style={styles.brand}>{t('shell.brand')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { marginTop: 8, opacity: 0.65, fontSize: 16 },
  brand: { marginTop: 16, fontSize: 14, opacity: 0.45, letterSpacing: 0.4 },
});
