# RE-AUDIT B8 — Verify fix heatmap 1833 mã (branch `feat/dash-heatmap-scope`)

> **Ngày:** 2026-11-18 · **Auditor:** subagent độc lập, CHỈ ĐỌC (không sửa code runtime).
> **Revision:** `0debe3e3c91456dec681265d68a176626b4ef172` · **Branch:** `feat/dash-heatmap-scope` · `git rev-parse HEAD` khớp, `git status --short` sạch.
> **Base đối chiếu:** `dev @ b83718ef9` (theo `docs/PLAN_DASHBOARD_HEATMAP_SCOPE_20261118.md:3`).
> **Tài liệu đối chiếu:** `docs/PLAN_DASHBOARD_HEATMAP_SCOPE_20261118.md:1-39` · `docs/evidence/dashboard-uiux/AUDIT_HEATMAP_SCOPE_B3.md:1-131` (B3 NEED_REVISION + B4 consensus) · `docs/evidence/dashboard-uiux/gates-p1p2.md:30` · `docs/evidence/dashboard-uiux/gates.md:40-43`.
> **Nguyên tắc:** mọi khẳng định kèm `file:line` tự mở bằng `read`/`grep`; không tin citation kế thừa (L-T02); không báo PASS cho thứ không có evidence (L-V01/L-V02).

---

## 0. Verdict

**AGREE (có reservation).**

Fix đúng ở tầng hook: `isSystemMarketGroup` phủ **toàn bộ** `group_type` hệ thống của BE + fallback slug bỏ dấu/gom separator đúng; `filterUserWatchlistGroups` chạy **trước** `setState` và mọi consumer (heatmap, deck, bulk technicals, `onDataReady`) đều nhận group đã lọc; không còn nguồn thứ hai đưa 1833 mã vào heatmap. **R1 (MARKET_CAP) ĐÃ đóng.** Không có blocker/major ở mức code.

Hai reservation không chặn code nhưng **chưa cho phép coi hồ sơ hoàn chỉnh**:
- **R2 CHƯA đóng:** AC `scopeCount === 5` (`PLAN:23`) **không có assertion tự động** và **không có ảnh QA** trong repo để B8 đọc. Kênh `watchlists` (`useCoreDashboardData.js:163-166`) vẫn lọc slug không bỏ dấu — giả thuyết "có reintroduce 1833 hay không" chưa bị loại trừ bằng thực thi.
- **Evidence VPS chưa có file:** con số `197 file / 1304 test · 5 fail SSE · build 0` **khớp số học** với nền tảng có thật (`gates-p1p2.md:30`: 196/1299 + 1 file/5 test mới), nhưng **không có tài liệu nào trên branch ghi kết quả chạy thật**; commit `0debe3e3c` chỉ ghi `TDD 5 RED → 5 GREEN, tsc 0`. Theo `documentation-evidence-rule` ⇒ **CHƯA XÁC MINH thực thi**.

Lessons áp dụng: `[L-V01, L-V02, L-V04, L-T02]` — tự mở 11 file + grep 6 lượt; không checkout base để replay TDD; không tự append ledger (auditor chỉ đọc).

---

## 1. Kiểm tra theo 6 câu yêu cầu

### (1) `isSystemMarketGroup` phủ mọi group_type hệ thống + fallback slug — **ĐÚNG**

- `packages/web/src/constants/marketGroups.ts:37-39`: `SYSTEM_GROUP_TYPES = {SECTOR, INDEX, EXCHANGE, ETF, CW, BOND, DERIVATIVE, MARKET_CAP}`.
- Đối chiếu SSOT BE `packages/core/backend/src/market_data/vnbroker_adapter.py:1426-1460`: các `group_type` thực tế trả ra = `SECTOR` (`:1428-1433`), `INDEX` (`:1435-1444,1455-1459`), `EXCHANGE` (`:1446-1448`), `ETF` (`:1450`), `CW` (`:1451`), `BOND` (`:1452`), `DERIVATIVE` (`:1453`) — **7/7 nằm trong set**. `:1602` gán `group_type` từ `_GROUP_METADATA` cho mọi group provider; `:1547` cho sector group.
- `MARKET_CAP` có thật ở `packages/core/backend/src/market_data/default_groups.py:98,137` (VN30, VN100) + `:152` (HNX30) → **R1 đã được implementer đóng** đúng yêu cầu B4 `AUDIT_HEATMAP_SCOPE_B3.md:126`. Dù BE adapter gán VN30/VN100 nhãn `INDEX`, việc giữ thêm `MARKET_CAP` là an toàn (không over-filter: user group có `group_type="CUSTOM"`, test `market-group-filter.component.test.ts:20` xác nhận giữ lại).
- Fallback `marketGroups.ts:41-49`: `.normalize("NFD").replace(/[\u0300-\u036f]/g,"")` (bỏ dấu) → `.toLowerCase()` → `.replace(/[^a-z0-9]+/g,"-")` (**gom mọi cụm không-alnum gồm `&` thành 1 dấu `-`**) → trim `^-+|-+$`. Đúng thuật toán B3 O-2 yêu cầu (`AUDIT_HEATMAP_SCOPE_B3.md:89`). `marketGroups.ts:57-59` quét cả `id/group_id/slug/name/group_name`. Test `:25-27` (`Ngân hàng`, `Thép & Vật liệu`, `vn30`) xanh trên cơ chế này.

### (2) Lọc trước setState, mọi consumer nhận group đã lọc — **ĐÚNG**

| Điểm | Evidence | Kết luận |
|---|---|---|
| Nguồn thô | `useCoreDashboardData.js:161` `rawWatchlistGroups = safeResults(groupsRes)` | — |
| Lọc trước setState | `useCoreDashboardData.js:170` `const watchlistGroups = filterUserWatchlistGroups(rawWatchlistGroups)`; helper định nghĩa `:20-22` | ĐÚNG (trước `setState` `:186`) |
| `collectDashboardSymbols` | `useCoreDashboardData.js:177-182` truyền biến đã lọc vào `:46-66` | ĐÚNG |
| State trả ra | `useCoreDashboardData.js:200` `watchlistGroups` (biến đã lọc) | ĐÚNG |
| Heatmap | `DashboardPage.tsx:162` destructures từ hook → `:244-248` `heatmapSymbols` → `:423` `scopeCount` | ĐÚNG |
| onDataReady | `DashboardPage.tsx:302` truyền `watchlistGroups` từ state; `:299` token dùng `[]` cho groups | ĐÚNG |
| Deck | `DashboardPage.tsx:457` `watchlistGroups={watchlistGroups}` (state đã lọc) → `CoreDashboardPositionDeck.tsx:117-141` → `modernDashboardSymbolUniverse.js:86-104` | ĐÚNG |

Hook có đúng **1 consumer** (`DashboardPage.tsx:162`); không bên thứ ba nào nhận group chưa lọc.

### (3) Nguồn khác đưa 1833 mã vào heatmap — **KHÔNG CÒN**

- `market_discovery`: `DashboardPage.tsx:204-208` chỉ là pseudo-symbol fallback khi `symbolString` rỗng, dùng cho `useRealtimeFeedFromManager` (`:213`); `useRealtimeFeedCore.js:363-371` **loại** `market_discovery`/`market_discovery_event` khỏi poll candidates. Không cấp mã cho `heatmapSymbols`.
- `quotesBySymbol`: `DashboardPage.tsx:222-224` `mergedQuotes` chỉ **tra cứu** theo `heatmapSymbols` tại `:255` (`heatmapData = heatmapSymbols.map(...)`) — quote thừa không sinh tile. `PortfolioHeatmap.js` chỉ `fetchTrendData` cho 1 symbol được chọn (`:420,487-504`), không fetch universe.
- `modernDashboardSymbolUniverse.js:86-104` nhận `watchlistGroups` nhưng chỉ được gọi từ deck với prop **đã lọc** (xem (2)); test `modernDashboardSymbolUniverse.component.test.ts:9` truyền trực tiếp util là test đơn vị, không phải đường produção.
- `watchlists`: `DashboardPage.tsx:240-242` lấy `w.items` — đây là kênh **có rủi ro latent** (`useCoreDashboardData.js:163-166` slug `.toLowerCase().replace(/\s+/g,"-")` **không bỏ dấu**) nhưng B4 `AUDIT_HEATMAP_SCOPE_B3.md:127` đã xác nhận `getWatchlists()` trả `Watchlist` user, còn `seed_default_watchlist_groups` ghi vào `CachedSymbolGroup`, không vào `Watchlist` — nên **không phải nguồn 1833 đã biết**; chỉ là giả thuyết cần QA (xem F1).

### (4) Tautology — **KHÔNG có tautology chặn merge**

`market-group-filter.component.test.ts`:
- `:8-17` 8 `group_type` × 5 tên → assert thật hành vi `isSystemMarketGroup`.
- `:19-22` `CUSTOM`/tên user → `false` (negative case, tránh over-filter).
- `:24-28` fallback slug bỏ dấu → `true`.
- `:30-40` **test hành vi** `filterUserWatchlistGroups([...])` → chỉ giữ group 99 (đáp ứng B3 O-3 ở mức helper).
- `:42-47` source-scan `src/.../useCoreDashboardData.js` chứa `filterUserWatchlistGroups(rawWatchlistGroups)` — **whitebox, không phải tautology** (sẽ đỏ nếu bỏ lời gọi), nhưng không chứng minh output (F3).

⚠ B3 `AUDIT_HEATMAP_SCOPE_B3.md:70` yêu cầu thêm test hook assert symbols gửi `getBulkTechnicalsBySymbols` không chứa mã system; B4 `:121` hạ xuống "HẾT ở mức helper" — nên đây là reservation đã được consensus chấp nhận, không phải finding mới.

### (5) VPS `197/1304`, 5 fail SSE, build 0 — **khớp số học, CHƯA XÁC MINH thực thi**

| Thành phần | Nền tảng có evidence | Suy ra slice này |
|---|---|---|
| Số file | `gates-p1p2.md:30` / `CODE_CHANGE_AUDIT_LEDGER.md:10`: **196 file** | +1 file test mới (`git diff --name-status` chỉ `A`) = **197** ✓ |
| Số test | `gates-p1p2.md:30`: **1299 test** | +5 `it()` trong `market-group-filter.component.test.ts:10,19,24,30,42` = **1304** ✓ |
| 5 fail SSE | `gates.md:40-42` (P0: 2 file SSE), `gates-p1p2.md:30` (vẫn 5 fail), baseline `dev @ 577ddf646` fail y hệt | **5 fail là baseline**, slice gây 0 hồi quy ✓ (về mặt số học) |
| Build | `gates.md:43`, `gates-p1p2.md`: exit 0 | exit 0 ✓ (về mặt nhất quán) |

**Điểm chưa khớp:** không có `gates-heatmap-scope.md` (glob `docs/evidence/dashboard-uiux/` chỉ có 8 file, không có file nào ghi 197/1304); commit `0debe3e3c` body chỉ ghi `TDD 5 RED -> 5 GREEN, tsc 0` + `Pre-Push-Gate-Bypass: 4 pre-existing dev baseline FAIL` — **không** ghi full-suite VPS. `docs/CLAIMS.md:1988` vẫn ghi `in-progress` + `Gates CHƯA CHẠY at claim time`. B8 **không tự chạy lại** full suite (audit-only) ⇒ báo **CHƯA XÁC MINH**, không báo PASS.

### (6) Reservation R1 / R2 — R1 đóng, R2 chưa

- **R1 (MARKET_CAP) — ĐÓNG.** `marketGroups.ts:38` đưa `MARKET_CAP` vào `SYSTEM_GROUP_TYPES`; test `market-group-filter.component.test.ts:8` bao phủ. Khớp yêu cầu B4 `AUDIT_HEATMAP_SCOPE_B3.md:126` ("B2 implement lúc code, B8 verify").
- **R2 (`scopeCount === 5`) — CHƯA ĐÓNG.** Grep toàn `packages/web/src` với `include:*test*` cho `scopeCount|Tất cả \(5\)|heatmapSymbols` → **0 match**; `PLAN:23` chỉ có Visual QA `PLAN:31`; glob ảnh trong `docs/evidence/dashboard-uiux/` → **0 file `.png`**. B4 `AUDIT_HEATMAP_SCOPE_B3.md:127` giao "B2 chạy gate + **B8 đọc ảnh QA**" — B8 **không có ảnh để đọc**, nên không thể xác nhận `5` thay vì `1833` trên staging. Kênh dự phòng (`useCoreDashboardData.js:163-166`) chưa được loại trừ bằng thực thi.

---

## 2. Findings (4)

### F1 — MINOR · R2 chưa đóng: `scopeCount === 5` không có assert tự động cũng không có ảnh QA
- **Evidence:** `PLAN...:23,31` (Visual QA) · `market-group-filter.component.test.ts:1-49` (0 lần nhắc `scopeCount`) · `DashboardPage.tsx:423` (`scopeCount={heatmapSymbols.length}` — cơ chế đúng nhưng chưa có test) · glob `docs/evidence/dashboard-uiux/*.png` = 0 · `AUDIT_HEATMAP_SCOPE_B3.md:127`.
- **Tác động:** không chứng minh được triệu chứng 1833 → 5 đã hết trên staging; nếu kênh `watchlists` (`useCoreDashboardData.js:163-166`) vẫn trả group có dấu, heatmap có thể vẫn >5 mà gate không bắt.
- **Đề xuất / ưu tiên:** **Trung bình** — thêm 1 test render/state assert `scopeCount === 5` với payload 5 `trackedSymbols` + 0 group user, **hoặc** deploy + chụp `/dashboard` rồi lưu ảnh vào `docs/evidence/dashboard-uiux/`. Nếu số vẫn >5, mở rộng sang kênh `watchlists` + `WatchlistContext.tsx:239,338` (R3).

### F2 — MINOR/EVIDENCE · Kết quả VPS 197/1304 / 5 fail / build 0 chỉ khớp số học, chưa có file evidence
- **Evidence:** `gates-p1p2.md:30` (196/1299), `market-group-filter.component.test.ts:10,19,24,30,42` (5 test), `git show 0debe3e3c` (chỉ ghi `TDD 5 RED → 5 GREEN, tsc 0`), `docs/CLAIMS.md:1988` (`in-progress`, `Gates CHƯA CHẠY`).
- **Tác động:** vi phạm `documentation-evidence-rule` — con số chỉ tồn tại ở yêu cầu/chat, không ai tái tạo được lệnh + exit-code. Đây **không phải** khẳng định sai; đây là khẳng định **chưa có bằng chứng**.
- **Đề xuất / ưu tiên:** **Cao (evidence)** — tạo `docs/evidence/dashboard-uiux/gates-heatmap-scope.md` với bảng `lệnh | exit code | output | revision | worktree dọn`, hoặc cập nhật `gates.md` thêm slice; ghi rõ baseline 5 SSE (`gates.md:40-42`).

### F3 — MINOR · Test source-scan là whitebox, thiếu assert tầng hook
- **Evidence:** `market-group-filter.component.test.ts:42-47` đọc file nguồn và `toContain("filterUserWatchlistGroups(rawWatchlistGroups)")`; `:30-40` mới là test hành vi helper.
- **Tác động:** test vẫn xanh nếu helper lọc đúng nhưng hook gọi nhầm chỗ khác (dù hiện tại code đúng ở `:170`); không thay đổi verdict vì B4 `:121` đã chấp nhận mức helper.
- **Đề xuất / ưu tiên:** **Thấp** — bổ sung 1 test hook mock `getLegacyWatchlistGroups` trả group 800 mã + assert `getBulkTechnicalsBySymbols` không nhận mã hệ thống (đúng B3 `AUDIT_HEATMAP_SCOPE_B3.md:70`); ghi rõ giới hạn source-scan trong evidence.

### F4 — DOC · Claim khai file ledger nhưng branch diff không có Entry mới
- **Evidence:** `docs/CLAIMS.md:1988` liệt kê `docs/CODE_CHANGE_AUDIT_LEDGER.md` trong cột files; `git diff --name-only dev...HEAD` = 6 file (CLAIMS, PLAN, AUDIT, marketGroups.ts, useCoreDashboardData.js, test) — **không có ledger**; `grep "heatmap-scope|1833" docs/CODE_CHANGE_AUDIT_LEDGER.md` → 0 match (Entry mới nhất của dashboard là `:10` P1P2).
- **Tác động:** `AGENTS.md` yêu cầu append Entry sau mỗi thay đổi; hồ sơ slice thiếu Entry riêng.
- **Đề xuất / ưu tiên:** **Thấp** — coordinator append 1 `## Entry N` cho slice này (không phải B8: auditor chỉ đọc, tránh đụng Entry của coordinator — xem `REAUDIT_B8.md:142`).

---

## 3. Next steps / owner

1. **B2 (implementer):** đóng F2 (file evidence VPS 197/1304 + 5 fail baseline + build 0). Trước khi coi hồ sơ hoàn chỉnh.
2. **B2 + B8:** đóng R2/F1 — assert tự động `scopeCount === 5` **hoặc** ảnh QA `/dashboard` lưu trong repo; nếu >5 thì mở rộng kênh `watchlists`.
3. **Coordinator:** đóng F4 (Entry ledger) + R3 (`WatchlistContext.tsx:239,338` cần ticket/owner — `AUDIT_HEATMAP_SCOPE_B3.md:128`).
4. **Không chặn merge:** F3 + R4 (citation `PLAN:9-11` vẫn ghi tắt path, doc-only) có thể đưa backlog.

**Gates của B8:** `read`/`grep`/`git show`/`git diff` tĩnh — **CHƯA CHẠY** `tsc`/`vitest`/`build`/VPS/visual replay (audit-only). Không báo PASS cho các gate đó. `git status --short` trước và sau khi ghi file này: chỉ có file evidence của B8.
