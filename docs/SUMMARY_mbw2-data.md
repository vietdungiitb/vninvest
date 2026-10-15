# SUMMARY_mbw2-data — Agent DATA (Wave 2 Broker Hub UI, B2.3+B2.4+B2.5)

- **Nhánh:** `feat/mbw2-data` → `feat/mbw2-broker-hub` (1 PR cuối wave, §0.2)
- **Worktree:** `C:/MujocoProjects/agent-mbw2-data`
- **Ngày:** 2026-10-15 · **Contract:** `docs/PLAN_WAVE2_BROKER_HUB_20261015.md` §2 (đóng băng)
- **Lessons áp dụng:** [L-001, L-002, L-006, L-008, L-A01, L-G01, L-G02, L-G03, L-G08, L-V01, L-V02, L-V03, L-F03, L-F08, L-F09, L-F10, L-T01, L-T02, L-G05]

## 1. Việc đã làm (trong claim `mbw2-data`, không chạm file HUB)

| # | File | Thay đổi |
|---|---|---|
| 1 | `packages/web/src/adapters/core/broker.js` | +10 hàm contract §2 (giữ nguyên 7 hàm cũ) |
| 2 | `packages/web/src/pages/portfolio/PortfolioHoldingsPage.tsx` | `HoldingRow.source?` + badge nguồn trong ô symbol (giữ 13 cột) |
| 3 | `packages/web/src/i18n/vi.js`, `en.js` | CHỈ key `brokerHub.data.*` (~45 key, parity VI/EN) |
| 4 | `packages/web/src/components/brokerData/sourceBadge.tsx` (mới) | `SourceBadge`/`ProviderBadge`/`isMatchedOrder`/`filterMatchedOrders` |
| 5 | `packages/web/src/components/brokerData/BrokerAccountManager.tsx` (mới) | 4 tab Vị thế/Sổ lệnh/Khớp lệnh/Số dư |
| 6 | `packages/web/src/components/brokerData/BrokerSyncCenter.tsx` (mới) | runs/issues + sync→202+poll jobs |
| 7 | `packages/web/src/components/brokerData/brokerData.css` (mới) | class `bdata-*` riêng; đọc `var(--pf-gain/--pf-loss)`, 0 token/class mới vào soc |
| 8 | 4 file `*.component.test.*` (mới) | TDD fail-before ĐỎ → XANH (xem §3) |

Không sửa: `CLAIMS.md`, BE, `coreApiAdapter.js`, mọi file HUB (`routeCatalog`, `pageRegistry`, `main.tsx`, `sidebaritems`, `PortfoliosBrokerPage`, `soc.*.css`, `pages/broker/*`, `components/broker/*`), `soc.module.css`.

## 2. Quy tắc nghiệp vụ đã thực thi

- **Badge join §2 (AC3):** provider đọc 1 lần từ `getBrokerAccount(accountId)` (account trong URL), badge mọi dòng positions/orders/matched; `broker_config_id` null ⇒ badge `unlinked` + **0 request** positions/balance/orders (test đếm call).
- **Tab Khớp lệnh (AC3):** `filterMatchedOrders` với `{FILLED, MATCHED}` (case-insensitive); UI ghi rõ giới hạn *"không có endpoint fills riêng"* (BE pass-through status broker, `adapters.py` không có enum chuẩn).
- **Sync Center (AC4):** `syncBrokerAccount` (POST sync, BE 202 + `job_id`) ⇒ poll `getBrokerJob` tới `succeeded`/`failed` (tối đa 60 lần, `pollIntervalMs` mặc định 1500ms, test inject 10ms) ⇒ refetch runs. `account_not_linked` ⇒ thông báo, không poll.
- **Holdings badge (AC5 partial — xem ticket BE-02):** `SourceBadge` map `manual|broker_backed|aggregate|unlinked`; row thiếu `source` ⇒ render null (fail-closed, không bịa). 13 cột + `data-sign` Bloomberg (L-F08) nguyên vẹn.
- **Luật sắt:** 1 handler = 1 patch `setSearchParams` full-state (`selectTab`, L-F09, có SearchProbe test); spec/codec hook cấp module (L-F10); `t()` mọi chuỗi VI có `defaultValue` đầy đủ dấu.

## 3. Gates đã chạy (lệnh + exit code thật)

| Gate | Kết quả |
|---|---|
| Control `vitest run src/pages/portfolio/__tests__/portfolio-pages.component.test.tsx` (trước code) | PASS 12/12, exit 0 |
| Fail-before 4 file mới (trước code) | ĐỎ (4 files failed), exit 1 |
| 4 suite mới sau code | PASS 24/24, exit 0 |
| Hồi quy `vitest run src/pages/portfolio` (7 files, gồm 2 suite cũ) | PASS 57/57, exit 0 (đã fix regression space badge trong retry-limit) |
| `npx tsc --noEmit` sau mỗi sub-step | exit 0 (4/4 lần) |
| `npm run i18n:scan:strict` | exit 0, 0 cảnh báo về `brokerHub.*` |
| `npx eslint` (file DATA) | 0 errors (75 warnings `jsx-no-literals`, cùng lớp với code cũ) |
| `npm run build` | PASS 22.58s, exit 0 (cảnh báo chunk có sẵn) |

## 4. Blocker / ticket cho PM (STOP §0.4 — FE-only, không tự mở rộng BE)

- **BE-01 (GET bindings):** `views_broker.py:572` `portfolio_broker_bindings_api` chỉ `@api_view(['PATCH'])` (GET ⇒ 405). Adapter `getPortfolioBindings` giữ đúng path contract để BE bổ sung GET không phải đổi FE. Không làm UI editor bindings (đọc mù = UX sai).
- **BE-02 (holdings source):** `PortfolioSerializer` (`serializers.py:96-102`) KHÔNG expose `kind`; `_build_holdings_payload` (`portfolio_analytics_views.py:185-240`) không trả per-row `source`. AC5 chỉ đạt partial (UI + test fail-closed sẵn sàng, chờ BE).
- **WIRING-01 (facade, 1 dòng):** `coreApiAdapter.js:93-97` inject brokerClient thiếu `corePatch` ⇒ `savePortfolioBindings` throw rõ ràng khi thiếu (không gọi POST giả). PM chỉ định owner bổ sung (file ngoài claim DATA+HUB).

## 5. CHƯA CHẠY

- Regression BE trên VPS (`mbw2_reg`) — việc của Pha 3, PM chạy 1 lần cuối wave (§7.2).
- `measure-route-graph` cho bề mặt DATA — component chưa được mount vào route `/broker` (HUB giữ route); đo ở Pha 2 sau hợp nhất.
- Mount `BrokerAccountManager`/`BrokerSyncCenter` vào `/broker` — thuộc HUB (B2.1), DATA giao component + adapter sẵn.

## 6. Rủi ro + việc ngoài-scope thấy nhưng KHÔNG đụng

- Rủi ro: BE status lệnh là pass-through (mỗi broker một tập status) ⇒ filter Khớp lệnh `{FILLED, MATCHED}` có thể thiếu trạng thái khớp của SSI/TCBS — cần PM xác nhận tập status sau khi có dữ liệu thật.
- Ngoài-scope (không đụng): `PortfolioSerializer` thiếu `kind` (BE-02); `soc.components.css` không có class badge dùng chung cho broker (DATA tự làm `bdata-*`, HUB có thể hợp nhất ở cross-review B2.7); `window.location.search` trong test MemoryRouter (đã dùng SearchProbe theo mẫu WAVE 9).

## 7. Follow-up QĐ PM (2026-10-15, commit riêng trên `feat/mbw2-data`)

- **WIRING-01 — XONG:** `coreApiAdapter.js:93-97` đã wiring `corePatch: transport.corePatch`
  vào `createBrokerClient({...})` (1 dòng duy nhất ngoài-claim, PM chỉ định owner = DATA).
  Signature `createBrokerClient` đã có `corePatch` từ commit trước (`broker.js:18`) — không đổi thêm.
  `savePortfolioBindings` giữ throw fail-closed khi client dựng thiếu `corePatch`.
- **BE-01 — XONG:** endpoint bindings BE PATCH-only by design (không có GET) ⇒ **ĐÃ XOÁ**
  helper `getPortfolioBindings` khỏi adapter (không gọi endpoint không tồn tại). Giữ
  `savePortfolioBindings` (PATCH add/remove). Bindings UI đọc từ action-response + accounts list.
  **KNOWN GAP — ticket BE-READ (Wave 3):** thiếu read-endpoint riêng cho bindings.
- **BE-02 — XONG (giữ fail-closed):** `kind` không expose ở bất kỳ response nào (chỉ có trong
  migration) — KHÔNG đoán source. `SourceBadge` giữ fail-closed (unknown/null ⇒ render null,
  `sourceBadge.tsx:25-27`; test `portfolioHoldingsSourceBadge` vẫn xanh).
  **KNOWN GAP — ticket Wave 3:** expose `kind` + per-row `source` từ BE.
- **MỚI — `getBrokerCapabilities()`:** `broker.js` thêm `GET /broker/capabilities/` (endpoint có sẵn,
  Wave 0 B0.6; contract §2 PLAN_WAVE2). Test mới xanh (`brokerHubDataAdapter` 12/12).
  **Báo HUB qua đây:** khi HUB gọi capability cho 3 tile thì dùng
  `adapter.getBrokerCapabilities()`, KHÔNG gọi `coreGet("/broker/capabilities/")` trực tiếp —
  HUB refactor ở cross-review B2.7 (DATA không sửa file HUB).

Gates follow-up: `npx vitest run src/adapters/core/__tests__/brokerHubDataAdapter.component.test.js`
→ 12/12 exit 0 · `npx tsc --noEmit` → exit 0.
