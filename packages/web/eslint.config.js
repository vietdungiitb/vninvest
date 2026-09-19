import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/', 'node_modules/', 'visual-baselines/', '*.config.js', '*.config.ts', '**/*.d.ts'],
  },
  // Vendored third-party charting library: do not lint (overwritten on update,
  // ships its own eslint config). Legacy VNInvestCharts.js is first-party but a
  // large pre-existing orchestrator excluded from the strict hook rules.
  {
    ignores: [
      'src/components/vninvestcharts/**',
      'src/components/VNInvestCharts.js',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        browser: true,
        es2022: true,
        node: true,
        React: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: {
        version: '18.3',
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      import: importPlugin,
      react: reactPlugin,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-alert': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react/jsx-no-literals': ['warn', {
        noStrings: true,
        allowedStrings: ['loading', 'error', 'not-found', '404', 'empty'],
      }],
      'import/no-extraneous-dependencies': [
        'warn',
        {
          devDependencies: [
            '**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}',
            '**/__tests__/**', '**/__mocks__/**', 'scripts/**',
            '*.config.js', '*.config.ts',
          ],
        },
      ],
      'import/no-cycle': 'warn',
      'import/prefer-default-export': 'off',
    },
  },
  // TypeScript files: use @typescript-eslint parser + plugin
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      import: importPlugin,
      react: reactPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-alert': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react/jsx-no-literals': ['warn', {
        noStrings: true,
        allowedStrings: ['loading', 'error', 'not-found', '404', 'empty'],
      }],
      'import/no-extraneous-dependencies': [
        'warn',
        {
          devDependencies: [
            '**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}',
            '**/__tests__/**', '**/__mocks__/**', 'scripts/**',
            '*.config.js', '*.config.ts',
          ],
        },
      ],
      'import/no-cycle': 'warn',
      'import/prefer-default-export': 'off',
    },
  },
  // Shell layer (createElement convention): pages/shell/* and adapters/* use no-JSX
  {
    files: ['src/adapters/**/*.{js,ts}'],
    rules: {
      'react/jsx-no-literals': 'off',
    },
  },
  // Business pages and components: JSX allowed, i18n enforced
  {
    files: ['src/pages/**/*.{jsx,tsx}'],
    rules: {
      'react/jsx-no-literals': ['warn', {
        noStrings: true,
        allowedStrings: ['loading', 'error', 'not-found', '404', 'empty', 'Đang xử lý...'],
      }],
    },
  },
];
