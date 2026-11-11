# B3 — Audit độc lập plan `PLAN_STAGING_PRO_JWK_20261111.md` (2026-11-11)

> Auditor B3, CHỈ ĐỌC. Mọi khẳng định dưới đây đã kiểm bằng file/lệnh thật, không tin plan.
> Phạm vi write duy nhất: file này.

## 1. Dockerfile + compose pattern — PASS (lệch số dòng nhẹ)

- `packages/web/Dockerfile:16-27`: ĐÚNG. ARG `VITE_API_URL` (:16), `VITE_WS_BASE_URL` (:17),
  `VITE_DISABLE_REALTIME_WEBSOCKET` (:18), `VITE_TURNSTILE_SITE_KEY` (:23) + ENV mapping (:24-27).
  Comment :19-22 giải thích vì sao phải ARG+ENV (Vite chỉ inject `VITE_*` lúc build).
- `docker-compose.staging.yml`: NỘI DUNG ĐÚNG, SỐ DÒNG LỆCH NHẸ. Plan ghi `:113-119`;
  thực tế block `frontend.build.args` ở `:113-120`, các dòng VITE ở `:117` (`VITE_API_URL: /api`)
  và `:119` (`VITE_TURNSTILE_SITE_KEY: ${VITE_TURNSTILE_SITE_KEY:-}`), thêm `:118` APP_RELEASE
  và `:120` GITHUB_TOKEN mà plan không liệt kê. Interpolation `${VAR:-}` lấy từ env-file trên VPS —
  khớp mô tả "secret không vào repo".
- Tái hiện: `read packages/web/Dockerfile` + `read docker-compose.staging.yml offset 112 limit 10`.

## 2. licenseKey prop + caller — PASS (khớp từng dòng)

- `packages/web/src/components/VNStockChartPanel.js:45`: ĐÚNG — `licenseKey,` trong destructure props
  (kèm comment P3.4-license :42-44). `:292`: ĐÚNG — `licenseKey: licenseKey ?? undefined,`
  forward cho widget + comment :290-291. `onLicenseDiagnostic` ở :47/:293 cũng tồn tại.
- `packages/web/src/pages/StockDetailPage.tsx:279-293`: ĐÚNG — `e(VNStockChartPanel, {...})` truyền
  symbol/env/onBarsChange/loading/activePeriod/activeTimeframe/callbacks/orderFlowData/whaleSignals/
  workspaceId, KHÔNG có `licenseKey`. Khẳng định "render panel NHƯNG chưa truyền licenseKey" chính xác.

## 3. engine-core coupling — PASS cả hai chiều

- Grep `@vninvestcharts/engine-core` trong `packages/web/src`: **0 hit** — khẳng định
  "App chưa import engine-core ở đâu" ĐÚNG. Tái hiện: `grep path=packages/web/src pattern=@vninvestcharts/engine-core`.
- `node_modules/@vninvestcharts/engine-core/dist/index.d.ts`: `declare function addLicensePublicKey`
  ở **:2129** (cùng `setLicensePublicKey` :2127, `getLicensePublicKeys` :2131,
  `resetLicensePublicKey` :2132, interface `LicensePublicKey` :2073) VÀ có mặt trong block
  `export {...}` (~:2280, đã tách token xác nhận `addLicensePublicKey` nằm trong export list).
  ⇒ `import { addLicensePublicKey } from '@vninvestcharts/engine-core'` khả thi. PASS.
- Lưu ý: node_modules hiện tại là của nhánh bump (engine 0.5.6, xem §5) — API này tồn tại ở 0.5.6;
  engine 0.5.5 trên `dev` CHƯA kiểm (không checkout dev ở đây). Đây chính là lý do phụ thuộc merge-first là đúng.

## 4. Staging deploy `dev` — PASS một nửa, VPS CHƯA XÁC MINH

- `scripts/deploy-staging.sh:13`: ĐÚNG — `REPO_BRANCH="${REPO_BRANCH:-dev}"`. Deploy flow
  (`git fetch/checkout/pull --ff-only` :125-127, `compose config` :133, build :136, up :141) khớp mô tả plan.
- `/opt/vninvest` trên VPS 14.225.255.47: **CHƯA XÁC MINH** — không SSH từ session này
  (read-only, không lệnh remote). Ghi rõ như plan yêu cầu: Owner/đợt deploy xác nhận sau.

## 5. Bump branch `feat/widget-bump-044` — PASS (plan nói "chưa merge" là ĐÚNG)

- `git branch --show-current` → `feat/widget-bump-044` (session đang đứng trên chính nhánh bump).
- `git branch -r --contains feat/widget-bump-044` → chỉ `origin/feat/widget-bump-044`, không có `origin/dev`.
- `git merge-base --is-ancestor feat/widget-bump-044 dev` → **exit=1** (không phải ancestor ⇒ chưa merge vào dev).
- Đối chiếu version: `git show dev:packages/web/package.json` → widget 0.4.1 / engine 0.5.5;
  `packages/web/package.json` trên nhánh hiện tại → widget 0.4.4 / engine 0.5.6 (`:73-75`, `:108-109`).
  ⇒ Khẳng định blocker của plan (staging chạy dev = 0.4.1/0.5.5, bump chưa merge) ĐÚNG; phụ thuộc
  merge-first trong plan là ĐÚNG và bắt buộc, không phải thận trọng thừa.

## 6. Plan có thiếu gì không — 1 NEED_REVISION nhẹ + 1 PASS

- (a) Fail-before test khả thi — PASS. `vnstock-chart-panel.data-unlock.component.test.ts:17-29`
  đọc source bằng `readFileSync` (pattern quét nguồn, không render widget). Mở rộng kiểu
  `expect(src).toMatch(/ensureLicenseTrustAnchor/)` / `expect(stockDetailSrc).toMatch(/VITE_VNINVEST_LICENSE_KEY/)`
  hoàn toàn cùng pattern — G1 ("chạy test mới THEN FAIL") thực hiện được, không cần hạ tầng thêm.
- (b) `VITE_VNINVEST_LICENSE_KEY` thiếu ở `compose.staging.env.example` — ĐÚNG LÀ THIẾU
  (file tồn tại, 135 dòng; grep `VITE_` chỉ hit :73/:75 là `VITE_TURNSTILE_SITE_KEY`).
  Với build-arg dạng `${VITE_VNINVEST_LICENSE_KEY:-}` thì `compose config` không vỡ khi thiếu key,
  nên đây KHÔNG phải blocker; nhưng thiếu placeholder + comment (theo đúng pattern :73-75 của
  Turnstile) thì Owner lên VPS không có chỗ chép key theo mẫu. → **OBJECTION O1**.

## Objections (2/3 quota)

- **O1 [NEED_REVISION, nhẹ] — `compose.staging.env.example` thiếu key mới.** Bổ sung vào plan scope
  (1 file text, không phải secret): thêm `VITE_VNINVEST_LICENSE_KEY=` + comment giải thích build-arg,
  cạnh `VITE_TURNSTILE_SITE_KEY` (`compose.staging.env.example:73-75`). Không làm thì config vẫn chạy
  (nhờ `:-`), nhưng Owner thiếu mẫu chuẩn khi điền key trên VPS.
- **O2 [NOTE, không chặn] — số dòng compose trong plan lệch (~:113-119 vs thực tế :116-120, thiếu
  APP_RELEASE/GITHUB_TOKEN trong liệt kê).** Nội dung đúng, chỉ cần sửa số dòng khi viết docs/gates;
  không ảnh hưởng implementability.

## Verdict cuối

**Plan KHẢ THI, duyệt có điều kiện: sửa O1 trước khi mở PR** (thêm placeholder vào `.example`,
rẻ, đúng pattern Turnstile sẵn có). Mọi khẳng định blocker đã đứng vững bằng bằng chứng:
prop/license-forward tồn tại, caller chưa truyền, engine-core export `addLicensePublicKey`,
bump thật sự chưa vào `dev` (dev=0.4.1/0.5.5 vs nhánh=0.4.4/0.5.6) nên merge-first là bắt buộc.
Phần không kiểm được từ đây: `/opt/vninvest` + key/JWK trên VPS (CHƯA XÁC MINH — Owner xác nhận
lúc deploy); API `addLicensePublicKey` mới chỉ xác nhận ở engine 0.5.6, không suy ra 0.5.5 có.
Fail-before theo pattern quét nguồn hiện tại là khả thi, không cần hạ tầng thêm.
