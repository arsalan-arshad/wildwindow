import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AttributionsList } from '@/components/profile/AttributionsList';
import { Text, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { getLayoutDirection } from '@/lib/i18n';

export type AttributionsViewProps = {
  readonly testID?: string;
};

/** S-17 About data and attributions — loads GET /v1/attributions (T6.12). */
export function AttributionsView({ testID = 'attributions-screen' }: AttributionsViewProps) {
  const { t } = useTranslation();
  const api = useApiClient();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');

  const query = useQuery({
    queryKey: ['attributions'],
    queryFn: async () => api.attributions.list(),
  });

  return (
    <ScrollView
      testID={testID}
      style={{ direction }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>{t('shell.brand')}</Text>
      <Text style={styles.title}>{t('attributions.title')}</Text>
      <Text style={[styles.intro, { color: muted }]}>{t('attributions.intro')}</Text>

      {query.isPending ? (
        <ActivityIndicator color={tint} style={styles.spinner} testID="attributions-loading" />
      ) : null}

      {query.isError ? (
        <Text style={[styles.error, { color: danger }]} testID="attributions-error">
          {t('attributions.loadError')}
        </Text>
      ) : null}

      {query.data !== undefined ? <AttributionsList data={query.data} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  kicker: { fontSize: 13, letterSpacing: 0.4 },
  title: { marginTop: 8, fontSize: 28, fontWeight: '700' },
  intro: { marginTop: 12, fontSize: 15, lineHeight: 22 },
  spinner: { marginTop: 32 },
  error: { marginTop: 24, fontSize: 15 },
});
