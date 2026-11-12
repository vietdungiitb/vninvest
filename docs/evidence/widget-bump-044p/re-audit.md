# B8 re-audit — slice `widget-bump-044p`, nhánh `feat/widget-bump-044` (2026-11-11)

> Re-auditor B8, CHỈ ĐỌC (không sửa/commit/cài đặt). Phạm vi: working tree chưa commit của slice bump.
> Tái hiện mọi lệnh từ `D:/Mujoco Projects/vninvest` (PowerShell), trừ khi ghi chú khác.

## 1. `git status` + `git diff --numstat` — PASS

- Tái hiện: `git status --short` ; `git diff --numstat` ; `git diff --name-only` ; `git branch --show-current`
- Kết quả:
  - Nhánh: `feat/widget-bump-044`
  - Modified (2 file, đúng phạm vi slice):
    - `packages/web/package.json` — numstat `1 1`
    - `packages/web/package-lock.json` — numstat `4 4`
  - `packages/web/.npmrc` KHÔNG modified (lệnh `git status --short -- packages/web/.npmrc` và `git diff -- packages/web/.npmrc --stat` đều rỗng) — PASS
  - Untracked (4 file, KHÔNG do slice để lại — thuộc work khác `a4-roadmap` / plan song song):
    - `docs/PLAN_A4_ROADMAP_20261109.md`
    - `docs/PLAN_WIDGET_INTEGRATION_20261110.md`
    - `docs/evidence/a4-roadmap/AUDIT_PLAN_20261109.md`
    - `docs/evidence/a4-roadmap/B1_MEASURE_20261109.md`
  - Không có file lạ nào trong `packages/web/src`, `dist`, hay thư mục slice `docs/evidence/widget-bump-044p/` ngoài file này.

## 2. `packages/web/package.json` pin — PASS

- Tái hiện: `git diff -- packages/web/package.json`
- Kết quả: đúng 1 hunk, 1 dòng duy nhất đổi:
  - `-    "@vninvestcharts/widget-pro": "0.4.3",` → `+    "@vninvestcharts/widget-pro": "0.4.4",`
- Các pin khác giữ nguyên: `@vninvestcharts/widget: 0.4.4`, `@vninvestcharts/engine-core/drawing/react: 0.5.6` (đọc trực tiếp `package.json:73-75,108-109`).
- `package-lock.json` đồng bộ: `packages: "": "@vninvestcharts/widget-pro": "0.4.4"` (`:39`), `node_modules/@vninvestcharts/widget-pro` version `0.4.4` + `resolved: .../widget-pro/0.4.4/bffcb292...` + integrity mới (`:7148-7152`). Nested dep `@vninvestcharts/widget` trong widget-pro vẫn `0.4.3`-line (đúng như B3 đã ghi nhận, npm hoist bản top-level `0.4.4` — không chặn).

## 3. `node_modules` widget-pro 0.4.4 + `pine.worker.js` — PASS

- Tái hiện (từ repo root):
  - `node -e "const p=require('./packages/web/node_modules/@vninvestcharts/widget-pro/package.json'); console.log('version='+p.version)"` → `version=0.4.4`
  - `Get-Item packages/web/node_modules/@vninvestcharts/widget-pro/dist/pinescript/pine.worker.js` → TỒN TẠI, `Length 745571` bytes, `LastWriteTime 2026-11-11 4:38 PM`
- Khớp byte-for-byte với size tarball B3 đã đo (745571 bytes, `plan-audit.md:32`). Lưu ý đường dẫn đúng là `packages/web/node_modules/...` (repo root `node_modules/@vninvestcharts` KHÔNG tồn tại — kiểm tra `ls` báo `PathNotFound`, là bình thường vì frontend install trong `packages/web`).
- KHÔNG chạy `npm install` (tuân thủ read-only).

## 4. `C:\Temp\build3.log` (UTF-16LE, đọc đúng encoding) — PASS

- Tái hiện (KHÔNG chạy lại build, chỉ đọc log có sẵn):
  - `python3 -c "import pathlib; text=pathlib.Path(r'C:\Temp\build3.log').read_bytes().decode('utf-16-le'); ..."`
- Kết quả: file BOM `fffe`, `66920` bytes, `305` dòng.
  - Dòng 2-3: `> @vninvest/web@0.1.0 build` / `> tsc && vite build` — `vite build` đã chạy ⇒ `tsc` exit 0 (chuỗi `&&`).
  - Quét `error` (case-insensitive) toàn log: 1 hit duy nhất ở dòng 14 là text wrapper của PowerShell (`FullyQualifiedErrorId : NativeCommandError` do log stderr của `node.exe`), KHÔNG phải lỗi biên dịch. **0 dòng `error TS`**, 0 `ELIFECYCLE`, không còn lỗi `pine.worker.ts`.
  - Bằng chứng build thành công: dòng 305 `built in 35.07s`; dòng 144 emit `dist/assets/pine.worker-Bv_uslVp.js 257.65 kB` — worker đã được bundle từ `pine.worker.js` của 0.4.4.
- Kết luận: `tsc` + `vite build` exit 0. PASS.

## 5. Grep `ghp_` (trừ node_modules/dist) — PASS

- Tái hiện:
  - `grep ghp_ packages/web/package.json` → 0 hit; `grep ghp_ packages/web/package-lock.json` → 0 hit (riêng lẻ từng file, do shell Windows không có `grep -r` pipe).
  - Grep toàn repo: 42 match, đối chiếu từng hit — toàn bộ pre-existing, KHÔNG do slice để lại: scanner `packages/web/scripts/scan-secrets.mjs` (rule + fixture dummy `ghp_1234...` + docstring), regex test `packages/core/backend/tests/test_ai_audit_logs.py:47`, docs archive/SEC-01 (`SEC-01-REPORT.md`, `AUDIT_VERIFICATION_20260926.md`), placeholder `SYSTEM-CONNECTIVITY-TROUBLESHOOT-20260513.md` (`ghp_your_github_token_here`), và re-audit cũ `docs/evidence/widget-bump-044/re-audit.md:49-53` (đã xác minh 39 match cũ).
  - `.npmrc` (đọc trực tiếp): chỉ 2 dòng — registry + `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}` (tham chiếu ENV, không chứa secret thô). Không modified (mục 1).
- Kết luận: 0 secret nào do slice để lại. PASS.

## 6. `docs/evidence/widget-bump-044p/plan-audit.md` B3 PASS còn hiệu lực — PASS

- Đã đọc toàn file (57 dòng). B3 verdict PASS với root cause 0.4.4: tarball ship `dist/pinescript/pine.worker.js` (745571 bytes), `register.js:27491` / `register.cjs:27512` trỏ `.js`, 0 hit `pine.worker.ts` toàn `dist`.
- Đối chiếu phạm vi slice này: `node_modules` thực tế sau install khớp đúng tarball B3 đã forensics (cùng version 0.4.4, cùng size worker 745571 bytes — mục 3), và build log chứng minh lỗi worker đã hết (mục 4).
- Lưu ý duy nhất B3 để lại (nested `@vninvestcharts/widget 0.4.3` trong widget-pro, `plan-audit.md:48-51`) vẫn đúng ở lock hiện tại nhưng không gây lỗi (npm hoist top-level 0.4.4; build xanh là bằng chứng).
- Kết luận: B3 PASS còn hiệu lực cho phạm vi này. PASS.

## Blocker / Major còn lại

- Blocker do slice gây ra: **0**.
- Major do slice gây ra: **0**.
- Ghi nhận (không chặn): 4 file untracked thuộc work khác (`a4-roadmap`, 2 PLAN) nằm ngoài phạm vi slice — B8 không kết luận nguồn gốc, để coordinator phân xử; không ảnh hưởng verdict bump.
- E2E / staging: **CHƯA CHẠY** (chấp nhận được theo yêu cầu slice; ngoài phạm vi re-audit read-only này).

## Verdict cuối: ĐẠT

6/6 mục PASS, 0 blocker/major do slice gây ra. E2E/staging ghi CHƯA CHẠY là chấp nhận được.
