import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { authErrorCode, useAuth } from '@/lib/auth/auth-context';
import type { AuthErrorCode } from '@/lib/auth/types';
import { getLayoutDirection } from '@/lib/i18n';

export type SignInFormProps = {
  readonly onSignedIn?: () => void;
};

type Mode = 'sign_in' | 'create';

function Field({
  label,
  testID,
  ...props
}: TextInputProps & { readonly label: string; readonly testID: string }) {
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
        placeholderTextColor={muted}
        style={[
          styles.input,
          {
            color: text,
            backgroundColor: surface,
            borderColor: border,
          },
        ]}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={props.autoCorrect ?? false}
        // Keep passwords out of keyboard learning on both platforms.
        textContentType={props.secureTextEntry === true ? 'password' : props.textContentType}
        keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
      />
    </View>
  );
}

export function SignInForm({ onSignedIn }: SignInFormProps) {
  const { t } = useTranslation();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');
  const scheme = useColorScheme();
  const {
    configured,
    status,
    signInWithEmailPassword,
    createAccountWithEmailPassword,
    socialProvidersAvailable,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !busy;

  async function submit() {
    setErrorCode(null);
    setBusy(true);
    try {
      if (mode === 'sign_in') {
        await signInWithEmailPassword(email, password);
      } else {
        await createAccountWithEmailPassword(email, password);
      }
      onSignedIn?.();
    } catch (error: unknown) {
      setErrorCode(authErrorCode(error));
    } finally {
      setBusy(false);
    }
  }

  if (!configured || status === 'unavailable') {
    return (
      <View style={[styles.root, { direction }]} testID="sign-in-unconfigured">
        <Text style={styles.title}>{t('auth.title')}</Text>
        <Text style={[styles.body, { color: muted }]}>{t('auth.notConfigured')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { direction }]} testID="sign-in-form">
      <Text style={styles.brand}>{t('shell.brand')}</Text>
      <Text style={styles.title}>{t('auth.title')}</Text>
      <Text style={[styles.body, { color: muted }]}>{t('auth.subtitle')}</Text>

      <Field
        label={t('auth.email')}
        testID="sign-in-email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        placeholder={t('auth.emailPlaceholder')}
      />
      <Field
        label={t('auth.password')}
        testID="sign-in-password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign_in' ? 'password' : 'new-password'}
        placeholder={t('auth.passwordPlaceholder')}
      />

      {errorCode !== null ? (
        <Text style={[styles.error, { color: danger }]} testID="sign-in-error">
          {t(`auth.errors.${errorCode}`)}
        </Text>
      ) : null}

      <PrimaryButton
        label={
          busy ? t('auth.working') : mode === 'sign_in' ? t('auth.signIn') : t('auth.createAccount')
        }
        onPress={() => {
          void submit();
        }}
        disabled={!canSubmit}
        testID="sign-in-submit"
        style={styles.submit}
      />
      {busy ? <ActivityIndicator color={tint} style={styles.spinner} /> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setErrorCode(null);
          setMode((prev) => (prev === 'sign_in' ? 'create' : 'sign_in'));
        }}
        testID="sign-in-toggle-mode"
        style={styles.toggle}
      >
        <Text style={{ color: tint }}>
          {mode === 'sign_in' ? t('auth.switchToCreate') : t('auth.switchToSignIn')}
        </Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: Colors[scheme].border }]} />
        <Text style={[styles.dividerLabel, { color: muted }]}>{t('auth.or')}</Text>
        <View style={[styles.dividerLine, { backgroundColor: Colors[scheme].border }]} />
      </View>

      <PrimaryButton
        label={t('auth.continueApple')}
        onPress={() => {
          setErrorCode('provider_unavailable');
        }}
        disabled={!socialProvidersAvailable}
        variant="secondary"
        testID="sign-in-apple"
        style={styles.social}
      />
      <PrimaryButton
        label={t('auth.continueGoogle')}
        onPress={() => {
          setErrorCode('provider_unavailable');
        }}
        disabled={!socialProvidersAvailable}
        variant="secondary"
        testID="sign-in-google"
        style={styles.social}
      />
      <Text style={[styles.socialHint, { color: muted }]} testID="sign-in-social-hint">
        {t('auth.socialNeedsDevBuild')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    padding: 24,
    gap: 12,
  },
  brand: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  submit: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  spinner: {
    marginTop: 4,
  },
  toggle: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerLabel: {
    fontSize: 13,
  },
  social: {
    alignSelf: 'stretch',
  },
  socialHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
