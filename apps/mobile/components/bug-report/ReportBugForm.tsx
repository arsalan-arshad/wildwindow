import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import {
  bugReportAppVersion,
  bugReportDeviceLabel,
  bugReportPlatform,
} from '@/lib/bug-report-meta';
import { useApiClient } from '@/lib/api-context';
import { getLayoutDirection } from '@/lib/i18n';

export type ReportBugFormProps = {
  readonly testID?: string;
  readonly openURL?: (url: string) => Promise<void>;
};

function Field({
  label,
  testID,
  multiline,
  ...props
}: TextInputProps & {
  readonly label: string;
  readonly testID: string;
  readonly multiline?: boolean;
}) {
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const scheme = useColorScheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: muted }]}>{label}</Text>
      <TextInput
        {...props}
        testID={testID}
        multiline={multiline}
        placeholderTextColor={muted}
        style={[
          styles.input,
          multiline === true ? styles.inputMultiline : null,
          {
            color: text,
            backgroundColor: surface,
            borderColor: border,
          },
        ]}
        textAlignVertical={multiline === true ? 'top' : 'center'}
        keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
      />
    </View>
  );
}

/**
 * S-16 / S-02 Report a bug form (T9.11).
 * Posts to POST /v1/bug-reports; opens the fallback GitHub URL when returned.
 */
export function ReportBugForm({
  testID = 'report-bug-form',
  openURL = (url) => Linking.openURL(url),
}: ReportBugFormProps) {
  const { t } = useTranslation();
  const api = useApiClient();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');

  const platform = bugReportPlatform();
  const version = bugReportAppVersion();
  const device = bugReportDeviceLabel();

  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit =
    steps.trim().length > 0 && expected.trim().length > 0 && actual.trim().length > 0 && !busy;

  const onSubmit = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await api.bugReports.create({
        steps: steps.trim(),
        expected: expected.trim(),
        actual: actual.trim(),
        platform,
        version,
        device,
      });

      if (result.status === 'filed') {
        setSuccess(t('bugReport.filed', { number: result.issueNumber }));
        return;
      }

      await openURL(result.url);
      setSuccess(t('bugReport.fallbackOpened'));
    } catch {
      setError(t('bugReport.error'));
    } finally {
      setBusy(false);
    }
  }, [actual, api, device, expected, openURL, platform, steps, t, version]);

  return (
    <ScrollView
      testID={testID}
      style={{ direction }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('bugReport.title')}</Text>
      <Text style={[styles.body, { color: muted }]}>{t('bugReport.subtitle')}</Text>
      <Text style={[styles.privacy, { color: muted }]} testID="report-bug-nopin">
        {t('bugReport.noPinReminder')}
      </Text>

      <Field
        label={t('bugReport.steps')}
        testID="report-bug-steps"
        value={steps}
        onChangeText={setSteps}
        multiline
        placeholder={t('bugReport.stepsPlaceholder')}
      />
      <Field
        label={t('bugReport.expected')}
        testID="report-bug-expected"
        value={expected}
        onChangeText={setExpected}
        multiline
        placeholder={t('bugReport.expectedPlaceholder')}
      />
      <Field
        label={t('bugReport.actual')}
        testID="report-bug-actual"
        value={actual}
        onChangeText={setActual}
        multiline
        placeholder={t('bugReport.actualPlaceholder')}
      />

      <Text style={[styles.meta, { color: muted }]} testID="report-bug-meta">
        {t('bugReport.meta', { platform, version, device })}
      </Text>

      {error !== null ? (
        <Text style={[styles.error, { color: danger }]} testID="report-bug-error">
          {error}
        </Text>
      ) : null}
      {success !== null ? (
        <Text style={[styles.success, { color: muted }]} testID="report-bug-success">
          {success}
        </Text>
      ) : null}

      <PrimaryButton
        label={busy ? t('auth.working') : t('bugReport.submit')}
        onPress={() => {
          void onSubmit();
        }}
        disabled={!canSubmit}
        testID="report-bug-submit"
        style={styles.submit}
      />
      {busy ? <ActivityIndicator color={tint} style={styles.spinner} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 12,
  },
  title: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  privacy: { fontSize: 14, lineHeight: 20 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 96,
  },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  error: { fontSize: 14, lineHeight: 20 },
  success: { fontSize: 14, lineHeight: 20 },
  submit: { marginTop: 8, alignSelf: 'stretch' },
  spinner: { marginTop: 4 },
});
