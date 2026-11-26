import { fireEvent, render } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Text } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initI18n } from '@/lib/i18n';

function Boom(): React.ReactElement {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    initI18n('en');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a retry UI when a child throws', async () => {
    const view = await render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(view.getByText('Something went wrong')).toBeTruthy();
    expect(view.getByText('Try again')).toBeTruthy();
  });

  it('clears the error when retry is pressed', async () => {
    function Harness(): React.ReactElement {
      const [blowUp, setBlowUp] = useState(true);

      if (blowUp) {
        return (
          <ErrorBoundary onReset={() => setBlowUp(false)}>
            <Boom />
          </ErrorBoundary>
        );
      }

      return (
        <ErrorBoundary>
          <Text>recovered</Text>
        </ErrorBoundary>
      );
    }

    const view = await render(<Harness />);
    expect(view.getByText('Something went wrong')).toBeTruthy();

    await fireEvent.press(view.getByRole('button'));
    expect(view.getByText('recovered')).toBeTruthy();
  });
});
