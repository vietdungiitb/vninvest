// i18next-scanner configuration for VNInvest @vninvest/web
// Scans source files for i18n t() calls and generates a translation key inventory

export default {
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
