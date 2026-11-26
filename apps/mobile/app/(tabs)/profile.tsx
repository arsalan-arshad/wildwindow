import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { authErrorCode, useAuth } from '@/lib/auth/auth-context';
import type { AuthErrorCode } from '@/lib/auth/types';
import { getLayoutDirection } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences-context';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const danger = useThemeColor({}, 'danger');
  const { region } = usePreferences();
  const { status, user, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<AuthErrorCode | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const regionLabel =
    region === 'scotland'
      ? t('regions.scotland.name')
      : region === 'sindh'
        ? t('regions.sindh.name')
        : '—';

  const signedIn = status === 'signed_in' && user !== null;

  return (
    <View style={[styles.container, { direction }]} testID="tab-profile">
      <Text style={styles.title}>{t('tabs.profile')}</Text>
      <Text style={[styles.meta, { color: muted }]}>
        {t('profile.regionLabel')}: {regionLabel}
      </Text>

      {signedIn ? (
        <View style={styles.authBlock} testID="profile-signed-in">
          <Text style={[styles.meta, { color: muted }]} testID="profile-email">
            {user.email ?? t('auth.signedInAnonymous')}
          </Text>
          <PrimaryButton
            label={signingOut ? t('auth.working') : t('auth.signOut')}
            onPress={() => {
              setSignOutError(null);
              setSigningOut(true);
              void (async () => {
                try {
                  await signOut();
                } catch (error: unknown) {
                  setSignOutError(authErrorCode(error));
                } finally {
                  setSigningOut(false);
                }
              })();
            }}
            disabled={signingOut}
            variant="secondary"
            testID="profile-sign-out"
            style={styles.link}
          />
        </View>
      ) : (
        <PrimaryButton
          label={t('auth.signIn')}
          onPress={() => {
            router.push('/sign-in');
          }}
          testID="profile-sign-in"
          style={styles.link}
        />
      )}

      {signOutError !== null ? (
        <Text style={[styles.error, { color: danger }]} testID="profile-sign-out-error">
          {t(`auth.errors.${signOutError}`)}
        </Text>
      ) : null}

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
  authBlock: { marginTop: 8 },
  link: { marginTop: 24, alignSelf: 'stretch' },
  error: { marginTop: 12, fontSize: 14 },
  brand: { marginTop: 32, fontSize: 14, letterSpacing: 0.4 },
});
