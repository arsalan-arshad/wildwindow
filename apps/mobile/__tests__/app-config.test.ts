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

  it('expo config --json succeeds without EXPO_PUBLIC_* secrets and wires EAS + googleServicesFile', () => {
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
      if (
        key.startsWith('EXPO_PUBLIC_') ||
        key === 'GOOGLE_SERVICES_JSON' ||
        key === 'GOOGLE_SERVICES_PLIST'
      ) {
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
      owner?: string;
      ios?: { bundleIdentifier?: string; googleServicesFile?: string };
      android?: { package?: string; googleServicesFile?: string };
      updates?: { url?: string };
      runtimeVersion?: string | { policy?: string };
      extra?: { eas?: { projectId?: string } };
    };
    expect(parsed.name).toBe('WildWindow');
    expect(parsed.slug).toBe('wildwindow');
    expect(parsed.owner).toBe('arsalandev');
    expect(parsed.ios?.bundleIdentifier).toBe('studio.arsalandev.wildwindow');
    expect(parsed.android?.package).toBe('studio.arsalandev.wildwindow');
    expect(parsed.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(parsed.android?.googleServicesFile).toBe('./google-services.json');
    expect(parsed.extra?.eas?.projectId).toBe('36e6ca10-4761-4338-b057-bee2208b142b');
    expect(parsed.updates?.url).toBe('https://u.expo.dev/36e6ca10-4761-4338-b057-bee2208b142b');
    expect(parsed.runtimeVersion).toEqual({ policy: 'appVersion' });
  }, 30_000);

  it('ships eas.json with development, preview, and production profiles', () => {
    const fs = jest.requireActual('fs') as {
      readFileSync: (filePath: string, encoding: string) => string;
      existsSync: (filePath: string) => boolean;
    };
    const path = jest.requireActual('path') as {
      join: (...parts: string[]) => string;
    };
    const raw = fs.readFileSync(path.join(process.cwd(), 'eas.json'), 'utf8');
    const eas = JSON.parse(raw) as {
      build?: Record<string, { channel?: string; developmentClient?: boolean }>;
    };
    expect(eas.build?.['development']?.developmentClient).toBe(true);
    expect(eas.build?.['development']?.channel).toBe('development');
    expect(eas.build?.['preview']?.channel).toBe('preview');
    expect(eas.build?.['production']?.channel).toBe('production');

    const workflows = path.join(process.cwd(), '.eas', 'workflows');
    for (const name of [
      'create-development-builds.yml',
      'build-preview.yml',
      'deploy-to-production.yml',
      'publish-preview-update.yml',
    ]) {
      expect(fs.existsSync(path.join(workflows, name))).toBe(true);
    }
  });

  it('keeps google-services example placeholders without real project secrets', () => {
    const fs = jest.requireActual('fs') as {
      readFileSync: (filePath: string, encoding: string) => string;
      existsSync: (filePath: string) => boolean;
    };
    const path = jest.requireActual('path') as {
      join: (...parts: string[]) => string;
    };
    const root = process.cwd();
    expect(fs.existsSync(path.join(root, 'google-services.json.example'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'GoogleService-Info.plist.example'))).toBe(true);
    // Real downloads must stay untracked / absent in CI.
    expect(fs.existsSync(path.join(root, 'google-services.json'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'GoogleService-Info.plist'))).toBe(false);

    const androidExample = fs.readFileSync(path.join(root, 'google-services.json.example'), 'utf8');
    expect(androidExample).toContain('studio.arsalandev.wildwindow');
    expect(androidExample).toContain('REPLACE_WITH_ANDROID_API_KEY_FROM_FIREBASE_CONSOLE');

    const iosExample = fs.readFileSync(path.join(root, 'GoogleService-Info.plist.example'), 'utf8');
    expect(iosExample).toContain('studio.arsalandev.wildwindow');
    expect(iosExample).toContain('REPLACE_WITH_IOS_API_KEY_FROM_FIREBASE_CONSOLE');
  });

  it('gitignore rules cover google-services downloads and GoogleService-Info*.plist variants', () => {
    const { execFileSync } = jest.requireActual('child_process') as {
      execFileSync: (file: string, args: string[], options: Record<string, unknown>) => string;
    };
    const path = jest.requireActual('path') as {
      join: (...parts: string[]) => string;
      resolve: (...parts: string[]) => string;
    };
    const fs = jest.requireActual('fs') as {
      writeFileSync: (filePath: string, data: string) => void;
      unlinkSync: (filePath: string) => void;
    };

    const mobileRoot = process.cwd();
    const repoRoot = path.resolve(mobileRoot, '../..');
    const androidPath = path.join(mobileRoot, 'google-services.json');
    const iosPath = path.join(mobileRoot, 'GoogleService-Info.plist');
    const variantPath = path.join(mobileRoot, 'GoogleService-Info-Dev.plist');
    const examplePath = path.join(mobileRoot, 'google-services.json.example');

    fs.writeFileSync(androidPath, '{"_probe":true}\n');
    fs.writeFileSync(iosPath, '<!-- probe -->\n');
    fs.writeFileSync(variantPath, '<!-- probe-dev -->\n');
    try {
      const ignored = execFileSync(
        'git',
        [
          'check-ignore',
          '-v',
          'apps/mobile/google-services.json',
          'apps/mobile/GoogleService-Info.plist',
          'apps/mobile/GoogleService-Info-Dev.plist',
        ],
        { cwd: repoRoot, encoding: 'utf8' },
      );
      expect(ignored).toMatch(/google-services\.json/);
      expect(ignored).toMatch(/GoogleService-Info\.plist/);
      expect(ignored).toMatch(/GoogleService-Info-Dev\.plist/);

      // Examples must remain visible to git (not ignored).
      let exampleIgnored = false;
      try {
        execFileSync('git', ['check-ignore', '-v', 'apps/mobile/google-services.json.example'], {
          cwd: repoRoot,
          encoding: 'utf8',
        });
        exampleIgnored = true;
      } catch {
        exampleIgnored = false;
      }
      expect(exampleIgnored).toBe(false);
      // Silence unused-path lint in strict mode when rewrite lands differently.
      expect(androidPath.length + iosPath.length + examplePath.length).toBeGreaterThan(0);
    } finally {
      for (const p of [androidPath, iosPath, variantPath]) {
        try {
          fs.unlinkSync(p);
        } catch {
          // absent
        }
      }
    }
  });
});
