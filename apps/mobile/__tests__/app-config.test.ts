/**
 * `eas init` / `eas build` shell out to `expo config --json`. A package listed
 * under `plugins` must export an Expo config plugin (`app.plugin.js`).
 * `expo-image-manipulator` is a runtime dependency only (logbook EXIF strip);
 * listing it makes config evaluation fail with PluginError / exit 1.
 *
 * Jest cwd for this package is `apps/mobile` (package.json `test` script).
 */
describe('app.config (eas init / expo config)', () => {
  it('does not list expo-image-manipulator in the plugins array', () => {
    const fs = jest.requireActual('fs') as {
      readFileSync: (filePath: string, encoding: string) => string;
    };
    const path = jest.requireActual('path') as {
      join: (...parts: string[]) => string;
    };
    const src = fs.readFileSync(path.join(process.cwd(), 'app.config.ts'), 'utf8');
    const pluginsBlock = src.match(/plugins:\s*\[([\s\S]*?)\],\s*experiments/);
    expect(pluginsBlock?.[1]).toBeDefined();
    expect(pluginsBlock?.[1]).not.toMatch(/['"]expo-image-manipulator['"]/);
  });

  it('expo config --json succeeds without EXPO_PUBLIC_* secrets', () => {
    const { execFileSync } = jest.requireActual('child_process') as {
      execFileSync: (file: string, args: string[], options: Record<string, unknown>) => string;
    };
    const path = jest.requireActual('path') as {
      join: (...parts: string[]) => string;
    };
    const { createRequire } = jest.requireActual('module') as {
      createRequire: (filename: string) => { resolve: (id: string) => string };
    };

    const mobileRoot = process.cwd();
    const requireFromMobile = createRequire(path.join(mobileRoot, 'package.json'));
    const env: Record<string, string | undefined> = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith('EXPO_PUBLIC_')) {
        delete env[key];
      }
    }

    const stdout = execFileSync(
      process.execPath,
      [requireFromMobile.resolve('expo/bin/cli'), 'config', '--json'],
      {
        cwd: mobileRoot,
        env,
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
      },
    );

    const parsed = JSON.parse(stdout) as {
      name: string;
      slug: string;
      ios?: { bundleIdentifier?: string };
      android?: { package?: string };
    };
    expect(parsed.name).toBe('WildWindow');
    expect(parsed.slug).toBe('wildwindow');
    expect(parsed.ios?.bundleIdentifier).toBe('studio.arsalandev.wildwindow');
    expect(parsed.android?.package).toBe('studio.arsalandev.wildwindow');
  }, 30_000);
});
