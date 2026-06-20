import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/', 'node_modules/', 'visual-baselines/', '*.config.js', '*.config.ts'],
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
    },
    settings: {
      react: {
        version: '18.3',
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx'],
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      import: importPlugin,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Prevent stale closures in hooks
      'react-hooks/exhaustive-deps': 'error',
      // Prevent missing cleanup in useEffect
      'react-hooks/rules-of-hooks': 'error',
      // FSD Boundary Rules (warn for now, error after migration)
      // shared/ can be imported by anyone
      // entities/ can be imported by features/, widgets/, pages/
      // features/ can be imported by widgets/, pages/
      // widgets/ can be imported by pages/
      // pages/ cannot be imported by anyone (leaf)
      // app/ cannot be imported by anyone (leaf)
      // processes/ can be imported by pages/
      'import/no-restricted-paths': [
        'warn',
        {
          zones: [
            {
              target: './src/shared',
              from: './src',
              except: [
                './src/app',
                './src/pages',
                './src/widgets',
                './src/features',
                './src/entities',
                './src/processes',
                './src/shared',
              ],
            },
            {
              target: './src/entities',
              from: './src',
              except: [
                './src/features',
                './src/widgets',
                './src/pages',
                './src/processes',
              ],
            },
            {
              target: './src/features',
              from: './src',
              except: [
                './src/widgets',
                './src/pages',
                './src/processes',
              ],
            },
            {
              target: './src/widgets',
              from: './src',
              except: [
                './src/pages',
                './src/processes',
              ],
            },
            {
              target: './src/pages',
              from: './src',
              except: [],
            },
            {
              target: './src/app',
              from: './src',
              except: [],
            },
            {
              target: './src/processes',
              from: './src',
              except: [
                './src/pages',
              ],
            },
          ],
        },
      ],
      // Enforce explicit imports (no barrel file abuse)
      'import/no-extraneous-dependencies': [
        'warn',
        {
          devDependencies: [
            '**/*.test.{js,jsx}',
            '**/*.spec.{js,jsx}',
            '**/__tests__/**',
            '**/__mocks__/**',
            'scripts/**',
            '*.config.js',
            '*.config.ts',
          ],
        },
      ],
      // Prevent circular dependencies
      'import/no-cycle': 'warn',
      // Prefer named exports
      'import/prefer-default-export': 'off',
    },
  },
];