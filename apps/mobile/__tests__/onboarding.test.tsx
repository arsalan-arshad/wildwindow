import React, { useState } from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

import HomeScreen from '../app/(tabs)/index';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { createMemoryPreferenceStorage, loadPreferences } from '@/lib/preferences';
import { usePreferences } from '@/lib/preferences-context';
import type { RegionId } from '@/lib/regions';
import { renderWithProviders } from '../testing/test-utils';

/**
 * Acceptance (T6.2): onboarding ends on Home and the region is saved.
 * Uses a small harness so we do not need the full Expo Router tree.
 */
function OnboardingHarness({
  onOpenNoPin = () => undefined,
}: {
  readonly onOpenNoPin?: () => void;
}) {
  const { onboardingComplete, finishOnboarding } = usePreferences();
  const [step, setStep] = useState(0);

  if (onboardingComplete) {
    return (
      <View testID="post-onboarding">
        <HomeScreen />
      </View>
    );
  }

  return (
    <OnboardingFlow
      step={step}
      onStepChange={setStep}
      onComplete={async (region: RegionId) => {
        await finishOnboarding(region);
      }}
      onOpenNoPin={onOpenNoPin}
    />
  );
}

describe('Onboarding (T6.2 S-01)', () => {
  it('completes onto Home and saves the chosen region', async () => {
    const storage = createMemoryPreferenceStorage();

    const view = await renderWithProviders(<OnboardingHarness />, {
      preferenceStorage: storage,
      initialPreferences: { region: null, onboardingComplete: false },
    });

    expect(view.getByTestId('onboarding-card-what')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('onboarding-continue'));
    });

    await waitFor(() => {
      expect(view.getByTestId('onboarding-card-nopin')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('onboarding-continue'));
    });

    await waitFor(() => {
      expect(view.getByTestId('onboarding-card-region')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('region-option-scotland'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('onboarding-finish'));
    });

    await waitFor(() => {
      expect(view.getByTestId('post-onboarding')).toBeTruthy();
    });
    expect(view.getByTestId('tab-home')).toBeTruthy();
    expect(view.getByText('Home')).toBeTruthy();

    await waitFor(async () => {
      const prefs = await loadPreferences(storage);
      expect(prefs).toEqual({ region: 'scotland', onboardingComplete: true });
    });
  });

  it('opens the No-Pin Promise from card 2', async () => {
    const onOpenNoPin = jest.fn();
    function OpenHarness() {
      const [step, setStep] = useState(0);
      return (
        <OnboardingFlow
          step={step}
          onStepChange={setStep}
          onComplete={jest.fn()}
          onOpenNoPin={onOpenNoPin}
        />
      );
    }

    const view = await renderWithProviders(<OpenHarness />, {
      initialPreferences: { region: null, onboardingComplete: false },
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('onboarding-continue'));
    });
    await waitFor(() => {
      expect(view.getByTestId('onboarding-open-nopin')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('onboarding-open-nopin'));
    });
    expect(onOpenNoPin).toHaveBeenCalledTimes(1);
  });

  it('disables Get started until a region is chosen', async () => {
    const view = await renderWithProviders(
      <OnboardingFlow onComplete={jest.fn()} onOpenNoPin={jest.fn()} step={2} />,
      { initialPreferences: { region: null, onboardingComplete: false } },
    );

    const finish = view.getByTestId('onboarding-finish');
    expect(finish.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });
});
