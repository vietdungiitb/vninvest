export default [
  {
    ignores: ['dist/', 'node_modules/', 'visual-baselines/', '*.config.js', '*.config.ts'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true,
      },
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
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
];
