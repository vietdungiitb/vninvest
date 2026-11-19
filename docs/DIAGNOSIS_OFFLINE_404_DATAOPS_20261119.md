# Chẩn đoán: header "Offline" + 404 `/advisory/latest/VMG/` và `/billing/subscription` trên `/operations-center?tab=dataops`

- **Ngày**: 2026-11-19 · **Loại**: điều tra (read-only, 0 dòng source thay đổi) · **Repo**: `vninvest` · **Branch**: `dev`
- **Trigger**: ảnh chụp staging `https://docker.edusuccess.vn/operations-center?tab=dataops` + console:
  - `/core/v1/advisory/latest/VMG/` → 404
  - `/core/v1/billing/subscription` → 404
  - Header góc phải hiện chấm đỏ **Offline**
- **Lessons áp dụng**: `L-V01` (mọi kết luận phải có đối chứng), `L-V02` (không tin root-cause kế thừa), `L-V04` (404 không tự động = lỗi), `L-F01` (phân biệt tín hiệu thật vs tín hiệu hiển thị).

## 1. Kết luận ngắn (5 findings)

1. **Dữ liệu DataOps ĐÃ load** — ảnh chụp có số thật (`4.6M`, `4.582.503`, `1.899`, ngày `2026-11-19`). Không có lỗi tải dữ liệu ở trang này.
2. **"Offline" là chỉ báo realtime/WebSocket, KHÔNG phải trạng thái API.** Trang DataOps không đăng ký symbol realtime nào ⇒ feed `enabled=false` ⇒ status `idle` ⇒ header ghi nhầm thành `Offline`.
3. **404 `advisory/latest/VMG/` là empty-state có chủ đích**: chưa có `AdvisoryRecord` generated cho user + VMG + hôm nay. FE tự đổi thành `null`.
4. **404 `billing/subscription` là empty-state có chủ đích**: tenant chưa có dòng `Subscription`. `useTenantTier` fail-closed về `free`.
5. **Badge "LIVE" trong trang SOC là chuỗi tĩnh**, không đo health — cũng là tín hiệu sai (chiều ngược lại với "Offline").

⇒ **Không có sự cố mạng, không có route bị thiếu.** Đây là 3 tín hiệu gây hiểu lầm, không phải lỗi không load dữ liệu.

## 2. Bằng chứng (`file:line` tự mở đọc)

| # | File:line | Thực tế |
|---|---|---|
| E1 | `packages/web/src/layouts/full/vertical/header/Header.tsx:90-94` | `wsStatus` lấy từ `realtimeCtx.feed.realtimeStatus`; chỉ `'live'|'connected'` → `'connected'`, còn `'idle'|'connecting'|'polling'|'disconnected'` đều rơi vào nhánh hiển thị `Offline`. |
| E2 | `Header.tsx:331,334` | `wsStatus === 'connected' ? 'Online' : 'Offline'` — **mọi** trạng thái khác (kể cả đang kết nối) đều hiện `Offline`. |
| E3 | `packages/web/src/context/RealtimeContext.js:45-50` | `useRealtimeFeedCore({ enabled: aggregatedSymbols.length > 0 })` — không có symbol ⇒ feed tắt. |
| E4 | `packages/web/src/hooks/useRealtimeFeedCore.js:554-563` | `if (!enabled) { setRealtimeStatus('idle'); ... }` — nguồn trạng thái `idle`. |
| E5 | `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx:1-110` | Trang SOC/DataOps **không** import/gọi hook realtime nào; chỉ render các panel SOC. ⇒ `aggregatedSymbols = []`. |
| E6 | `packages/web/src/components/soc/SocDataOpsPanel.tsx:5,35-38` + `DataOpsContext.tsx:79-86,102-117` | DataOps tự load qua `defaultCoreApiAdapter.getSocDataOpsInventory()` — cùng core API, đang trả dữ liệu (xem ảnh). |
| E7 | `packages/core/backend/src/vninvest_core/urls.py:60,64` | Route được mount đúng: `core/v1/` + `commercial.urls` + `advisory.urls`. ⇒ URL trong console **không sai**, không phải 404 do route. |
| E8 | `packages/core/backend/src/advisory/views.py:276-289` | `AdvisoryLatestView.get()` trả `404` khi không tìm thấy `AdvisoryRecord(user, symbol, session_date=today, status='generated')`. |
| E9 | `packages/web/src/adapters/core/transport.js:453-459` + `market.js:472-480` | `coreGet` đổi 404 của `/advisory/latest/` thành `null`; `getAdvisoryLatest` cũng catch `status===404 → null`. Console vẫn log 404 ở Network, nhưng app xử lý là "chưa có dữ liệu". |
| E10 | `packages/core/backend/src/commercial/views.py:56-65` | `SubscriptionDetailView.get_object()` = `get_object_or_404(Subscription, tenant=tenant)` — tenant chưa có subscription ⇒ 404. Yêu cầu `billing:read` (`:60-61`). |
| E11 | `packages/web/src/adapters/useTenantTier.js:54-69` | `getBillingSubscription()` lỗi/403/không có sub ⇒ `tier='free'`, **không throw**. Gọi duy nhất ở `VNStockChartPanel.js:82`. |
| E12 | `ShellOperationsCenterPage.tsx:99-102` | Badge `LIVE` là chuỗi hardcode trong JSX, không đọc state. |

## 3. Phân tích nguyên nhân

### 3.1 "Offline" — nguyên nhân gốc (P1, UI sai)
`Header.tsx` dùng **trạng thái feed realtime** làm chỉ báo "Online/Offline". Trên `/operations-center?tab=dataops` (và mọi trang không có watchlist/chart), không component nào gọi `useRealtimeFeedFromManager()` ⇒ `RealtimeContext` nhận `symbols=[]` ⇒ `enabled=false` ⇒ `realtimeStatus='idle'` (E3/E4/E5) ⇒ Header hiển thị `Offline` (E1/E2). Nghĩa là indicator đang nói "không có symbol đang theo dõi", chứ **không** nói "API/network chết".

Ngoài ra, ngay cả khi feed thực sự đang `connecting` hoặc rơi về `polling` (fallback hợp lệ, `useRealtimeFeedCore.js:1001-1029,1191-1200`), header vẫn ghi `Offline` — nên indicator này sai ở cả 3 trạng thái.

### 3.2 404 `/core/v1/advisory/latest/VMG/` — empty-state (P2, không sửa gấp)
BE trả 404 vì chưa có advisory generated cho VMG ngày hôm nay (E8). FE đã thiết kế 404 = "chưa có dữ liệu" (E9). `VMG` đến từ luồng chi tiết mã/phí watchlist (`useStockDetailPageModel.js:187-191`, `WatchlistDetailPanel.tsx:69`) — có thể là request còn tồn từ bước điều hướng trước khi vào tab DataOps. Browser Network tab luôn hiện dòng đỏ 404 dù app đã nuốt lỗi; đây là chi phí UX của thiết kế dùng 404 làm empty-state.

### 3.3 404 `/core/v1/billing/subscription` — fail-closed (P2)
BE trả 404 vì tenant chưa có dòng `Subscription` (E10), hoặc user thiếu `billing:read` ⇒ 403 (không phải 404 trong ảnh này). FE `useTenantTier` nuốt mọi lỗi về `free` (E11). Request chỉ phát khi `VNStockChartPanel` mount (`VNStockChartPanel.js:82`) — không phải trang DataOps phát ra.

### 3.4 Dữ liệu DataOps
Panel lấy số qua `defaultCoreApiAdapter` (E6); ảnh chụp có số liệu thật ⇒ core API reachable. **Không có bằng chứng nào cho thấy "không load dữ liệu".**

## 4. Đề xuất xử lý (ưu tiên)

| ID | Mức | Việc cần làm | File dự kiến |
|---|---|---|---|
| R1 | **P1** | Header: phân biệt 4 trạng thái. Khi `consumerCount === 0` / `realtimeStatus === 'idle'` ⇒ hiện trung tính `—` hoặc "Chưa theo dõi" (xanh xám), **không** hiện `Offline`. `connecting` ⇒ "Đang kết nối"; `polling` ⇒ "Dự phòng"; chỉ `disconnected` mới đỏ + `Offline`. Thêm key i18n `layout.realtime.*` cả 2 locale. | `Header.tsx:90-94,327-335`, `i18n/locales/{vi,en}/layout.js` |
| R2 | P2 | Giữ nguyên 404 empty-state (đúng contract, có test chốt) **hoặc** nếu muốn hết dòng đỏ console: đổi BE sang `200 + {data:null}` — phải rà route manifest/tests, không làm vội. | `advisory/views.py:285-289`, `commercial/views.py:63-65` |
| R3 | P2 | Badge `LIVE` tĩnh trong SOC: gắn vào freshness thật của snapshot hoặc đổi nhãn thành "SOC" để khỏi ngược nghĩa với "Offline". | `ShellOperationsCenterPage.tsx:99-102` |
| R4 | P3 | Nếu tenant/staging cần có subscription (để không rơi `free`), tạo dòng `Subscription` cho tenant staging — việc dữ liệu/owner, không phải code. | DB staging |

## 5. Kiểm chứng cần làm trước khi sửa / sau khi sửa

- [ ] Reproduce trên staging: mở `/operations-center?tab=dataops`, Network filter `advisory/latest|billing/subscription`, xem status + response body (`detail: "Chưa có advisory..."` xác nhận E8).
- [ ] Mở tab **Tin hiệu** hoặc trang watchlist có symbol → header phải chuyển `Online` khi WS `live`; nếu không, mới điều tra nginx WebSocket upgrade.
- [ ] Test fail-before cho R1: component test mount `Header` với 4 giá trị `realtimeStatus` + `consumerCount=0` — assert không có chuỗi `Offline` ở trạng thái idle.
- [ ] Chạy `npx tsc --noEmit` + vitest component sau khi sửa (chưa chạy ở bước điều tra này).

## 6. Trạng thái / CHƯA CHẠY

- Đã làm: đọc code thật 12 vị trí, trace 3 luồng (header status, advisory latest, billing subscription), đối chiếu route mount.
- **CHƯA CHẠY**: curl/probe trực tiếp endpoint staging (cần token), test tự động, tsc/build, thay đổi code, deploy. Không báo PASS cho các hạng mục này.
- **Next / owner**: coordinator chốt R1 (sửa indicator) và R2 (giữ hay đổi contract 404) → mở slice riêng theo `workflow-dev-loop` (claim + feat branch) → verify trên VPS staging `14.225.255.47`.
