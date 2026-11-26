import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

type PackageJson = {
  name: string;
  version: string;
  private?: boolean;
  license: string;
  files: string[];
  publishConfig?: { access?: string };
  repository?: { type?: string; url?: string; directory?: string };
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as PackageJson;
}

describe('publish readiness (T10.1)', () => {
  it('package.json is scoped, MIT, and public-access when published', () => {
    const pkg = readPackageJson();
    expect(pkg.name).toBe('@wildwindow/geoprivacy');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.license).toBe('MIT');
    expect(pkg.private).toBe(true); // flipped only on founder publish day
    expect(pkg.publishConfig?.access).toBe('public');
    expect(pkg.files).toEqual(['dist', 'README.md', 'LICENSE', 'CHANGELOG.md']);
    expect(pkg.repository?.directory).toBe('packages/geoprivacy');
    expect(pkg.homepage).toContain('packages/geoprivacy');
    expect(pkg.keywords).toEqual(expect.arrayContaining(['h3', 'geoprivacy', 'wildlife']));
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['h3-js']);
    expect(pkg.scripts?.prepublishOnly).toContain('build');
    expect(pkg.scripts?.prepublishOnly).toContain('test');
  });

  it('README has badge placeholders and publish status', () => {
    const readme = readFileSync(join(pkgRoot, 'README.md'), 'utf8');
    expect(readme).toContain('img.shields.io/npm/v/@wildwindow/geoprivacy');
    expect(readme).toContain('License-MIT');
    expect(readme).toContain('Not published to npm yet');
    expect(readme).toContain('docs/launch/geoprivacy-publish.md');
    expect(readme).toContain('https://github.com/arsalan-arshad/wildwindow');
  });

  it('LICENSE and CHANGELOG ship with the pack', () => {
    const license = readFileSync(join(pkgRoot, 'LICENSE'), 'utf8');
    const changelog = readFileSync(join(pkgRoot, 'CHANGELOG.md'), 'utf8');
    expect(license).toContain('MIT License');
    expect(changelog).toContain('0.1.0');
    expect(changelog).toContain('T10.1');
  });
});
