# Task 3 — Gates & evidence (FE mapper + adapter + panel wiring)

## Blocker môi trường (ghi nhận trung thực)

- `npm ci` đầy đủ trên VPS **BLOCKED**: E401 `npm.pkg.github.com/download/@vninvestcharts/engine-react@0.5.8` — thiếu `GITHUB_TOKEN` (read:packages) cho registry `@vninvestcharts` (`packages/web/.npmrc:1-2`). Không có `/root/.npmrc`; cache 585M thiếu đúng tarball engine 0.5.8 (`npm ci --offline` → ENOTCACHED). Mở khóa: Owner cấp token transient trên VPS rồi chạy lại `npm ci` + suite đầy đủ (vitest panel + jest toàn bộ).
- Hệ quả: suite FE chính thức (jest repo + vitest) **CHƯA CHẠY**. Static gate vẫn chạy: `node --check` 5 file PASS, `eslint` 0 errors, `tsc --noEmit` (qua pre-push-gate).

## Fail-before (RED) — VPS staging, jest env tối giản

- Vì blocker trên, dùng env cô lập `/tmp/wne-jestenv` (jest 29.7.0 + babel-jest 30.4.1 + jsdom 29.1 + testing-library, đúng major repo, cài từ public registry — không chạm lockfile repo), chạy trên worktree `/tmp/wt-wne-fe` tại commit test-only `71fed09ae`, symlink `node_modules` để resolver hoạt động như install thật.
- Lệnh: `jest --rootDir /tmp/wt-wne-fe/packages/web src/utils/corporateEventMapper.test.js`
- Kết quả: `Test Suites: 1 failed` — `Cannot find module './corporateEventMapper.js' from 'src/utils/corporateEventMapper.test.js'`. Đỏ đúng chỗ thiếu module (log `/tmp/wne_fered.log`).
- Quirk setup (đã vượt qua, ghi để slice sau khỏi làm lại): setupTests.js cần `@testing-library/jest-dom` (bổ sung vào env); resolver trong rootDir cần symlink `node_modules` (không có symlink thì fail import setup, che mất red thật).

## PASS (GREEN) — VPS staging, 2026-11-23 (jest env tối giản, xem blocker trên)

- Lệnh: worktree `/tmp/wt-wne-fe` cập nhật tới commit implementation `a74996653`, cùng jest env + symlink `node_modules`.
- Kết quả: `Test Suites: 1 passed`, `Tests: 9 passed, 9 total` (control epoch `1727110800000` ghim cứng PASS; DIV→D, ISS→S, XYZ→N, null-safety, limit slice).
- Quirk: teardown/jest exit code đọc từ log (`Tests:`), không tin exit code trần (bài học từ BE teardown race).
- Panel data-unlock test (vitest 4.1.9 tối giản `/tmp/wne-vitenv`, config trần, environment node — test này chỉ đọc source + regex, không cần vite/jsdom): `Test Files 1 passed`, `Tests 21 passed (21)` — gồm S5 mới (`showCorporateEvents: true` + `corporateEventsMode: 'live'` + ref `corporate-actions` + `fetchCorporateEvents`). Log VPS: `/tmp/wne_panel2.log`.
- Static gate: `node --check` 5/5 PASS, `eslint` 0 errors, `tsc --noEmit` 0 errors (qua pre-push-gate lúc push).
- CHƯA CHẠY (ghi nhận + unblock): suite repo đầy đủ (`npm run test`, `test:components` toàn bộ, `vite build`, staging curl/screenshot endpoint mới). Nguyên nhân: `npm ci` kẹt E401 thiếu `GITHUB_TOKEN` (read:packages) cho registry `@vninvestcharts` — cần Owner/token transient trên VPS rồi chạy lại theo `docs/STAGING_VPS_RUNBOOK.md` §12.3–12.4. Deploy staging-verify endpoint mới cũng cần quyết định deploy slice (coordinator).
- Dọn VPS: `worktree remove --force /tmp/wt-wne-fe` + `prune` (worktree agent khác không chạm). Giữ `/tmp/wne-jestenv`, `/tmp/wne-vitenv` + log để chạy lại khi có token.
