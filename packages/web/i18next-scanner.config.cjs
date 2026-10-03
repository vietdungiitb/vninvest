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
    // R5.2 — file locale là output của scanner, KHÔNG phải source để quét.
    // Trước đây chúng nằm trong `input` nên scanner cố `JSON.parse` chúng và
    // báo `SyntaxError: "const vi =" is not valid JSON`, rồi vẫn exit 0 — cổng
    // gate trở nên vô nghĩa. Việc phát hiện chuỗi hardcode do
    // `scripts/check-i18n-hardcoded.mjs` đảm nhiệm, cổng đó fail thật.
    '!src/i18n/**',
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
      // R5.2 — locale file là ESM JavaScript (`const vi = {...}`), không phải
      // JSON. Trỏ `loadPath` vào cache sẽ khiến scanner `JSON.parse` chúng và
      // báo `SyntaxError: "const vi =" is not valid JSON`, rồi vẫn exit 0 —
      // cổng gate vô dụng. Trỏ sang thư mục cache (đã nằm trong .gitignore) để
      // scanner chỉ sinh báo cáo, không đụng file locale thật.
      // Cổng phát hiện chuỗi hardcode thật sự là `check:i18n-hardcoded`.
      loadPath: 'node_modules/.cache/i18next-scanner/{{lng}}.json',
      savePath: 'node_modules/.cache/i18next-scanner/{{lng}}.json',
      jsonIndent: 2,
    },
    nsSeparator: ':',
    keySeparator: '.',
    plural: false,
    context: false,
  },
};
