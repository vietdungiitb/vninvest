# Re-audit độc lập (B8) — slice `widget-bump-044`

- Ngày: 2026-11-11 · Auditor: B8 (chỉ đọc, không sửa/commit/cài đặt)
- Nhánh: `feat/widget-bump-044` @ `7e2206fce` · Repo: `D:/Mujoco Projects/vninvest`
- Phạm vi: bump `@vninvestcharts/*` (plan `docs/PLAN_WIDGET_BUMP_044_20261111.md` §5+§6)

## 1. Scope diff — PASS

- `git diff --numstat` (workdir vs HEAD):
  - `docs/PLAN_WIDGET_BUMP_044_20261111.md` → `30 + / 0 -` (chỉ thêm §5+§6)
  - `packages/web/package.json` → `5 + / 5 -` (đúng kỳ vọng)
  - `packages/web/package-lock.json` → `51 + / 46 -`
- `git status --short`: đúng 3 file modified trên; `packages/web/.npmrc` (tracked) KHÔNG modified (`git diff --stat -- packages/web/.npmrc` rỗng).
- Untracked ngoài slice (không phải do slice này tạo — tên/ngày 20261109–20261110, trước slice 20261111):
  `docs/PLAN_A4_ROADMAP_20261109.md`, `docs/PLAN_WIDGET_INTEGRATION_20261110.md`, `docs/evidence/a4-roadmap/`.
- Tái hiện: `git -C "D:/Mujoco Projects/vninvest" diff --numstat`
  + `git -C "D:/Mujoco Projects/vninvest" status --short`.

## 2. Pins `packages/web/package.json` — PASS (5/5)

`@vninvestcharts/engine-core/drawing/react = 0.5.6`, `widget = 0.4.4`, `widget-pro = 0.4.3`.
Diff đúng 5 dòng cũ (`0.5.5 ×3`, `0.4.1 ×2`) → 5 dòng mới.
Tái hiện: `Select-String -Path "D:\Mujoco Projects\vninvest\packages\web\package.json" -Pattern "vninvestcharts"`.

## 3. Version đã cài + lock — PASS (5/5)

- `node_modules/@vninvestcharts/{widget,engine-core,engine-drawing,engine-react,widget-pro}/package.json`
  → `0.4.4 / 0.5.6 / 0.5.6 / 0.5.6 / 0.4.3`, khớp lock (`package-lock.json:7060-7161`).
- Ghi chú (không phải finding): `widget-pro@0.4.3` lock khai deps `engine-pro 0.4.1` + nested `widget 0.4.3` — spec của upstream, ngoài phạm vi slice.

## 4. Build logs (`C:\Temp\build.log` UTF-16LE, `build2.log`) — PASS, KHÔNG chạy lại build

- `build.log:17`: `[commonjs--resolver] Could not resolve entry module
  "node_modules/@vninvestcharts/widget-pro/dist/pinescript/pine.worker.ts"`, file `.../widget-pro/dist/register.js`.
- `build2.log:17`: `Rollup failed to resolve import "@vninvestcharts/widget-pro/register"
  from ".../widget/dist/chunk-KAHILD6F.js"`.
- Tự xác minh chuỗi (không tin plan mù):
  - `widget/dist/chunk-KAHILD6F.js:5` chứa `import("@vninvestcharts/widget-pro/register")` (dynamic).
  - `widget-pro/dist/register.js:27491` chứa `new Worker(new URL("./pinescript/pine.worker.ts", import.meta.url))`.
  - `widget-pro/dist/pinescript/` KHÔNG tồn tại (`Get-Item` → `PathNotFound`).
- ⇒ Root cause đúng như plan §6: **bug đóng gói upstream** (widget 0.4.4 chunk import `widget-pro/register`;
  `widget-pro@0.4.3` trỏ worker `.ts` không ship). Không phải do code app.
- CHƯA XÁC MINH (forensics tarball `C:\Temp\wforen` đã xóa, node_modules đã ghi đè):
  claim "widget 0.4.1 không có import này" và "widget-pro 0.4.1 cũng lỗi tương tự".
  Không ảnh hưởng verdict vì lỗi trên bản mới đã xác minh trực tiếp.

## 5. Secret/temp files — PASS

- `grep ghp_` toàn repo → 39 match, **toàn bộ pre-existing**: scanner `scan-secrets.mjs` (rule+fixture dummy),
  regex docs, placeholder (`ghp_your_github_token_here`), archive SEC-01. **0 hit** trong 3 file slice,
  `.npmrc`, hay file untracked cùng kỳ.
- Không có file temp chứa secret nào do slice tạo trong repo.
- Tái hiện: `grep -r "ghp_" D:/Mujoco Projects/vninvest` (đối chiếu từng hit với danh sách trên).

## Blocker / Major

- Do slice này gây ra: **0 blocker, 0 major**.
- Upstream (ngoài slice, Owner đã quyết định CHỜ widget team fix — plan §6):
  **1 blocker**: `npm run build` FAIL exit 1 với `widget@0.4.4 + widget-pro@0.4.3` hiện tại
  (chuỗi chunk-KAHILD6F → widget-pro/register → pine.worker.ts thiếu).
  `npm run build`/E2E trên bản mới giữ nguyên CHƯA CHẠY tới khi có bản vá — đúng trạng thái, không phải nợ của slice.

## Verdict: ĐẠT

Slice thực hiện đúng kỳ vọng (pins + lock + node_modules + plan §5+§6 khớp nhau, không secret,
không file thừa); build fail là blocker upstream đã được định danh đúng và Owner đã chốt hướng xử lý.
