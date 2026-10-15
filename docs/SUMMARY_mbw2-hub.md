# SUMMARY — Agent HUB (`mbw2-hub`): Wave 2 Broker Hub UI (B2.1 + B2.2 + B2.6)

- **Ngày:** 2026-10-15 · **Worktree:** `C:/MujocoProjects/agent-mbw2-hub` · **Nhánh:** `feat/mbw2-hub`
- **Plan:** `docs/PLAN_WAVE2_BROKER_HUB_20261015.md` §0–§4 (audit AGREE) · **AC:** AC1 + AC2 + AC6 + AC7-hub + AC8
- **Lessons áp dụng:** [L-001, L-002, L-006, L-008, L-A01, L-F09, L-F10]
  - L-001: chỉ sửa file trong scope HUB (§4), không chạm file DATA/BE/shared.
  - L-002: **NỢ QUY TRÌNH** — `docs/CLAIMS.md` không có claim `mbw2-hub`/`mbw2-data`
    (grep `mbw2` = 0 kết quả); task cấm sửa CLAIMS.md nên không tự khai. Cần
    PM/coordinator bổ sung claim để `docs/CLAIMS.md` còn là nguồn sự thật.
  - L-006: mọi PASS dưới đây kèm lệnh + exit code; chưa chạy ⇒ ghi CHƯA CHẠY.
  - L-008: chỉ commit/push nhánh `feat/mbw2-hub`, không commit thẳng `dev`.
  - L-A01: không dùng `git checkout --` (không cần revert lần nào).
  - L-F09: chọn lane qua `?provider=` — 1 handler = 1 patch `setSearchParams`
    full-state (`BrokerHubPage.tsx:handleSelectProvider`).
  - L-F10: hằng module cấp (`PROVIDER_PARAM_KEY`, `hubApi`, `brokerConnectApi`,
    `I18N_FALLBACK` có sẵn); `t` nằm trong mọi deps callback sinh thông điệp.
- **Checklist MANDATORY (plan §MANDATORY):**
  - [x] Không commit file shared ngoài claim; không commit thẳng dev
  - [x] Mọi PASS có lệnh + exit code (bảng Gates)
  - [x] Fail-before ĐỎ + control xanh (route-catalog-contract 3/3 trước khi code)
  - [x] `git status` sau lệnh ghi file; `git diff --numstat` trước stage (sạch)
  - [x] Không token/class vào `soc.module.css` (chỉ `import` barrel để đọc class);
        màu tăng/giảm không đụng (badge dùng tone SOC có sẵn); i18n đúng prefix
        `brokerHub.hub.*` + ngoại lệ duy nhất `routes.broker`
  - [ ] Claim khai + commit riêng TRƯỚC dòng code đầu — **CHƯA** (xem L-002 trên)

## Việc đã làm (B2.1 + B2.2 + B2.6)

1. **Route `/broker` sống (B2.1/AC1):** `pages/broker/BrokerHubPage.tsx` — 3 tile
   dnse/ssi/tcbs từ `getBrokerProviders`; badge chữ từ `GET /broker/capabilities/`
   (`Đã xác minh đầy đủ`/`Chờ xác minh`/`Chỉ đọc`/`Yêu cầu OTP` theo matrix
   versioned BE `broker/base.py`, không suy từ tên provider); trạng thái nối từ
   providers (`Đã kết nối`/`Chưa kết nối`). Lane `dnse` render lại
   `DNSEConnectionPanel` nguyên văn (0 dòng sửa).
2. **Form connect schema-driven 3 lane (B2.2/AC2):**
   `components/broker/BrokerConnectForm.tsx` — render input động từ
   `schema.fields` (`getBrokerSchema`), validate required → key
   `brokerHub.hub.errors.fieldRequired` cả VI/EN; lưu qua `saveBrokerConfig`,
   kiểm tra qua `testBrokerConnection`. Không hardcode field DNSE (test SSI chứng minh).
3. **Dời bề mặt cũ + redirect (B2.6/AC6):** `PortfoliosBrokerPage.tsx` thành redirect
   thuần `<Navigate to="/broker" replace />` + sửa comment stale C7 ("~28 chuỗi
   hardcode" — panel đã i18n xong từ `pf-manage-rebuild`); `main.tsx` redirect
   giữ query/hash; catalog entry cũ giữ + `deprecated/redirectTo`; mục menu
   `/broker` trong sidebar (icon `Radio` có sẵn trong map, labelKey `routes.broker`).
4. **Wiring:** catalog entry `broker` đủ 8 trường §2; registry entry `broker`;
   sidebar path có mặt trong catalog (gate menu-contract xanh).

## TDD (fail-before có bằng chứng)

| Step | Test | Đỏ trước | Xanh sau |
|---|---|---|---|
| Control | `route-catalog-contract` 3/3 xanh trước khi code | — | 29.55s |
| 1 | `BrokerConnectForm` 4 tests (SSI schema, chặn lưu thiếu field, lưu đủ, test-connection) | ĐỎ import fail | 4/4 |
| 2 | `BrokerHubPage` 6 tests (3 tile + badge capabilities, status providers, panel DNSE, `?provider=ssi`, click tile, loadFail) | ĐỎ import fail | 6/6 |
| 3 | `BrokerHubRedirect` 2 tests (redirect URL cũ, entry loadable) | — (wiring) | 2/2 |

Phát hiện nhờ TDD (đã sửa, không phải giảm test): fallback `t()` không-provider
trả `defaultValue` nguyên văn, không nội suy `{var}` (`LangContext.js:116-121`
vs `i18n/index.js:47-52`) ⇒ thêm `formatHubMessage` (no-op ở app thật).

## Gates (lệnh + exit code)

| Gate | Lệnh | Kết quả |
|---|---|---|
| tsc | `npx tsc --noEmit` (packages/web, sau mỗi sub-step) | exit 0 (6/6 lần) |
| vitest mới | `npx vitest run src/components/broker src/pages/broker` | 4 files / 17 passed (12 của HUB + 5 của `BrokerSettingsSection` có sẵn — xem §Ngoài-scope) |
| contract | route-catalog (2 chiều) + main-menu (sidebar⊂catalog) | 11/11 |
| i18n | `npm run i18n:scan:strict` | exit 0 (warning defaultValue khác nhau có sẵn, không chặn — như baseline §6) |
| lint | `npx eslint` 8 file/scope HUB | 0 errors / 19 warnings (`jsx-no-literals` style, cùng họ với codebase) |
| build | `npm run build` | PASS 37.51s (`tsc && vite build`; cảnh báo eval/chunk có sẵn) |
| bundle | `node scripts/measure-route-graph.mjs BrokerHubPage` (BFS cạnh TĨNH) | **15 chunk / 1349.5 KB ≤ 1450 KB** (nền 1324.3 KB); 0 echarts/xlsx ở tải đầu |
| multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | PASS (0 lỗi, 0 trùng migration; 73 cảnh báo claim cũ có sẵn) |

## CHƯA CHẠY

- Regression BE VPS + DB `mbw2_reg` (Pha 3, PM chạy 1 lần cuối wave).
- FE trên VPS (theo plan §0.5: ghi CHƯA CHẠY).
- `docs/evidence/mbw2/i18n-verify.md` — PM verify tay ≥3 key/bề mặt (Pha 2).
- E2E người dùng thật AC1/AC2 với 2 SubAccount (DNSE đã config + SSI chưa config).

## Rủi ro

1. **Claim `mbw2-hub` không tồn tại trong `docs/CLAIMS.md`** (L-002 nợ) — nhánh
   `feat/mbw2-hub` đã tách từ trước, scope file không giao DATA (xác minh bằng
   `git status` + bảng file §1 plan), rủi ro xung đột thấp nhưng cần PM bổ sung claim.
2. **Capabilities endpoint chưa có method trong `broker.js`** (DATA sở hữu, HUB cấm
   sửa) — HUB gọi qua `coreGet("/broker/capabilities/")` (facade có sẵn). Nếu DATA
   thêm `getBrokerCapabilities`, hub có thể chuyển sang cho gọn (1 dòng).
3. **Trùng số `id: portfolios-manage` trong `routeCatalog.js`** (dòng 147 và 214,
   có sẵn trước wave) — không đụng (ngoài scope), nhưng DATA/HUB đều đọc catalog
   nên ghi nhận để PM mở ticket dọn.

## Việc ngoài-scope thấy nhưng KHÔNG đụng

- `PortfoliosPage.tsx:212` + `PortfolioManageDrawer.tsx:363` còn
  `<Link to="/portfolios/manage/broker">` — vẫn sống nhờ redirect (không chết),
  repoint sang `/broker` là việc 2 dòng cho follow-up (ngoài file HUB được sửa).
- `components/BrokerSettingsSection.tsx` (Wave 1, 12 KB) đã có form schema-driven
  + tiles + test-connection poll job ở bề mặt settings — trùng phủ một phần với
  `BrokerConnectForm`/tile hub. Hub giữ form riêng vì: (a) scope task bắt buộc
  `components/broker/*`, (b) key i18n tách prefix HUB/DATA (§0.7), (c) hub cần badge
  capabilities + URL state + panel DNSE nhúng. Đề xuất PM: ticket hợp nhất ở Pha 2
  cross-review (không refactor trong wave này).
- `routeCatalog.js` duplicate `portfolios-manage` (mục 3 rủi ro trên).

## Follow-up mount DATA → `/broker` (2026-10-15)

- **Lessons áp dụng:** [L-001, L-002, L-006, L-008, L-A01, L-F09, L-F10, L-G02, L-G08, L-V02, L-V03]
  (claim `mbw2-hub` còn `in-progress` — scope đã bao gồm `pages/broker/*` tạo mới +
  route files, nên không khai claim mới; file DATA checkout verbatim, 0 sửa).
- **GAP đã đóng:** `BrokerAccountManager` + `BrokerSyncCenter` (DATA viết) trước đây
  chỉ xanh ở cấp component; nay đã mount vào route `/broker` (observable qua URL).
- **Cấu trúc route đã chọn:** giữ `/broker` = tiles + connect (không đụng —
  test AC1/AC2 cũ nguyên vẹn); thêm route con `/broker/accounts/:accountId` =
  `BrokerAccountPage` (HUB, mới) render `BrokerAccountManager` 4 tab + `SyncCenter`
  nối tiếp, back-link về `/broker`. Không làm tab layout (giữ URL `?tab=` deep-link
  của DATA qua `useUrlState`), không thêm mục menu (detail là sub-route), redirect
  cũ + menu giữ nguyên. Không thêm key `routes.*` mới — catalog tái dùng
  `routes.broker` (ngoại lệ HUB duy nhất); label trang qua 4 key `brokerHub.hub.*`
  mới (`accountEyebrow/accountTitle/backToHub/errors.accountMissing`, VI+EN).
- **Tiêu thụ adapter DATA, 0 sửa:** page cast `defaultCoreApiAdapter` as unknown as
  `BrokerAccountAdapter & BrokerSyncAdapter` (cùng họ `BrokerHubPage`); không gọi
  `coreGet` trực tiếp. Badge join §2 giữ nguyên bên trong component DATA
  (provider từ account trong URL; unlinked ⇒ 0 request đọc — test mount chứng minh).
- **File DATA vào nhánh verbatim:** 6 path checkout từ `feat/mbw2-data`
  (`brokerData/*.tsx|css` ×4 + `adapters/core/broker.js` + 1 dòng `corePatch`
  trong `adapters/coreApiAdapter.js`), `git diff feat/mbw2-data -- <6 path>`
  rỗng. Cố ý KHÔNG mang `brokerData/__tests__/` (DATA sở hữu) và KHÔNG đụng
  `PortfoliosBrokerPage.tsx` của DATA (giữ bản redirect HUB). i18n `data.*` chưa
  merge (component fallback `defaultValue` VI đầy dấu) — hợp nhất ở wave merge.
- **TDD:** test mount viết trước → ĐỎ import fail (exit 1); sau code → 5/5 xanh.
  Lỗi giữa đường (đã sửa, không giảm test): mock module `coreApiAdapter.js` làm
  `PortfolioProvider` mất `authTokenStorage` ⇒ chuyển sang `importOriginal` spread.
- **Gates (lệnh + exit code):** `npx tsc --noEmit` exit 0 ·
  `npx vitest run src/pages/broker src/components/broker` 5 files / 22 passed exit 0 ·
  contract 2 chiều 3/3 exit 0 · `i18n:scan:strict` exit 0 (warning có sẵn) ·
  eslint scope 0 errors / 4 warnings (`jsx-no-literals`, cùng họ codebase) ·
  `check-multi-agent` PASS (0 lỗi, 0 trùng migration).
- **CHƯA CHẠY:** regression BE VPS · FE trên VPS · `npm run build` full (ngoài yêu
  cầu follow-up: chỉ yêu cầu vitest scope + tsc) · bundle `/broker/accounts/*`.
