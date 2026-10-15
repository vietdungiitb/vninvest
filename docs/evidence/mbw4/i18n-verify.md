# i18n verify — mbw4 (`brokerWave4.*`)

Ngay: 2026-10-15 · `npm run i18n:scan:strict` tren VPS: **exit 0** (0 thieu).

- Khoi moi `brokerWave4.ops` (32 key) trong `packages/web/src/i18n/vi.js` (full dau) +
  `packages/web/src/i18n/en.js`, noi tiep `brokerWave3.*` (`vi.js:2362`/`en.js:2365`).
- Panel dung `t("brokerWave4.ops.<key>", { defaultValue })` (mau BindingsPanel) + helper `wv()`.
  Audit FE xac minh 66 match: moi key deu ton tai ca 2 locale.
- Sau audit-loop: xoa key thua `laneTitle` (panel dung `lastRun`), xoa CSS chet
  `.brokerLaneGrid`/`.brokerBadgeBad`; `killConfirm` dung lam `confirmText`.
- Luu y test: `t()` khong provider tra `defaultValue` → test assert chu that, khong assert key.
