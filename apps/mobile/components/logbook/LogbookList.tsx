import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  type ListRenderItem,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { useAuth } from '@/lib/auth/auth-context';
import { getLayoutDirection } from '@/lib/i18n';
import { formatCameraSummary, formatTakenAt } from '@/lib/logbook/format';
import { usePreferences } from '@/lib/preferences-context';
import { regionTimeZone } from '@/lib/regions';
import type { LogbookEntryPublic } from '@wildwindow/shared';

export type LogbookListProps = {
  readonly onSelectEntry?: (id: string) => void;
  readonly onAdd?: () => void;
  readonly onSignIn?: () => void;
};

export function LogbookList({ onSelectEntry, onAdd, onSignIn }: LogbookListProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const api = useApiClient();
  const { status, user } = useAuth();
  const { region } = usePreferences();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');

  const signedIn = status === 'signed_in' && user !== null;
  const timeZone = regionTimeZone(region ?? 'scotland');

  const listQuery = useQuery({
    queryKey: ['me', 'logbook', user?.uid ?? 'anon'],
    enabled: signedIn,
    queryFn: async () => {
      const response = await api.me.logbook.list();
      return response.items;
    },
  });

  const goAdd = () => {
    if (onAdd !== undefined) {
      onAdd();
      return;
    }
    router.push('/logbook/new');
  };

  const goSignIn = () => {
    if (onSignIn !== undefined) {
      onSignIn();
      return;
    }
    router.push('/sign-in');
  };

  const renderItem: ListRenderItem<LogbookEntryPublic> = ({ item }) => {
    const camera = formatCameraSummary(item.exif);
    const when = formatTakenAt(item.takenAt, timeZone, i18n.language);
    const speciesLabel =
      item.taxonId !== null
        ? t('logbook.list.taxon', { id: item.taxonId })
        : t('logbook.list.noSpecies');

    return (
      <Pressable
        accessibilityRole="button"
        testID={`logbook-row-${item.id}`}
        onPress={() => {
          if (onSelectEntry !== undefined) {
            onSelectEntry(item.id);
            return;
          }
          router.push(`/logbook/${encodeURIComponent(item.id)}`);
        }}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: surface,
            borderColor: border,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <Text style={styles.rowTitle}>{speciesLabel}</Text>
        <Text style={[styles.rowMeta, { color: muted }]}>{when}</Text>
        {camera.length > 0 ? (
          <Text style={[styles.rowMeta, { color: muted }]} numberOfLines={1}>
            {camera}
          </Text>
        ) : null}
        {item.notes !== null && item.notes.length > 0 ? (
          <Text style={[styles.rowNotes, { color: muted }]} numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  if (!signedIn) {
    return (
      <View style={[styles.container, { direction }]} testID="logbook-signed-out">
        <Text style={styles.title}>{t('logbook.list.title')}</Text>
        <Text style={[styles.body, { color: muted }]}>{t('logbook.list.signInBody')}</Text>
        <PrimaryButton
          label={t('auth.signIn')}
          onPress={goSignIn}
          testID="logbook-sign-in"
          style={styles.cta}
        />
      </View>
    );
  }

  if (listQuery.isLoading) {
    return (
      <View style={[styles.container, styles.centered, { direction }]} testID="logbook-loading">
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (listQuery.isError) {
    return (
      <View style={[styles.container, { direction }]} testID="logbook-error">
        <Text style={styles.title}>{t('logbook.list.title')}</Text>
        <Text style={[styles.body, { color: muted }]}>{t('logbook.list.error')}</Text>
        <PrimaryButton
          label={t('shell.errorRetry')}
          onPress={() => {
            void listQuery.refetch();
          }}
          variant="secondary"
          testID="logbook-retry"
          style={styles.cta}
        />
      </View>
    );
  }

  const items = listQuery.data ?? [];

  return (
    <View style={[styles.container, { direction }]} testID="logbook-list">
      <View style={styles.header}>
        <Text style={styles.title}>{t('logbook.list.title')}</Text>
        <Text style={[styles.body, { color: muted }]}>{t('logbook.list.subtitle')}</Text>
        <PrimaryButton
          label={t('logbook.list.add')}
          onPress={goAdd}
          testID="logbook-add"
          style={styles.cta}
        />
      </View>
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: muted }]} testID="logbook-empty">
          {t('logbook.list.empty')}
        </Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          testID="logbook-flatlist"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  body: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  cta: { marginTop: 16, alignSelf: 'stretch' },
  empty: { marginTop: 32, fontSize: 15, textAlign: 'center' },
  listContent: { paddingBottom: 32, gap: 10 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  rowMeta: { marginTop: 4, fontSize: 13 },
  rowNotes: { marginTop: 6, fontSize: 14, lineHeight: 20 },
});
