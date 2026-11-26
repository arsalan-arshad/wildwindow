import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import { flatConfigs as importX } from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const configDir = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (packages/config/eslint → ../../..). */
const repoRoot = path.resolve(configDir, '../../..');

/**
 * Shared ESLint flat config for WildWindow packages and apps.
 * `no-console` is off only under `apps/worker`.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/cdk.out/**',
      '**/pnpm-lock.yaml',
      'eslint.config.js',
      '.prettierrc.js',
      'packages/config/eslint/**',
      'packages/config/prettier/**',
      'apps/web/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    ...importX.recommended,
    rules: {
      ...importX.recommended.rules,
      // TypeScript / NodeNext already resolve modules; avoid flaky Node16 resolver.
      'import-x/no-unresolved': 'off',
      'import-x/named': 'off',
      'import-x/namespace': 'off',
      'import-x/default': 'off',
    },
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: repoRoot,
      },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ['**/apps/worker/**/*.{ts,tsx,js,mjs,cjs}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // NestJS modules/controllers are decorator-driven empty classes.
    files: ['**/apps/api/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
