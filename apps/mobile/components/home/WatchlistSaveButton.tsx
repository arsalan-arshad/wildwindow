import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { useAuth } from '@/lib/auth/auth-context';
import {
  findWatchlistItem,
  isAtWatchlistLimit,
  isWatchlistLimitError,
  WATCHLIST_LIMIT_FREE_DEFAULT,
  type WatchlistResponseWire,
} from '@/lib/watchlist';

export type WatchlistSaveButtonProps = {
  readonly taxonId: string;
  readonly cellR7: string;
  readonly onSignIn?: () => void;
};

export function WatchlistSaveButton({ taxonId, cellR7, onSignIn }: WatchlistSaveButtonProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { status, user } = useAuth();
  const muted = useThemeColor({}, 'textMuted');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const [limitVisible, setLimitVisible] = useState(false);

  const signedIn = status === 'signed_in' && user !== null;

  const listQuery = useQuery({
    queryKey: ['me', 'watchlist', user?.uid ?? 'anon'],
    enabled: signedIn,
    queryFn: async () => {
      const response = await api.me.watchlist.list();
      const wire = response as WatchlistResponseWire;
      return {
        items: wire.items,
        limit: wire.limit > 0 ? wire.limit : WATCHLIST_LIMIT_FREE_DEFAULT,
      };
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await api.me.watchlist.add({ taxonId, cellR7 });
    },
    onSuccess: async () => {
      setLimitVisible(false);
      await queryClient.invalidateQueries({ queryKey: ['me', 'watchlist'] });
    },
    onError: (error) => {
      if (isWatchlistLimitError(error)) {
        setLimitVisible(true);
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.me.watchlist.remove(id);
    },
    onSuccess: async () => {
      setLimitVisible(false);
      await queryClient.invalidateQueries({ queryKey: ['me', 'watchlist'] });
    },
  });

  if (!signedIn) {
    return (
      <PrimaryButton
        label={t('home.watchlist.saveNeedsSignIn')}
        onPress={() => {
          if (onSignIn !== undefined) {
            onSignIn();
            return;
          }
          router.push('/sign-in');
        }}
        variant="secondary"
        testID="forecast-watchlist-sign-in"
        style={styles.button}
      />
    );
  }

  const items = listQuery.data?.items ?? [];
  const limit = listQuery.data?.limit ?? WATCHLIST_LIMIT_FREE_DEFAULT;
  const existing = findWatchlistItem(items, taxonId, cellR7);
  const atLimit = isAtWatchlistLimit(items.length, limit);
  const showLimit = limitVisible || (atLimit && existing === undefined);

  if (listQuery.isLoading) {
    return null;
  }

  return (
    <View style={styles.wrap} testID="forecast-watchlist-actions">
      {existing !== undefined ? (
        <PrimaryButton
          label={t('home.watchlist.saved')}
          onPress={() => {
            removeMutation.mutate(existing.id);
          }}
          disabled={removeMutation.isPending}
          variant="secondary"
          testID="forecast-watchlist-remove"
          style={styles.button}
        />
      ) : (
        <PrimaryButton
          label={t('home.watchlist.save')}
          onPress={() => {
            if (atLimit) {
              setLimitVisible(true);
              return;
            }
            addMutation.mutate();
          }}
          disabled={addMutation.isPending}
          testID="forecast-watchlist-save"
          style={styles.button}
        />
      )}
      {showLimit ? (
        <View
          style={[styles.limitBox, { backgroundColor: surface, borderColor: border }]}
          testID="forecast-watchlist-limit"
        >
          <Text style={styles.limitTitle}>{t('home.watchlist.limitTitle')}</Text>
          <Text style={[styles.limitBody, { color: muted }]}>{t('home.watchlist.limitBody')}</Text>
        </View>
      ) : null}
      {addMutation.isError && !isWatchlistLimitError(addMutation.error) ? (
        <Text style={[styles.error, { color: muted }]} testID="forecast-watchlist-error">
          {t('home.watchlist.saveError')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    marginBottom: 8,
    gap: 10,
  },
  button: {
    alignSelf: 'stretch',
  },
  limitBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  limitTitle: { fontSize: 16, fontWeight: '700' },
  limitBody: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  error: { fontSize: 14 },
});
