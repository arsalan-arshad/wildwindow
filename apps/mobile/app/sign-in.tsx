import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SignInForm } from '@/components/auth/SignInForm';
import { View } from '@/components/Themed';
import { getLayoutDirection } from '@/lib/i18n';

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const direction = getLayoutDirection();

  return (
    <View style={[styles.root, { direction }]} testID="sign-in-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel={t('auth.title')}
      >
        <SignInForm
          onSignedIn={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
});
