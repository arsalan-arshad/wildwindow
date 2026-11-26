import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { getLayoutDirection } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences-context';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const { region } = usePreferences();

  const regionLabel =
    region === 'scotland'
      ? t('regions.scotland.name')
      : region === 'sindh'
        ? t('regions.sindh.name')
        : '—';

  return (
    <View style={[styles.container, { direction }]} testID="tab-profile">
      <Text style={styles.title}>{t('tabs.profile')}</Text>
      <Text style={[styles.meta, { color: muted }]}>
        {t('profile.regionLabel')}: {regionLabel}
      </Text>
      <PrimaryButton
        label={t('profile.noPinLink')}
        onPress={() => {
          router.push('/no-pin');
        }}
        variant="secondary"
        testID="profile-nopin-link"
        style={styles.link}
      />
      <Text style={[styles.brand, { color: muted }]}>{t('shell.brand')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '700' },
  meta: { marginTop: 12, fontSize: 16 },
  link: { marginTop: 24, alignSelf: 'stretch' },
  brand: { marginTop: 32, fontSize: 14, letterSpacing: 0.4 },
});
