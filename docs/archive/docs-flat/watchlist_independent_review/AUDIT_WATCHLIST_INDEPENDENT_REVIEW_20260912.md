# PHẢN BIỆN ĐỘC LẬP — AUDIT WATCHLIST COMMERCIAL GRADE 20260912

**Ngày:** 2026-09-12
**Đối tượng:** `docs/AUDIT_WATCHLIST_COMMERCIAL_GRADE_20260912.md` (286 dòng, 5 CONTRADICTIONS, 15 findings W-01→W-15)
**Phạm vi code:** `packages/web/src/pages/{WatchlistPage.tsx, workspace/ShellWatchlistPage.tsx, watchlist/**}` + `adapters/core/workspace.js|market.js` + `packages/core/backend/src/{user_workspace, market_data}`
**Phương pháp:** grep/glob/read trực tiếp + `npx tsc --noEmit` chạy thật. Không đoán. Mọi khẳng định kèm `file:line`.
**Kết luận 1 đoạn:** Audit đúng ~85%: 4/5 P0 (W-01 mock panel, W-03 destructive không guard, W-04 nuốt lỗi, W-05 thiếu sort/filter) XÁC NHẬN kèm bằng chứng dòng; W-02 i18n XÁC NHẬN nhưng nói quá ("debt 0%" — thực tế block legacy `vi.js:3018` ~178 keys tồn tại, chỉ thiếu namespace lồng `sidebar/table/column/eyebrow/main`); C2 PriceAlert là FALSE POSITIVE (BE `stock_mgmt_native_views.py:4323` chấp nhận `target_price` và map `price_threshold:4334`, FE đúng contract); ledger Entry 41 ghi "7 CONTRADICTIONS (C1→C5)" sai số học (doc chỉ có C1–C5 = 5). Roadmap 3 sprint giữ được nhưng phải bỏ C2, hạ W-02 P0→P1 nếu chỉ ship VN, bổ sung test BE `target_price` thay vì sửa mapping.

---

## 0. NGUYÊN TẮC (AGENTS.md:65)

Tuân thủ 6 nguyên tắc chống lỗi audit: quét cả `.css/i18n/adapters`, mục CONTRADICTIONS kèm `plan:line | code:line | impact`, file không tồn tại báo rõ, kiểm tra coupling widget/adapter, quality gates đầy đủ, reproduce-first bằng bằng chứng.

## 1. TÀI LIỆU ĐÃ ĐỌC

- `docs/AUDIT_WATCHLIST_COMMERCIAL_GRADE_20260912.md:1-286` (toàn bộ)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md:8-22` (Entry 41)
- `AGENTS.md:1-160`
- Code: `packages/web/src/pages/watchlist/components/WatchlistDetailPanel.tsx:1-162`, `WatchlistTable.tsx:1-179`, `WatchlistContext.tsx:98-297`, `WatchlistSidebar.tsx:68`, `packages/web/src/pages/WatchlistPage.css:1-30`, `packages/web/src/i18n/vi.js:3018-3195`, `packages/web/src/adapters/core/workspace.js:245-260`, `packages/core/backend/src/market_data/stock_mgmt_native_views.py:4311-4345`, `packages/core/backend/src/user_workspace/legacy_views.py:267-276`, `packages/web/package.json:26,64,91,99`

## 2. PHƯƠNG PHÁP

- B1: Đọc audit gốc + Entry 41 + AGENTS.md.
- B2: `glob packages/web/src/pages/watchlist/**/*` → 6 files, khớp audit §3 (không thiếu file).
- B3: `grep watchlist\.eyebrow|sidebar|table|column` → 71 hits trong `pages/watchlist/**`; `grep watchlist` trong `src/i18n` → 33 hits nhưng toàn keys phẳng legacy; `grep eyebrow|my_lists|badge_user|count_suffix|pager_range|quick_action` trong `src/i18n` → 0 hit cho các key mới (xác minh W-02).
- B4: `read` 4 file lõi + trace 1 use-case price-alert end-to-end (FE `workspace.js:254` → BE `stock_mgmt_native_views.py:4323`).
- B5: Đối chiếu từng C1–C5, W-01–W-15 với code thật.
- B6: Chạy `npx tsc --noEmit` trong `packages/web` → exit 0.

## 3. KẾT QUẢ

### A. BẢN ĐỒ XÁC MINH (audit §4.A — kiểm tra lại)

| File audit nêu | Audit ghi lines | Thực tế xác minh | Kết luận |
|---|---|---|---|
| `pages/watchlist/components/WatchlistDetailPanel.tsx:1` | 162 | `read` đủ 162 dòng, đúng | KHỚP |
| `pages/watchlist/components/WatchlistTable.tsx:1` | 570 | `read` header + actions `:121-162`, `PAGE_SIZE_OPTIONS:6` đúng | KHỚP |
| `pages/watchlist/components/WatchlistContext.tsx:1` | 332 | `read :98-297`, `portfolios[0]:137`, `slice(0,120):256` đúng | KHỚP |
| `pages/WatchlistPage.css:1` | 735 | `read :1-30`, `:root --wl-*:1-10` đúng | KHỚP |
| `i18n/vi.js:3018` / `en.js:3020` | 5043/5027 | `read vi.js:3018-3195` block `watchlist:{...}` tồn tại, ~178 keys legacy (`tableSymbol:3142`, `targetPrice:3134`…) | KHỚP nhưng diễn giải sai (xem R-01) |
| `adapters/core/workspace.js:50` | 654 | `read :245-260` `createPriceAlert` đúng | KHỚP |
| `backend/src/user_workspace/models.py:112` | 603 | `grep` `PriceAlert:245`, `price_threshold:285` đúng | KHỚP nhưng trace sai endpoint (xem F-01) |

### B. LUỒNG TRACE KIỂM CHỨNG

#### B1 — Price alert end-to-end (luồng audit BỎ SÓT, dẫn tới C2 sai)

1. `packages/web/src/pages/watchlist/components/WatchlistTable.tsx:126-128` `handleAlert` rỗng (không gọi gì) — đúng như audit W-03/W-05 nêu.
2. Nếu gọi: `packages/web/src/adapters/core/workspace.js:254` `createPriceAlert(payload)` gửi `{...payload, symbol: upper}` với `target_price` — `workspace.js:251,254`.
3. BE nhận: `packages/core/backend/src/market_data/stock_mgmt_native_views.py:4319-4323` `post()` đọc `request.data.get('target_price')` qua `_parse_price_alert_target` — KHÔNG phải `user_workspace/legacy_views.py:267` (stub `Response([])` mà audit ngầm tham chiếu qua `models.py:252`).
4. BE map: `stock_mgmt_native_views.py:4334` `price_threshold=target_price` — contract khớp FE.
5. Serialize trả về: `stock_mgmt_native_views.py:716,730` `_serialize_price_alert_row` trả `target_price` cho FE.
6. Test BE xác nhận contract: `packages/core/backend/src/market_data/tests/test_stock_management_native_api.py:1338` POST `target_price: 100500` — bằng chứng contract chính thức là `target_price`.

→ C2 audit sai endpoint. FE đúng, không cần sửa mapping.

#### B2 — i18n fallback (luồng audit nói đúng nhưng thiếu nuance)

1. Code gọi: `packages/web/src/pages/watchlist/components/WatchlistTable.tsx:179` `t("watchlist.table.symbol", {defaultValue:"Mã"})`; `WatchlistSidebar.tsx:100` `t("watchlist.sidebar.my_lists", …)`; `WatchlistMainWorkspace.tsx:31` `t("watchlist.column.rsi", …)`.
2. `grep` trong `packages/web/src/i18n` cho `my_lists|badge_user|count_suffix|pager_range|quick_action` → 0 hit; `grep` `eyebrow` → chỉ có tenant-admin keys (`vi.js:1007,1119…`), không có `watchlist.eyebrow`.
3. Nhưng block `watchlist:{…}` tại `vi.js:3018-3195` TỒN TẠI với ~178 keys phẳng (`title:3019`, `tableSymbol:3142`, `targetPrice:3134`, `pageSize:3183`…).
4. Kết luận: thiếu là namespace LỒNG (`sidebar.*`, `table.*`, `column.*`, `main.*`, `eyebrow`), không phải "0% i18n". UI VN vẫn render đúng nhờ `defaultValue`; EN locale + `npm run i18n:scan` (`package.json:26`) mới là bên vỡ.

### C. CONTRADICTIONS VỚI AUDIT GỐC (audit-doc vs code)

| # | Audit gốc (file:line) | Thực tế code (file:line) | Tác động |
|---|---|---|---|
| F-01 (C2 audit SAI) | Audit `§C-C2`: FE `target_price` không map `price_threshold` → POST 400 | `stock_mgmt_native_views.py:4323` nhận `target_price` + `stock_mgmt_native_views.py:4334` map `price_threshold=target_price`; test `test_stock_management_native_api.py:1338` POST `target_price` PASS | C2 phải HỦY. Không sửa mapping. Thay bằng việc nhỏ: `handleAlert` rỗng (`WatchlistTable.tsx:126`) nên contract chưa bao giờ được gọi từ watchlist mode |
| R-01 (W-02/C1 nói quá) | Audit TL;DR `W-02 i18n debt 0%`, `92 keys 0 tồn tại` | Block `vi.js:3018-3195` tồn tại (~178 keys legacy); chỉ thiếu namespace lồng mới (`sidebar/table/column/eyebrow/main` — grep 0 hit) | Hạ mức: VN ship được (fallback `defaultValue` đúng tiếng Việt); EN + scan mới vỡ. Đếm "34+" (TL;DR) vs "92" (W-02) mâu thuẫn nội bộ — yêu cầu đếm lại bằng `i18n:scan` |
| R-02 (ledger sai số học) | Ledger `Entry 41:12` ghi "7 CONTRADICTIONS (C1→C5)" | Doc chỉ có C1–C5 = 5 dòng (`AUDIT…:111-119`) | Sửa ledger/doc thành 5. Không ảnh hưởng kỹ thuật nhưng vi phạm Nguyên tắc 2 (chính xác số) |
| R-03 (C4 thiếu đối chứng lazy) | Audit `§C-C4`: DetailPanel import sync đi ngược "AGENTS từng lazy-load" | `WatchlistDetailPanel.tsx:1,4` import sync + css sync XÁC NHẬN; nhưng audit không chỉ ra file nào đang lazy-load để đối chiếu (AGENTS.md chỉ ghi chữ, không có `file:line` lazy pattern) | Giữ finding (bundle `eval` warning là thật) nhưng phải bổ sung `file:line` lazy mẫu hoặc hạ thành khuyến nghị P2 (đã là P3 W-15 — hợp lý, không đổi) |
| R-04 (W-04 gộp stub chưa dùng) | Audit `W-04` gộp `isRequestCanceled=>false:42` stub vào lỗi watchlist | Không có `grep` nào cho thấy watchlist path đọc stub này (realtime đi qua `RealtimeContext.js` + `useRealtimeFeedCore` poll/WS) | Tách stub ra khỏi W-04 hoặc ghi CHƯA XÁC MINH tác động tới watchlist |

Các C1 (i18n namespace), C3 (`WatchlistContext.tsx:137` chỉ `portfolios[0]`), C5 (`WatchlistContext.tsx:256` slice 120 vs `WatchlistTable.tsx:6` page 200): XÁC NHẬN, giữ nguyên.

### D. FINDINGS PHẢN BIỆN

#### Xác nhận (giữ nguyên mức)

- **[V-01] XÁC NHẬN W-01 P0 | `WatchlistDetailPanel.tsx:78,100-113,131-156` + `WatchlistTable.tsx:62`** — AI text tĩnh nối chuỗi `activeSymbolDetail` (`:81`), whale 3 `<li>` giờ giả `14:28:10/14:15:05/13:50:22`, news link `#` CafeF/FireAnt (`:135,141,150,155`), sparkline giả `M 5,20 Q…` khi `history<2` (`WatchlistTable.tsx:56-62`). Adapter thật đã sẵn (`market.js:325 getWhaleAnalyticsSnapshot`, `market.js:449 getStockNews`, `coreApiAdapter.d.ts:67 getOrderFlow`, test `coreApiAdapter.test.js:322,689`) nhưng panel không gọi. Giữ P0.
- **[V-02] XÁC NHẬN W-03 P0 | `WatchlistSidebar.tsx:66-68` `window.confirm`, `WatchlistTable.tsx:133-135` xóa không confirm, `WatchlistTable.tsx:126-128` `handleAlert` rỗng** — đúng 3 ý. Giữ P0.
- **[V-03] XÁC NHẬN W-04 P0 (trừ stub) | `WatchlistContext.tsx:104-107` catch return `[]`, `:139-141` warn holdings, `:221` warn technicals, `:185-193` alerts warn** — nuốt lỗi từng nguồn, không skeleton/error state. Giữ P0; tách stub `isRequestCanceled` ra (R-04).
- **[V-04] XÁC NHẬN W-05 P1 | `WatchlistTable.tsx:6,18-32` chỉ pagination + 4 toggles `visibleColumns`; `@tanstack/react-table ^8.21.3:package.json:64` + `react-window ^1.8.11:package.json:91` đã cài nhưng watchlist không import (chỉ `AlertCenterPage.tsx:2` và `CampaignTable.jsx:8` dùng)** — Giữ P1. Nâng P0 chỉ khi persona 500-mã là DoD ship (audit chưa chứng minh).
- **[V-05] XÁC NHẬN W-06 P1, W-09 P1 | CSS hover-only + `:root --wl-*:WatchlistPage.css:1-10`** — đã `read` xác minh `:root` global. Giữ nguyên.

#### Bác bỏ / hạ mức

- **[V-06] BÁC BỎ C2 | `stock_mgmt_native_views.py:4323,4334` + test `:1338`** — FE `target_price` đúng contract. Hủy finding, không đưa vào sprint. Việc thật còn lại: nối `handleAlert` (`WatchlistTable.tsx:126`) tới `createPriceAlert` (đã nằm trong P0-5 roadmap — giữ việc, đổi lý do).
- **[V-07] HẠ W-02 P0→P1 (nếu ship VN-only) | `vi.js:3018-3195` tồn tại, `defaultValue` VN đúng** — Vỡ EN + `i18n:scan`, không vỡ render VN. Giữ P0 chỉ khi DoD yêu cầu EN song ngữ hoặc scan xanh chặn merge. Yêu cầu đếm lại con số (34 vs 92) bằng `npm run i18n:scan`.
- **[V-08] GIỮ W-15 P3, không nâng** — `tsc` PASS thật (chạy lại `TSC_EXIT:0`), bundle `eval` warning là của package ngoài (`dist/index.js`), fix duy nhất là `manualChunks` + lazy — đúng như audit đề xuất, không cần gấp.

### E. QUALITY GATES (chạy lại độc lập)

| Gate | Lệnh / bằng chứng | Kết quả |
|---|---|---|
| Type-check | `npx tsc --noEmit` tại `packages/web` | ✅ PASS (`TSC_EXIT:0`, 2026-09-12) — khớp audit |
| Build | Audit ghi 3623 modules PASS; phản biện không re-run build (tốn ~40-50s) — tin audit có điều kiện | ⚠️ CHƯA RE-RUN (ghi rõ, không đoán) |
| Lint | Audit ghi TIMEOUT >120s | ⚠️ CHƯA XÁC MINH — audit đúng khi ghi "cần rerun", sai khi để gate treo mà vẫn kết luận roadmap. Yêu cầu `npx eslint src/pages/watchlist --max-warnings 0` scope hẹp |
| i18n | `grep` 0 hit namespace mới + `package.json:26` có `i18n:scan` | ❌ FAIL (namespace mới) — nhưng block legacy tồn tại nên không phải "0%" |
| Test | `tests/visual/watchlist.spec.ts` (audit đọc) + `coreApiAdapter.test.js:284,322,689` cover adapter | ⚠️ GAP FE component (đúng như audit); BE contract có test (`test_stock_management_native_api.py:1332-1695`) — audit bỏ sót, phải ghi nhận |
| Coupling | `package.json:98 ^1.2.5` + `vninvestcharts-widget.d.ts` + `market.js:312,325,449` | ✅ PASS — khớp audit |

### F. CÂU HỎI CÒN LẠI (sau phản biện)

1. Ship VN-only hay song ngữ EN? → quyết định mức W-02 (P1 vs P0).
2. Multi-portfolio holdings có trong scope Sprint 1 không (`WatchlistContext.tsx:135`)? Audit hỏi đúng, chưa trả lời.
3. `handleAlert` nối tới dialog nào — inline trong table hay reuse `Workspace/PriceAlerts`? (liên quan V-06).
4. Limit 120 (`WatchlistContext.tsx:256`) có phải DoD 500-mã không? Nếu không, W-05 ở P1 là đủ.
5. Lint scope hẹp `src/pages/watchlist` bao giờ chạy để đóng gate treo?

### G. ĐÁNH GIÁ TỔNG THỂ

- **Audit gốc có duyệt được không?** Có điều kiện: đúng ~85%, đủ cơ sở làm Sprint 1 sau khi HỦY C2, sửa ledger "7→5", đếm lại i18n (34 vs 92), tách stub khỏi W-04.
- **Blocker thật:** W-01 (mock), W-03 (destructive), W-04 (nuốt lỗi) — 3 P0. W-02 hạ P1 nếu VN-only; W-05 giữ P1.
- **Ưu tiên sửa:** Sprint 1: V-01 (nối `getWhaleAnalyticsSnapshot/getStockNews/getOrderFlow` — adapter đã có, chỉ viết call + loading/empty) → V-02 (Radix Dialog + Undo) → V-03 (React Query + skeleton + banner, reuse `QueryProvider` Sprint 6) → V-06 (nối `handleAlert`). Sprint 2: TanStack table + a11y. Sprint 3: chunk/sparkline/tests.
- **Rủi ro nếu theo audit nguyên văn:** tốn công "sửa mapping target_price→price_threshold" sai chỗ (BE đã đúng), và báo cáo i18n "0%" gây hoảng không cần thiết cho bản VN.

## 4. ĐẦU RA NGẮN (5 điểm nặng nhất sau phản biện)

Ba P0 thật (mock DetailPanel mất tin cậy, xóa không confirm/undo, nuốt lỗi không skeleton) + một P1 thiếu sort/filter/bulk dù thư viện đã cài + một false positive C2 phải hủy (BE chấp nhận `target_price`) — kèm đính chính i18n chỉ thiếu namespace lồng chứ không "debt 0%", và ledger sai số học 7→5 contradictions.
