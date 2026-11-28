import {
  PREF_KEYS,
  completeOnboarding,
  createMemoryPreferenceStorage,
  loadPreferences,
  saveLanguage,
  saveRegion,
  saveUnits,
} from '@/lib/preferences';

describe('preferences (T6.2 / T6.12)', () => {
  it('saves and loads a beta region', async () => {
    const storage = createMemoryPreferenceStorage();
    await saveRegion('sindh', storage);
    const prefs = await loadPreferences(storage);
    expect(prefs.region).toBe('sindh');
    expect(prefs.onboardingComplete).toBe(false);
    expect(prefs.units).toBe('metric');
    expect(prefs.language).toBeNull();
    expect(await storage.getItem(PREF_KEYS.region)).toBe('sindh');
  });

  it('completeOnboarding persists region and completion', async () => {
    const storage = createMemoryPreferenceStorage();
    const prefs = await completeOnboarding('scotland', storage);
    expect(prefs).toEqual({
      region: 'scotland',
      onboardingComplete: true,
      units: 'metric',
      language: null,
    });
    expect(await loadPreferences(storage)).toEqual(prefs);
  });

  it('ignores invalid stored region values', async () => {
    const storage = createMemoryPreferenceStorage({
      [PREF_KEYS.region]: 'nowhere',
      [PREF_KEYS.onboardingComplete]: 'true',
    });
    const prefs = await loadPreferences(storage);
    expect(prefs.region).toBeNull();
    expect(prefs.onboardingComplete).toBe(true);
  });

  it('saves units and language', async () => {
    const storage = createMemoryPreferenceStorage();
    await saveUnits('imperial', storage);
    await saveLanguage('ur', storage);
    const prefs = await loadPreferences(storage);
    expect(prefs.units).toBe('imperial');
    expect(prefs.language).toBe('ur');
  });
});
