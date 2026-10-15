# SUMMARY — slice FE Wave 3 (`feat/mbw3-fe`)

Ngày: 2026-10-15 · Worktree: `C:/MujocoProjects/agent-mbw3-fe` · Nhánh: `feat/mbw3-fe`
(đã push origin, KHÔNG merge — supervisor hợp nhất vào `feat/mbw3-isolation`)

## 1. Commits (11, nhỏ, qua file `git commit -F`)

| SHA | Nội dung |
|---|---|
| `9206441a7` | khai claim mbw3-fe |
| `8c9922375` | test fail-before TDD (5 file, chạy ĐỎ đã kiểm chứng lại trên VPS) |
| `11fe953e6` | adapter `broker.js`: GET bindings + watchlist scoped/derived (giữ PATCH save) |
| `62aedd928` | i18n `brokerWave3.*` (vi + en, 1 khối) |
| `89e153243` | BindingsPanel B3.1 (list GET + add/remove 2 bước + convert kind) |
| `9d78efd72` | B3.2-FE holdings (banner aggregate + unknown fail-closed) |
| `a9420f835` | B3.3-FE ScopedWatchlist (filter scope + derived tách riêng) |
| `1d44abbe3` | FE-MERGE UserSettings → `/broker` |
| `aa7b7382e` | FE-DUPID 1 entry `portfolios-manage` |
| `1a98db915` | FE-STATUS pin `{FILLED, MATCHED}` + giới hạn pass-through |
| `9427f0038` | sửa test unknown (`getAllByText`) + comment FE-MERGE `BrokerSettingsSection` |

(Các commit trước `9206441a7` thuộc plan/claim chung wave, không phải code FE.)

## 2. Files (trong scope, không chạm ngoài)

- `packages/web/src/adapters/core/broker.js` — thêm `getPortfolioBindings` (GET),
  `getWatchlistsScoped({provider, brokerAccountId})`, `getDerivedWatchlist(accountId)`
  (FE-compute từ account+positions, read-only); giữ `savePortfolioBindings` PATCH
  (cả 3 action `add/remove/convert` qua 1 hàm, đúng contract §2).
- `packages/web/src/pages/broker/BindingsPanel.tsx` (mới, 425 dòng) + test (7 tests).
  List từ GET (bóc envelope `data/results/mảng`), add/remove confirm 2 bước,
  role select mặc định `secondary`, convert kind mirror bảng chuyển làn §2
  (BE là nguồn sự thật), kind vắng ⇒ khóa convert fail-closed.
  **CHƯA MOUNT vào `BrokerAccountPage`** — file đó ngoài scope ⇒ báo supervisor (§5).
- `packages/web/src/components/brokerData/ScopedWatchlist.tsx` (mới) + test —
  manual theo scope + derived section riêng, nhãn `Đang nắm giữ @ …`,
  empty-copy khác nhau (ADR-007).
- `packages/web/src/pages/portfolio/PortfolioHoldingsPage.tsx` — banner aggregate
  chỉ-đọc + banner unknown fail-closed khi `kind` vắng (BE chưa deploy BE-KIND);
  trang vốn read-only nên banner là observable khóa, giữ nguyên 13 cột.
- `packages/web/src/pages/UserSettingsPage.tsx` — khối DNSE cũ thành khối dẫn
  link `/broker` (`brokerWave3.settings.*`); redirect cũ giữ trong `main.tsx`.
- `packages/web/src/components/BrokerSettingsSection.tsx` — CHỈ thêm comment
  FE-MERGE (giữ hành vi, test cũ khóa); không còn mount ở route app nào.
- `packages/web/src/app/routeCatalog.js` — FE-DUPID: giữ entry
  `portfolios-manage` + `portfoliosManage.title`, xoá entry trùng
  `routes.portfolios`, dời comment D-01. `pageRegistry.js`/`main.tsx` đọc rồi:
  **không cần sửa** (map `portfolios-manage` → `core-portfolios` đã đúng).
- `packages/web/src/components/brokerData/sourceBadge.tsx` — FE-STATUS:
  `MATCHED_ORDER_STATUSES={FILLED,MATCHED}` cấp module + `isMatchedOrder`/
  `filterMatchedOrders` + ghi giới hạn pass-through trong comment (BE chưa có
  enum chuẩn SSI/TCBS — ticket follow-up BE).
- `packages/web/src/i18n/vi.js` + `en.js` — CHỈ khối `brokerWave3.*` (44 + 43 key).
- Evidence mới: `docs/evidence/mbw3/fe-gates.md`, `i18n-verify.md`, `vps-fe-probe.md`.
- `docs/STAGING_VPS_RUNBOOK.md` — CHỈ §12.4 (theo thực tế probe).
- Không chạm: `packages/core/**`, `soc.module.css`, deny-list, ledger, claim người khác.

## 3. Gates (lệnh + exit + NƠI CHẠY)

Local (§12.2): `npx tsc --noEmit` → 0 · `npx eslint` 9 file → 0 (warnings cùng họ
code cũ) · DUPID grep `id: "portfolios-manage"` → đúng 1 · dead-link/`soc.module`
grep → 0 sót.
VPS (§12.4, `/tmp/wt-mbw3-fe-vps`): vitest 5 file → 0 (**20/20**) · control
`BrokerSettingsSection` → 0 (**5/5**) · fail-before @`8c9922375` → 1
(**5/5 files failed**: import-error ×2, assertion ×2, TypeError ×1 — textbook) ·
`i18n:scan:strict` → 0 · `build` → 0 (31.99 s) · bundle `/broker` **1361.0 KB**,
`/broker/accounts/:accountId` **1356.5 KB** (≤1450, không echarts/xlsx tải đầu).
Chi tiết: `docs/evidence/mbw3/fe-gates.md` + `vps-fe-probe.md`.

## 4. CHƯA CHẠY + lý do

- E2E 2 SubAccount thật — ngoài wave (TEST-E2E, plan §0 non-goals).
- Full FE suite — chỉ chạy 5 file slice + 1 control; full suite thuộc Pha 3 supervisor.
- Regression BE DB tạm — việc slice BE.
- Chữ ký PM cho cặp ĐỎ/xanh + i18n ≥3 key — worker đã đối chiếu tay 4 key
  (`i18n-verify.md`), chờ PM ký.

## 5. Risks / out-of-scope (cho supervisor)

1. **B3.1-mount (quyết định):** `BindingsPanel` chưa mount vào
   `/broker/accounts/:accountId` vì `BrokerAccountPage.tsx` ngoài scope file.
   Mount cần sửa file đó (thêm section/tab "Gộp danh mục" dưới `BrokerSyncCenter`,
   truyền `accountId` để preselect — panel đã hỗ trợ prop). Không tự sửa.
2. **AC2/AC3 phía BE:** `broker_backed_single_account`, `convert_*`,
   `aggregate_read_only` là hành vi BE (`feat/mbw3-be`, chưa merge) — FE chỉ
   mirror client-side + test bằng adapter mock. Verify đầu-cuối cần cả 2 nhánh
   trên nhánh tích hợp.
3. Test đỏ lần 1 trên VPS (`getByText` trùng) cho thấy suite chưa từng chạy trước
   đó — từ nay mọi test mới phải có log VPS trước khi coi xong (O-1).
4. `soc.module-*.js` vẫn xuất hiện trong graph `/broker` (từ component cũ, không
   phải file mới) — không tăng do slice này; dọn thuộc việc khác.

## 6. Lesson (vào skill project nếu supervisor đồng ý)

- L-VPS-01: VPS có node nhưng không có npm — `corepack prepare npm@<ver>` +
  gọi `/usr/bin/corepack npm` (PATH rỗng trong ssh non-interactive).
- L-VPS-02: `worktree remove` TRƯỚC khi dời `node_modules` ⇒ mất 733 MB —
  luôn dời/tái dùng trước khi remove; verify `diff -q package-lock.json`.
- L-VPS-03: không copy `node_modules` Windows-local lên VPS (native binary khác
  platform) — `npm ci` trên VPS hoặc tái dùng bản Linux có sẵn.
- L-TDD-01: test dùng regex `getByText(/…/i)` trên UI có nhãn + ghi chú cùng từ —
  luôn `getAllByText` hoặc chuỗi cụ thể hơn.

## 7. Đường merge (đừng merge)

`feat/mbw3-fe` (HEAD `9427f0038`, đã push) → supervisor review →
merge vào `feat/mbw3-isolation` cùng `feat/mbw3-be` → 1 PR → `dev`.
Dọn sau merge: `git worktree remove /tmp/wt-mbw3-fe-vps` (+`/tmp/wt-mbw3-red` đã dọn),
`agent-cleanup.ps1 -Branch feat/mbw3-fe -Execute` sau khi nhánh tích hợp merge.
