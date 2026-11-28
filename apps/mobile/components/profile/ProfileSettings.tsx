import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SettingChoiceRow } from '@/components/profile/SettingChoiceRow';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { authErrorCode, useAuth } from '@/lib/auth/auth-context';
import type { AuthErrorCode } from '@/lib/auth/types';
import {
  getLayoutDirection,
  isAppLanguage,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences-context';
import { BETA_REGIONS, UNIT_SYSTEMS, type UnitSystem } from '@/lib/preferences';
import type { RegionId } from '@/lib/regions';

export type ProfileSettingsProps = {
  readonly testID?: string;
};

/**
 * S-16 Profile and settings: region, units, language, privacy, export, delete (T6.12).
 * Units stay on-device; region and language PATCH `/v1/me` when signed in.
 */
export function ProfileSettings({ testID = 'tab-profile' }: ProfileSettingsProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const api = useApiClient();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const danger = useThemeColor({}, 'danger');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');

  const { region, units, language, setRegion, setUnits, setLanguage } = usePreferences();
  const { status, user, signOut } = useAuth();

  const [signOutError, setSignOutError] = useState<AuthErrorCode | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const signedIn = status === 'signed_in' && user !== null;
  const activeLanguage: AppLanguage =
    language ?? (isAppLanguage(i18n.language) ? i18n.language : 'en');

  const syncProfile = useCallback(
    async (patch: { homeRegionSlug?: RegionId | null; locale?: AppLanguage }) => {
      if (!signedIn) return;
      await api.me.patch(patch);
    },
    [api, signedIn],
  );

  const onRegionChange = useCallback(
    async (next: RegionId) => {
      setSettingsError(null);
      setSettingsBusy(true);
      try {
        await setRegion(next);
        await syncProfile({ homeRegionSlug: next });
      } catch {
        setSettingsError(t('profile.settingsError'));
      } finally {
        setSettingsBusy(false);
      }
    },
    [setRegion, syncProfile, t],
  );

  const onUnitsChange = useCallback(
    async (next: UnitSystem) => {
      setSettingsError(null);
      setSettingsBusy(true);
      try {
        await setUnits(next);
      } catch {
        setSettingsError(t('profile.settingsError'));
      } finally {
        setSettingsBusy(false);
      }
    },
    [setUnits, t],
  );

  const onLanguageChange = useCallback(
    async (next: AppLanguage) => {
      setSettingsError(null);
      setSettingsBusy(true);
      try {
        await setLanguage(next);
        await syncProfile({ locale: next });
      } catch {
        setSettingsError(t('profile.settingsError'));
      } finally {
        setSettingsBusy(false);
      }
    },
    [setLanguage, syncProfile, t],
  );

  const onExport = useCallback(async () => {
    setExportMessage(null);
    setExportBusy(true);
    try {
      const result = await api.me.export();
      if (result.status === 'ready' && result.downloadUrl !== null) {
        const opened = await Linking.canOpenURL(result.downloadUrl);
        if (opened) {
          await Linking.openURL(result.downloadUrl);
        }
        setExportMessage(t('profile.exportReady'));
      } else {
        setExportMessage(t('profile.exportQueued'));
      }
    } catch {
      setExportMessage(t('profile.exportError'));
    } finally {
      setExportBusy(false);
    }
  }, [api, t]);

  const onConfirmDelete = useCallback(async () => {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await api.me.delete();
      await signOut();
      setDeleteConfirming(false);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error) {
        setDeleteError(t(`auth.errors.${authErrorCode(error)}`));
      } else {
        setDeleteError(t('profile.deleteError'));
      }
    } finally {
      setDeleteBusy(false);
    }
  }, [api, signOut, t]);

  return (
    <ScrollView
      testID={testID}
      style={{ direction }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('tabs.profile')}</Text>

      {signedIn ? (
        <View style={styles.authBlock} testID="profile-signed-in">
          <Text style={[styles.meta, { color: muted }]} testID="profile-email">
            {user.email ?? t('auth.signedInAnonymous')}
          </Text>
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

      <Text style={styles.sectionTitle}>{t('profile.settingsTitle')}</Text>

      <SettingChoiceRow
        label={t('profile.regionLabel')}
        value={region}
        testID="profile-region"
        disabled={settingsBusy}
        options={BETA_REGIONS.map((r) => ({
          value: r.id,
          label: t(r.nameKey),
          testID: `profile-region-${r.id}`,
        }))}
        onChange={(next) => {
          void onRegionChange(next);
        }}
      />

      <SettingChoiceRow
        label={t('profile.unitsLabel')}
        value={units}
        testID="profile-units"
        disabled={settingsBusy}
        options={UNIT_SYSTEMS.map((u) => ({
          value: u,
          label: t(`profile.units.${u}`),
          testID: `profile-units-${u}`,
        }))}
        onChange={(next) => {
          void onUnitsChange(next);
        }}
      />

      <SettingChoiceRow
        label={t('profile.languageLabel')}
        value={activeLanguage}
        testID="profile-language"
        disabled={settingsBusy}
        options={SUPPORTED_LANGUAGES.map((lng) => ({
          value: lng,
          label: t(`profile.languages.${lng}`),
          testID: `profile-language-${lng}`,
        }))}
        onChange={(next) => {
          void onLanguageChange(next);
        }}
      />

      {settingsBusy ? (
        <ActivityIndicator color={tint} style={styles.spinner} testID="profile-settings-busy" />
      ) : null}
      {settingsError !== null ? (
        <Text style={[styles.error, { color: danger }]} testID="profile-settings-error">
          {settingsError}
        </Text>
      ) : null}

      <View
        style={[styles.privacyBlock, { backgroundColor: surface, borderColor: border }]}
        testID="profile-privacy"
      >
        <Text style={styles.privacyTitle}>{t('profile.privacyTitle')}</Text>
        <Text style={[styles.privacyBody, { color: muted }]}>{t('profile.privacyBody')}</Text>
        <PrimaryButton
          label={t('profile.noPinLink')}
          onPress={() => {
            router.push('/no-pin');
          }}
          variant="secondary"
          testID="profile-nopin-link"
          style={styles.privacyLink}
        />
      </View>

      <PrimaryButton
        label={t('profile.attributionsLink')}
        onPress={() => {
          router.push('/attributions');
        }}
        variant="secondary"
        testID="profile-attributions-link"
        style={styles.link}
      />

      <PrimaryButton
        label={t('profile.reportBugLink')}
        onPress={() => {
          router.push('/report-bug');
        }}
        variant="secondary"
        testID="profile-report-bug"
        style={styles.link}
      />

      {signedIn ? (
        <View style={styles.accountBlock} testID="profile-account">
          <Text style={styles.sectionTitle}>{t('profile.accountTitle')}</Text>
          <PrimaryButton
            label={exportBusy ? t('auth.working') : t('profile.exportButton')}
            onPress={() => {
              void onExport();
            }}
            disabled={exportBusy || deleteBusy}
            variant="secondary"
            testID="profile-export"
            style={styles.link}
          />
          {exportMessage !== null ? (
            <Text style={[styles.meta, { color: muted }]} testID="profile-export-message">
              {exportMessage}
            </Text>
          ) : null}

          {!deleteConfirming ? (
            <PrimaryButton
              label={t('profile.deleteButton')}
              onPress={() => {
                setDeleteError(null);
                setDeleteConfirming(true);
              }}
              disabled={exportBusy || deleteBusy}
              variant="secondary"
              testID="profile-delete"
              style={styles.link}
            />
          ) : (
            <View
              style={[styles.confirmBlock, { borderColor: danger, backgroundColor: surface }]}
              testID="profile-delete-confirm"
            >
              <Text style={[styles.confirmTitle, { color: danger }]}>
                {t('profile.deleteConfirmTitle')}
              </Text>
              <Text style={[styles.privacyBody, { color: muted }]}>
                {t('profile.deleteConfirmBody')}
              </Text>
              <PrimaryButton
                label={deleteBusy ? t('auth.working') : t('profile.deleteConfirmAction')}
                onPress={() => {
                  void onConfirmDelete();
                }}
                disabled={deleteBusy}
                testID="profile-delete-confirm-yes"
                style={styles.privacyLink}
              />
              <PrimaryButton
                label={t('profile.deleteCancel')}
                onPress={() => {
                  setDeleteConfirming(false);
                  setDeleteError(null);
                }}
                disabled={deleteBusy}
                variant="secondary"
                testID="profile-delete-confirm-no"
                style={styles.privacyLink}
              />
            </View>
          )}
          {deleteError !== null ? (
            <Text style={[styles.error, { color: danger }]} testID="profile-delete-error">
              {deleteError}
            </Text>
          ) : null}

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
            disabled={signingOut || deleteBusy}
            variant="secondary"
            testID="profile-sign-out"
            style={styles.link}
          />
        </View>
      ) : null}

      {signOutError !== null ? (
        <Text style={[styles.error, { color: danger }]} testID="profile-sign-out-error">
          {t(`auth.errors.${signOutError}`)}
        </Text>
      ) : null}

      <Text style={[styles.brand, { color: muted }]}>{t('shell.brand')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  title: { fontSize: 28, fontWeight: '700' },
  sectionTitle: {
    marginTop: 28,
    fontSize: 18,
    fontWeight: '700',
  },
  meta: { marginTop: 12, fontSize: 16 },
  authBlock: { marginTop: 8 },
  link: { marginTop: 16, alignSelf: 'stretch' },
  spinner: { marginTop: 12 },
  error: { marginTop: 12, fontSize: 14 },
  privacyBlock: {
    marginTop: 28,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  privacyTitle: { fontSize: 16, fontWeight: '700' },
  privacyBody: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  privacyLink: { marginTop: 12, alignSelf: 'stretch' },
  accountBlock: { marginTop: 8 },
  confirmBlock: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  confirmTitle: { fontSize: 16, fontWeight: '700' },
  brand: { marginTop: 32, fontSize: 14, letterSpacing: 0.4 },
});
