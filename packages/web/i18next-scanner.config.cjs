// i18next-scanner configuration for VNInvest @vninvest/web (CJS for scanner 4.6 CLI)
// Scanner loads config via `require()`, so ESM `export default` would be wrapped as {default: ...}.
// Use .cjs + module.exports to avoid the ESM wrapper bug that caused `config.input.map` TypeError.
// See audit F-I18N-15 (docs/AUDIT_SCREENER_P1_FULL_20260913.md).

module.exports = {
  input: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/components/vninvestcharts/**',
    '!node_modules/**',
    '!dist/**',
  ],
  output: './',
  options: {
    debug: true,
    removeUnusedKeys: false,
    sort: true,
    func: {
      list: ['t', 'i18n.t', 'translate'],
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    trans: false,
    lngs: ['vi', 'en'],
    defaultLng: 'vi',
    defaultNs: 'translation',
    defaultValue: '__STRING_NOT_TRANSLATED__',
    resource: {
      loadPath: 'src/i18n/{{lng}}.js',
      savePath: 'src/i18n/{{lng}}.json',
      jsonIndent: 2,
    },
    nsSeparator: ':',
    keySeparator: '.',
    plural: false,
    context: false,
  },
};
