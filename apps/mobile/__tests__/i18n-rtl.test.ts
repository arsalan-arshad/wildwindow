import { I18nManager } from 'react-native';

import {
  applyLayoutDirection,
  getLayoutDirection,
  initI18n,
  isRtlLanguage,
  setAppLanguage,
} from '@/lib/i18n';

describe('i18n RTL (T6.1)', () => {
  beforeEach(() => {
    jest.spyOn(I18nManager, 'forceRTL');
    jest.spyOn(I18nManager, 'allowRTL');
    initI18n('en');
    applyLayoutDirection('en');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('treats ur as RTL and en as LTR', () => {
    expect(isRtlLanguage('en')).toBe(false);
    expect(isRtlLanguage('ur')).toBe(true);
    expect(isRtlLanguage('ur-PK')).toBe(true);
  });

  it('switching to ur flips the layout direction', async () => {
    expect(getLayoutDirection()).toBe('ltr');

    const direction = await setAppLanguage('ur');

    expect(direction).toBe('rtl');
    expect(getLayoutDirection()).toBe('rtl');
    // Native flag is requested; some runtimes only apply after reload.
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(true);
  });

  it('switching back to en restores LTR', async () => {
    await setAppLanguage('ur');
    expect(getLayoutDirection()).toBe('rtl');

    const direction = await setAppLanguage('en');

    expect(direction).toBe('ltr');
    expect(getLayoutDirection()).toBe('ltr');
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
  });
});
