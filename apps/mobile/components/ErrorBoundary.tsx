import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text as RNText, View as RNView } from 'react-native';

import { i18n } from '@/lib/i18n';
import { captureException } from '@/lib/sentry';
import Colors from '@/constants/Colors';

export type ErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly onReset?: () => void;
};

type ErrorBoundaryState = {
  readonly error: Error | null;
};

/**
 * App-level error boundary used by Expo Router (`export { ErrorBoundary }` from `_layout`).
 * Reports to the Sentry placeholder and shows a retry affordance.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, { componentStack: info.componentStack ?? undefined });
  }

  private handleRetry = (): void => {
    // Let the parent drop the throwing child before we remount children.
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }

    const colors = Colors.light;
    return (
      <RNView
        style={[styles.container, { backgroundColor: colors.background }]}
        accessibilityRole="alert"
      >
        <RNText style={[styles.title, { color: colors.text }]}>{i18n.t('shell.errorTitle')}</RNText>
        <RNText style={[styles.body, { color: colors.textMuted }]}>
          {i18n.t('shell.errorBody')}
        </RNText>
        <Pressable
          onPress={this.handleRetry}
          style={[styles.button, { backgroundColor: colors.tint }]}
          accessibilityRole="button"
        >
          <RNText style={styles.buttonLabel}>{i18n.t('shell.errorRetry')}</RNText>
        </Pressable>
      </RNView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
