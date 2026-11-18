# B3 — Audit độc lập plan `PLAN_DASHBOARD_HEATMAP_SCOPE_20261118.md`

- **Ngày:** 2026-11-18 · **Auditor:** subagent độc lập, CHỈ ĐỌC (không sửa code runtime).
- **Scope:** đối chiếu `docs/PLAN_DASHBOARD_HEATMAP_SCOPE_20261118.md:1-39` với code thật trong repo.
- **Lessons áp dụng:** [L-V01, L-V02, L-V04, L-T01/T02] — mọi `file:line` được tự mở file/grep; không tin citation kế thừa.
- **Phương pháp:** `read` 12 file + `grep` 5 lượt (consumer, symbol, group catalog, test). Không chạy build/test (audit-only).

## VERDICT: **NEED_REVISION**

Root cause **ĐÚNG** (§1), hướng sửa tầng hook **không break consumer nào** (§3), nhưng **fix đề xuất KHÔNG đạt mục tiêu** vì danh sách `SYSTEM_GROUP_IDS` chỉ phủ 14/29 nhóm thị trường thật (O-1), AC #3 dùng tên group không tồn tại (O-2), và TDD là tautology / không phủ AC (O-3). Không REJECT vì vẫn có đường sửa ngắn (lọc theo `group_type` hoặc bỏ hẳn `watchlistGroups` khỏi symbol universe).

---

## 1. Kiểm tra root cause (câu 1) — ĐÚNG, cần hiệu chỉnh citation

| Plan nói | Code thật | Kết luận |
|---|---|---|
| `market.js:462-464` → `GET /stock-management/groups/?include_prices=0` | `packages/web/src/adapters/core/market.js:462-464` đúng 100% | ĐÚNG |
| Backend `:3821` nhóm này "KHÔNG phải danh mục do user tạo" | `packages/core/backend/src/market_data/stock_mgmt_native_views.py:3819-3823` đúng comment. ** Nhưng** endpoint GET thật là `:3678-3688`: `CachedSymbolGroup.objects.filter(is_active=True)` trả **mọi** group active, serialize ở `:706-719` (có `id`, `name`, `group_type` tại `:714`, `items` tại `:718`) | ĐÚNG ý, **citation chưa đủ** — phải trỏ thêm `:3681` để chứng minh 1833 mã đến từ đâu |
| `useCoreDashboardData.js:159-161`: giữ tất cả, không lọc | `packages/web/src/features/dashboard/useCoreDashboardData.js:159-161` → `const watchlistGroups = rawWatchlistGroups` kèm comment cũ "user follows" SAI | ĐÚNG (đường dẫn plan ghi tắt `src/hooks/`; thật là `src/features/dashboard/`) |
| `DashboardPage.tsx:243-246` thêm `watchlistGroups` vào heatmap; `:457` deck; `collectDashboardSymbols :168-173` gửi bulk | `packages/web/src/pages/DashboardPage.tsx:243-248`, `:454-457`; `useCoreDashboardData.js:168-173`, `collectDashboardSymbols` định nghĩa `:37-57` | ĐÚNG (đường dẫn plan ghi tắt `src/pages/dashboard/`; thật là `src/pages/`) |

⇒ **Root cause xác nhận**: P2-4 dùng nhầm nguồn (system universe) làm nguồn mã user. Ảnh staging 1833 mã nhất quán với `stock_mgmt_native_views.py:3681,3683`.

---

## 2. Câu 2 — `SYSTEM_GROUP_IDS` có khớp tên group tiếng Việt không? **KHÔNG ĐỦ**

`packages/web/src/constants/marketGroups.ts:21-29` có 14 slug. Metadata group SSOT (`_GROUP_METADATA` tại `packages/core/backend/src/market_data/vnbroker_adapter.py:1426-1460`, `_SECTOR_GROUPS :1463-1518`, `default_groups.py:14-189`) định nghĩa **29** tên; danh sách active thật phụ thuộc provider (`sync_cached_symbol_groups :1521-1527` soft-deactivate group Provider không trả) ⇒ cần repro staging, nhưng **không có tên nào trong metadata nằm ngoài allowlist lại được phép coi là đã lọc**.

**Khớp sau khi bỏ dấu** (7 sector + 5 index/exchange): `Ngân hàng→ngan-hang` ✓ · `Bất động sản→bat-dong-san` ✓ · `Dầu khí→dau-khi` ✓ · `Công nghệ→cong-nghe` ✓ · `VN30/VN100/HNX30/HOSE/HNX/UPCOM` ✓.

**Bẫy "&"**: `Thép & Vật liệu` (`:1483`) và `Bán lẻ & Tiêu dùng` (`:1510`) chỉ khớp `thep-vat-lieu`/`ban-le-tieu-dung` nếu slugify **gom chuỗi ký tự không-alnum thành 1 dấu `-`**. Slug hiện hữu ở `useCoreDashboardData.js:155` (`.toLowerCase().replace(/\s+/g,"-")`) cho ra `thép-&-vật-liệu` — plan chỉ ghi "slug hoá… bỏ dấu" mà **không định nghĩa phép thay thế** ⇒ implementer có thể viết sai ngay chỗ này.

**Không khớp / bị sót (14 nhóm system vẫn lọt vào heatmap sau fix):** `VNX50`, `VNXALL`, `VNALL`, `VNSmallCap`, `VNMidCap`, `VNSI`, `HNXCon`, `HNXFin`, `HNXLCap`, `HNXMSCap`, `HNXMan` (`vnbroker_adapter.py:1438-1444,1455-1459`), `ETF`, `CW`, `BOND`, `FU_INDEX` (`:1450-1453`). `SYSTEM_GROUP_IDS` chỉ có thêm `vn50` (`:23`) — thừa so với catalog nhưng không cứu được các nhóm trên.

**`Chứng khoán` (AC #3, `PLAN...:23`) KHÔNG phải tên group nào trong code**: grep toàn repo chỉ thấy nó là nhãn ngành/tên công ty (`vnbroker_adapter.py:107,115`) và trong marketing docs; `chung-khoan` ∉ `SYSTEM_GROUP_IDS`. AC này **không thể xanh** nếu viết test hành vi thật.

**Thêm**: `getLegacyWatchlistGroups()` chỉ trả `CachedSymbolGroup` (system) — **không có group do user tạo** trong response này. Vì vậy ý plan `:16,21` "sau lọc chỉ còn nhóm do user tạo" là sai bản chất; đúng là "sau lọc không còn group nào làm nguồn mã". AC #1 dùng `{id:99, name:"Theo dõi riêng"}` là case giả tạo, không đại diện dữ liệu thật.

---

## 3. Câu 3 — Sửa ở `useCoreDashboardData` có break consumer khác? **KHÔNG**

Grep `watchlistGroups` (30 match) + `useCoreDashboardData` (14 match) cho thấy:

- Hook `useCoreDashboardData` chỉ có **1 consumer**: `DashboardPage.tsx:162`.
- Trong DashboardPage, 3 điểm dùng: `heatmapSymbols :244-248`, `onDataReady :302`, `CoreDashboardPositionDeck :457` — **đều là mục tiêu cần sửa**. `onDataReady` chỉ được định nghĩa/truyền ở chính file này (5 match, không có consumer ngoài) ⇒ không có bên thứ ba bị ảnh hưởng.
- `collectDashboardSymbols` (`useCoreDashboardData.js:37-57`) là hàm nội bộ, chỉ gọi ở `:168` ⇒ sửa đúng chỗ.
- `CoreDashboardPositionDeck.tsx:120` và `FactsFirstModularPositionDeck.jsx:73` nhận `watchlistGroups` nhưng **chỉ được cấp qua `DashboardPage.tsx:457`** ⇒ tự động được lọc, không break.
- `modernDashboardSymbolUniverse.js:86-99` chỉ được gọi từ deck; test `modernDashboardSymbolUniverse.component.test.ts:9` truyền trực tiếp util `{name:"VN30"}` ⇒ không bị ảnh hưởng bởi fix tầng hook.
- Test hook cũ `dashboard_lifecycle.test.js:77,116,152` mock `getLegacyWatchlistGroups` = `{results: []}` ⇒ không assert nội dung group, **không break**.

⚠ Reservation: nếu chọn phương án "bỏ hẳn `watchlistGroups` làm nguồn mã" (O-1), source-scan test `wave2-source-contracts.component.test.ts:90-93` (`expect(s).toContain("watchlistGroups={watchlistGroups}")`) vẫn xanh vì prop vẫn truyền — nhưng AC/citation trong test đó phải cập nhật cho khớp ý nghĩa mới.

⚠ Rủi ro kênh thứ hai (ngoài scope plan nhưng liên quan trực tiếp đến triệu chứng): `useCoreDashboardData.js:154-157` lọc `watchlists` bằng slug **không bỏ dấu** ⇒ `Ngân hàng` → `ngân-hàng` ∉ `SYSTEM_GROUP_IDS`. `WatchlistContext.tsx:239-240,338-339` lặp cùng lỗi. Nếu `getWatchlists()` cũng trả group có dấu kèm `items`, heatmap vẫn nhận mã system dù đã sửa `watchlistGroups`. Cần một repro thực tế (xem O-5) trước khi khẳng định fix đủ.

---

## 4. Câu 4 — AC/TDD có tautology? **CÓ**

| Mục | Đánh giá |
|---|---|
| TDD `PLAN:27`: test mới import `isSystemMarketGroup` → ĐỎ trước fix | **Tautology kiểu "export chưa tồn tại"**: đỏ vì `undefined`, không phải vì hành vi sai. Sau khi export, test xanh mà không chứng minh lọc đúng. |
| Source-scan `useCoreDashboardData.js` phải có `.filter(...isSystemMarketGroup)` | **Tautology source-scan** (kiểu `wave2-source-contracts.component.test.ts:90-93`) — kiểm tra chữ trong code, không kiểm tra output. |
| AC #1 `PLAN:21` (`Ngân hàng` bị loại, group 99 giữ lại) | **Không có test hành vi nào bao phủ** — TDD chỉ có import + source-scan. Phải thêm test gọi thật hook với `getLegacyWatchlistGroups` trả group 800 mã + group user, assert state. |
| AC #2 `PLAN:22` (`scopeCount===5`, deck `"Tất cả (5)"`) | `scopeCount` truyền ở `DashboardPage.tsx:423` = `heatmapSymbols.length`; nhãn `"Tất cả ({count})"` ở `i18n/locales/vi/watchlist.js:44,151`. AC đúng về mặt cơ chế nhưng **chưa có assertion TDD**; cần test render/state. |
| AC #3 `PLAN:23` (`Chứng khoán` bị loại) | **Sai factual** (xem §2) — hoặc là test sẽ đỏ trên code đã fix, hoặc là tautology nếu chỉ scan source. |

**Tối thiểu phải thêm:** (a) test helper với payload thật `{id:7,name:"Ngân hàng"}` / `{id:7,name:"Thép & Vật liệu"}` / `{name:"VNX50"}` / `{name:"Theo dõi riêng"}`; (b) test hook assert `watchlistGroups` rỗng (hoặc chỉ group user) **và** symbols gửi `getBulkTechnicalsBySymbols` không chứa mã từ group system; (c) bỏ/sửa AC #3.

---

## 5. Câu 5 — Có cần hỏi owner không? **KHÔNG chặn; cần làm rõ trong plan (coordinator)**

Owner đã chốt triệu chứng (ảnh staging) ⇒ không cần quyết định sản phẩm mới để sửa bug. Tuy nhiên plan phải **tự trả lời 2 điểm** thay vì để implementer đoán:

1. Giữ hay bỏ `watchlistGroups` làm nguồn symbol? Vì endpoint này **100% là group system** (`stock_mgmt_native_views.py:3681`), "giữ phần còn lại của P2-4" (`PLAN:17`) mâu thuẫn với mục tiêu "chỉ mã user theo dõi". Khuyến nghị: **bỏ `watchlistGroups` khỏi `heatmapSymbols` và `collectDashboardSymbols`**, giữ 2 hook realtime/breadth/status.
2. Có sửa luôn kênh `watchlists` / `WatchlistContext` (`useCoreDashboardData.js:155`, `WatchlistContext.tsx:239,338`) không? Nếu có, phải đưa vào scope + AC; nếu không, ghi rõ non-goal kèm lý do repro.

---

## Objections (đánh số, bắt buộc sửa trước khi code)

**O-1 (BLOCKER) — Allowlist tên không đủ; fix không đạt mục tiêu.**
`SYSTEM_GROUP_IDS` (`marketGroups.ts:21-29`, 14 slug) sót 14 tên group system trong metadata (`vnbroker_adapter.py:1438-1444,1450-1453,1455-1459`; active hay không phải repro staging). API trả `group_type` (`stock_mgmt_native_views.py:714`) và **mọi group ở endpoint này đều là system**. ⇒ Sau fix heatmap vẫn nhận mã từ `VNX50`, `BOND`, `ETF`, `HNXFin`… ⇒ AC #2 vẫn đỏ trên staging. **Sửa:** lọc theo `group_type ∈ {SECTOR, MARKET_CAP, INDEX, EXCHANGE, ETF, CW, BOND, DERIVATIVE}` (hoặc bỏ hẳn nguồn này), kèm repro số mã trước/sau; nếu giữ allowlist thì phải đổi tên file thành "system group IDs" và đồng bộ toàn bộ catalog + test theo kiểu `chung-khoan`.

**O-2 (MAJOR) — AC #3 sai + slugify chưa định nghĩa.**
`Chứng khoán`/`chung-khoan` không tồn tại làm group (`vnbroker_adapter.py:107,115` chỉ là nhãn), ∉ `SYSTEM_GROUP_IDS`. Thay bằng `Bán lẻ & Tiêu dùng`/`Thép & Vật liệu` (`vnbroker_adapter.py:1483,1510`). Đồng thời plan `:15` phải ghi rõ thuật toán slug: bỏ dấu (NFD) → lowercase → **gom cụm ký tự không-alnum thành một `-`** → trim; nếu không, `thep-&-vat-lieu` ≠ `thep-vat-lieu`.

**O-3 (MAJOR) — TDD tautology, không phủ AC.**
Xem §4. Test import + source-scan phải được bổ sung bằng test hành vi ở tầng helper **và** tầng hook (assert symbols gửi bulk). Đây là điều kiện "đỏ trước fix" thật, không phải đỏ do module chưa export.

**O-4 (MINOR) — SSOT bị tách đôi.**
Plan `:15` thêm `isSystemMarketGroup` vào `marketGroups.ts` nhưng chỉ dùng ở hook. `WatchlistContext.tsx:239-240,338-339` vẫn tự slug (không bỏ dấu) với cùng `SYSTEM_GROUP_IDS`. Phải dùng chung helper ở cả 3 chỗ (`useCoreDashboardData.js:155`, `WatchlistContext.tsx:239,338`) hoặc ghi rõ non-goal + lý do.

**O-5 (MINOR) — Citation/path + premise.**
Plan ghi tắt đường dẫn (`src/hooks/useCoreDashboardData.js`, `src/pages/dashboard/DashboardPage.tsx`) → đúng là `src/features/dashboard/` và `src/pages/`. Endpoint GET nên trỏ `stock_mgmt_native_views.py:3678-3688` thay vì chỉ `:3821` (comment sync). Premise `:16,21` "chỉ còn nhóm do user tạo" phải đổi thành "không còn group nào từ endpoint system làm nguồn mã".

---

## Gates

**CHƯA CHẠY** — audit-only, không sửa code, không chạy `tsc`/`vitest`/build. Mọi khẳng định ở trên chỉ dựa trên `read`/`grep` tĩnh; số lượng group (14 sót) đếm từ catalog source, **chưa đo trên staging DB** — cần repro thực tế trước khi merge (L-V02).

## Next steps / owner

- Coordinator (B2) sửa O-1→O-5 rồi gửi lại B3 re-audit; **không code trước khi O-1 được chốt**.
- Owner: không cần quyết định mới; chỉ xác nhận ảnh staging (1833) sau repro nếu muốn chốt hướng "bỏ nguồn group" thay vì "lọc tên".

---

## B4 CONSENSUS

- **Ngày:** 2026-11-18 · **VERDICT: PASS (có reservation)** — consensus check, KHÔNG phải vòng audit mới; chỉ đọc plan amend `docs/PLAN_DASHBOARD_HEATMAP_SCOPE_20261118.md:1-39` + đối chiếu ngược 5 objection trong file này.

| Objection | Amend | Kết luận |
|---|---|---|
| **O-1 BLOCKER** (allowlist 14/29) | `PLAN:15` đổi sang `group_type ∈ SECTOR\|INDEX\|EXCHANGE\|ETF\|CW\|BOND\|DERIVATIVE` làm tiêu chí chính, slug NFD/bỏ dấu/gom separator làm fallback; `PLAN:22` AC phủ 29 nhóm kể cả `VNX50`, `HNXCon`, `FU_INDEX` | **HẾT**. `group_type` có thật trong payload (`stock_mgmt_native_views.py:714`) và phủ toàn bộ metadata (`vnbroker_adapter.py:1426-1459`). Reservation R1 nhỏ bên dưới. |
| **O-2** (`Chứng khoán` sai + slug "&") | `PLAN:22` thay bằng `Thép & Vật liệu`; `PLAN:15` định nghĩa rõ NFD → bỏ dấu → lowercase → gom separator | HẾT. |
| **O-3** (TDD tautology) | `PLAN:27` thêm test hành vi `filterUserWatchlistGroups([...])` + 29 case + source-scan, bỏ test chỉ-check-export | HẾT ở mức helper. Reservation R2: AC `scopeCount===5` vẫn chỉ có Visual QA (`:31`), không có assertion tự động. |
| **O-4** (SSOT `WatchlistContext`) | `PLAN:16` ghi rõ follow-up, không sửa slice này | CHẤP NHẬN. Reservation R3: phải có ticket/owner, nếu không sẽ drift. |
| **O-5** (citation/path) | Chưa sửa `:9-11` (vẫn ghi tắt đường dẫn + chỉ `:3821`) | Reservation R4 (doc-only, không block). |

**Reservation còn lại — ai đóng:**
- **R1 (MINOR):** `group_type="MARKET_CAP"` tồn tại ở `default_groups.py:98,137` nhưng không nằm trong set `PLAN:15`. VN30/VN100 vẫn bị fallback slug bắt (`marketGroups.ts:23`), nên không block — nhưng thêm `MARKET_CAP` vào set chính cho chắc. **Đóng: B2 (implementer) lúc code, B8 verify.**
- **R2 (MINOR):** AC #2 `scopeCount===5` / deck `"Tất cả (5)"` (`PLAN:23`) không có test tự động; chỉ Visual QA `PLAN:31` (deploy + **mở ảnh**). **Đóng: B2 chạy gate + B8 đọc ảnh QA**; nếu số mã vẫn > 5 thì quay lại slice này, mở rộng sang kênh `watchlists` (`useCoreDashboardData.js:154-157` lọc slug không bỏ dấu) — kênh đó hiện chỉ là giả thuyết: `seed_default_watchlist_groups` (`stock_mgmt_native_views.py:3691-3699`) ghi vào `CachedSymbolGroup`, không vào `Watchlist` user, và legacy default watchlists đã bị xoá bởi migration `0011_delete_default_watchlists.py`.
- **R3 (MINOR):** follow-up `WatchlistContext.tsx:239,338` cần ticket + owner (coordinator) để không bị rơi; không block bug heatmap vì component này chỉ hiển thị danh mục, không cấp mã cho heatmap. **Đóng: coordinator/owner.**
- **R4 (DOC):** sửa path/citation `PLAN:9-11` → `src/features/dashboard/`, `src/pages/`, thêm `stock_mgmt_native_views.py:3681-3688`. **Đóng: B2 khi gist plan vào commit/ledger.**

**Gates vẫn CHƯA CHẠY** — consensus là doc-only; mọi assertion trên là tĩnh. Điều kiện merge: `PLAN:31` chạy thật + có ảnh `/dashboard` được mở.
