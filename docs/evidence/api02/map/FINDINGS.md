# api02-m3 — Bản đồ endpoint ↔ FE consumer ↔ field đọc

`verified: 2026-09-30 @ 4717fc1e` · agent `api02-m3` · **CHỈ ĐỌC**, không sửa code, không chạy test FE.
Worktree `C:\Mujoco Projects\w3-m3` · `git status --short` sạch, HEAD = `4717fc1e`.

Dữ liệu: [`fe.csv`](fe.csv) (UTF-8, 468 dòng = header + 467 dòng dữ liệu).
Script tái lập: [`scripts/`](scripts/) — chạy từ thư mục này:

```
node scripts/emit.mjs && node scripts/then.mjs && node scripts/clean.mjs   # -> fe.csv
node scripts/coerce.mjs        # 20 literal  Number(x) || 0
node scripts/coerce3.mjs       # 21 money-field  X.field || 0
node scripts/dualread.mjs      # 15 dual-read + 65 .data field
node scripts/coerce-final.mjs  # tổng hợp A+B
node scripts/stats.mjs         # census
```

Đã xoá `fe.csv` + `scripts/.cache` rồi chạy lại từ đầu: ra đúng 468 dòng, 0 `<unresolved>`, 0 U+FFFD.

---

## 0. Kiểm chứng 4 điều đã biết sẵn

| Điều được nói trước | Kết quả | Bằng chứng |
|---|---|---|
| Adapter `core/*` không `fetch` trực tiếp | **Đúng** — 0 `fetch(` trong 13 file `adapters/core/*.js` trừ `transport.js` | `grep -c "fetch(" adapters/core/*.js` → chỉ `transport.js` |
| Payload thoát ra ở 4 điểm `transport.js` | **Đúng** | `transport.js:459` (`coreGet`→`response.json()`), `:490` (`corePost`), `:512` (`corePut`), `:535` (`corePatch`). `coreDelete:556` trả **luôn `null`**. Thêm `coreAdapter.js:69` (`requestJson`→`response.json()`) và `transport.js:572` (`publicPost`→`payload`) |
| 11 chỗ dual-read `response.data ?? response` | **Không khớp** — tôi đo được **15** dòng khớp mẫu `?.data ??` (xem §4) | `node scripts/dualread.mjs` |
| 145 file production | **Sai** — tôi đo được **364** file production | `node scripts/emit.mjs` → `prod code files (all): 364` |
| 26 file đọc payload | **Sai** — tôi đo được **90** file có adapter call, **58** file có ≥1 field read định danh | `node scripts/stats.mjs` |

Lưu ý về "145": có thể là con số của một scope hẹp hơn (ví dụ chỉ `pages/` + `components/`, hoặc chỉ file `.tsx`).
Tôi **không** tìm được tập nào cho đúng 145. Ghi `ƯỚC LƯỢNG` cho con số này, dùng **364** làm chuẩn.

---

## 1. Census

| Đại lượng | Số | Lệnh |
|---|---:|---|
| File code production (`.js/.jsx/.ts/.tsx`, trừ test/`__tests__`/`__mocks__`) | **364** | `node scripts/emit.mjs` |
| File production **ngoài** `adapters/` | 344 | `node scripts/emit.mjs` |
| **File consumer** (≥1 adapter call) | **90** | `node scripts/stats.mjs` |
| File có ≥1 field read định danh | **58** | `node scripts/stats.mjs` |
| File gọi adapter nhưng không đọc field nào (fire-and-forget / chuyển tiếp) | 32 | `node scripts/stats.mjs` |
| Adapter method được định nghĩa | **379** | `node scripts/emit.mjs` |
| Method **có** ≥1 call site từ FE production | **258** | `node scripts/stats.mjs` |
| Method **không** được gọi từ FE production | **121** | `node scripts/stats.mjs` |
| Endpoint path khác nhau FE chạm tới | **228** | `node scripts/clean.mjs` |
| Dòng CSV (header + dữ liệu) | **468** | `Get-Content fe.csv \| Measure-Object -Line` |
| Dòng có field read thật | **230** | `node scripts/stats.mjs` |

Không có consumer nào destructure adapter — đã kiểm: `const {...} = (coreApiAdapter|api|adapter)` → **0 hit**
(`Select-String -Pattern 'const\s*\{[^}]*\}\s*=\s*(defaultCoreApiAdapter|coreApiAdapter|api|adapter|api)\b'`).
⇒ mọi consumer đều gọi `receiver.method(...)`, nên quét `\.method\(` là đủ.

---

## 2. Phân bố `read_style` / `nullable_guard` (trên 230 dòng có field read thật)

```
read_style     : flat=135   optional=82   coerced=13
nullable_guard : Y=146      N=84
```
⚠ **Con số `coerced=13` trong CSV KHÔNG phải tổng số chỗ coercion.** Nó chỉ bắt được coercion xảy ra
**trên cùng dòng** với field read. Phần lớn coercion nằm ở chỗ khác (xem §3) — đó là lý do tôi
đếm riêng bằng 3 script.

### Độ tin cậy của cột `endpoint_path`
Mỗi dòng mang nhãn phạm vi trong cột `notes` (`var=<tên> SAME_SCOPE|FALLBACK_SCOPE call@<dòng>`):

| Nhãn | Số dòng | Ý nghĩa |
|---|---:|---|
| `SAME_SCOPE` | 133 | Biến được gán và đọc trong cùng brace-depth → tin cậy |
| `FALLBACK_SCOPE` | 76 | Không khớp depth, dùng phép gán gần nhất → **cần người rà** |
| không nhãn (từ pass `.then()`) | 21 | Pass này không tính scope |

Tôi **đã rà tay 76 dòng `FALLBACK_SCOPE`** và tìm **2 cụm sai (17 dòng)**:
- `components/soc/SocSignalsPanel.tsx:2435-2443` — `st` là phần tử mảng `subTabs` cục bộ, không phải payload.
- `pages/watchlist/components/WatchlistSidebar.tsx:198-308` — `wl` là tham số `.map(wl => …)`, không phải payload.

⇒ **Độ chính xác ước lượng ~213/230 ≈ 93%** cho cột `endpoint_path`. 17 dòng sai đã biết tên, nằm trong `FALLBACK_SCOPE`.

---

## 3. `coerced` — bài toán lớn nhất của việc bọc envelope

Đo bằng 3 kịch bản khác nhau, vì "coerced" có 2 hình dạng:

### A) Đúng nghĩa chữ `Number(...) || 0` → **20 dòng**, chỉ **8** đọc field của response

`node scripts/coerce.mjs` → `Number()||0 = 20`

| Phân loại (đã đọc tay từng dòng) | Số dòng | File |
|---|---:|---|
| **ĐỌC RESPONSE** | **8** | `StockOrderBookWidget.jsx:69,73,79,80,89` (`b.volume`/`a.volume`/`level.volume`); `AIUsageDashboard.tsx:100` (`row.total_tokens_in`); `orderFlowFallback.js:41` (`summary.total_orders`); `useOrderBubbleCoordinates.js:125` (`order.volume`) |
| Ghi **request** (form → payload) | 6 | `SocSignalsPanel.tsx:894,966,967,969`; `AICommandCenterForm.tsx:287`; `TenantAdminWebhooksPage.tsx:500` |
| Tham số / view-model cục bộ | 6 | `PortfolioHeatmap.js:51,87,88`; `SupportOpsDashboard.js:10`; `whaleTimeAdapter.js:88`; `useRealtimeFeedCore.js:344` |

⇒ 8/20 là payload read. **5/8 không phải tiền** (volume + token count) — mất dữ liệu thì hiển thị 0, thị giá sai nhưng không nói dối về NAV.

### B) Hình dạng **nguy hiểm hơn**: `x.field || 0` / `Number(x.field || 0)` — **21 chỗ đọc field TIỀN**

Đây mới là "0 giả" thật, vì **không** ai làm `Number()`. `node scripts/coerce3.mjs`

| File | Field tài chính | Dòng |
|---|---|---|
| `pages/watchlist/components/WatchlistContext.tsx` | `market_value`, `unrealized_pnl`, `avg_cost` | 41, 42, 49, 55, 56, 57, 64, 65 |
| `pages/watchlist/components/WatchlistTable.tsx` | `market_value`, `unrealized_pnl`, `avg_cost` | 256, 257, 258, 259 |
| `components/dashboard/PortfolioHeatmap.js` | `current_price`, `market_cap` | 175, 179, 195 |
| `pages/DashboardPage.tsx` | `current_price`, `market_cap` | 235, 242, 243 |
| `hooks/useAIAdvisor.js` | `market_value` | 113, 121 |
| `pages/AlertCenterPage.tsx` | `total_value` | 360 |

**21 chỗ / 6 file / 6 field tiền.** A và B **không giao nhau** (kiểm bằng script: `overlap = 0`).

⇒ **TỔNG chỗ coercion trên field của response = 29** (8 + 21).
Trong đó **21 là field tài chính**; 8 là volume/token (đếm, không phải tiền).

### Vì sao 21 chỗ kia mới đáng sợ
`pages/watchlist/components/WatchlistContext.tsx:40-42,55-57`:
```js
const qty = Number(h.quantity || 0);
const mv  = Number(h.market_value || 0);      // :41
const pnl = Number(h.unrealized_pnl || 0);   // :42
...
market_value:  Number(prev.market_value || 0) + mv,   // :55
unrealized_pnl: Number(prev.unrealized_pnl || 0) + pnl, // :56
```
Nếu BE bọc `{data:{…}}`: `h` vẫn là **list rỗng** (xem §5, `normalizeHoldingsList:70-73`), `mergeHoldingsBySymbol([])` → `[]` ⇒ watchlist **trống**, không phải 0.
Nhưng nếu chỉ payload **object** bị bọc mà list không bị bọc, `h.market_value` → `undefined` ⇒ `Number(undefined || 0)` = **0** ⇒ **tổng giá trị + P&L = 0 giả**, và `unrealized_pnl_pct` ở `:66` = `cost>0 ? (0-cost)/cost*100` = **−100%**. Đó là con số sai tuyệt đối, không phải "chưa biết".

---

## 4. Guard `null` — kết luận

### 4.1 Hai file đã biết: **guard ĐÚNG**

**`components/dashboard/SmartStatsHeader.js` @ 4717fc1e** — đây là mẫu chuẩn, ngược với phần lớn repo:

| Dòng | Nội dung |
|---|---|
| `:42` | `const rawMarketValue = summary?.total_market_value;` |
| `:43-44` | `marketValueKnown = raw !== null && raw !== undefined && raw !== ""` — guard tường minh 3 trạng thái |
| `:45` | `const marketValue = marketValueKnown ? Number(raw) : 0;` — **ternary, KHÔNG `\|\| 0`** |
| `:48-50` | lặp lại y hệt cho `total_unrealized_pnl` |
| `:51-54` | lặp lại y hệt cho `total_unrealized_pnl_pct` |
| `:65` | `isEmptyPortfolio = !loading && marketValueKnown && marketValue === 0 && !hasAnalytics` |
| `:120` | `marketValueKnown ? marketValue.toLocaleString("vi-VN") : "—"` |
| `:133`, `:140`, `:177` | `dayPLKnown ? … : "—"`, `dayPLPctKnown ? … : "—"`, `metric.value == null ? "--" : …` |

Comment `:29-41` giải thích đúng cơ chế: `Number(null) === 0` nên `|| 0` sẽ biến một danh mục **có vị thế thật** thành danh mục **TRỐNG**.

`|| 0` duy nhất trong file là `:94,198,200-204` trên `realtimeBreadth.up/down/flat` — **số đếm**, không phải tiền. Mất thì hiện 0, chấp nhận được.

**`components/dashboard/smart-stats-header-null-value.component.test.js`** — 5 test, kiểm **hành vi** (không kiểm source, đúng như docstring `:15` nói):

| Dòng | Test | Khẳng định |
|---|---|---|
| `:51-56` | `total_market_value: null` | **không** hiện CTA "danh mục trống" |
| `:58-61` | `total_market_value: null` | hiện `—`, không hiện `0` |
| `:63-66` | `total_market_value: "0.00"` | **có** hiện CTA (0 thật mới là trống) |
| `:68-77` | `"75000000.00"` | hiện `75.000.000` / `+5.000.000` / `7.14%` |
| `:79-88` | `total_unrealized_pnl` | đọc đúng tên field, không phải `..._pl` (typo cũ → "0 giả") |

**Khi BE bọc envelope, `SmartStatsHeader` hỏng kiểu nào?** `summary` thành `undefined` →
`summary?.total_market_value` = `undefined` → `marketValueKnown = false` → hiện **`—`**, và CTA trống **không** hiện.
⇒ **fail-safe**: mất dữ liệu, **không** sinh "0 giả". Đây là hành vi đúng mong muốn.

### 4.2 Nhưng guard chỉ đúng nếu payload tới đúng chỗ — và nó **không** tới

`pages/DashboardPage.tsx:327` truyền thẳng `summary={summary}`.
Nguồn: `features/dashboard/useCoreDashboardData.js:134` → `:193` `summary: summaryRes ?? null`.
`?? null` là **guard truthiness**, **không** phải dual-read: nếu BE bọc, `summaryRes = {data:{…}}` là **truthy** ⇒ `?? null` **không** kích hoạt ⇒ `summary = {data:{…}}`.
`SmartStatsHeader` đọc `summary.total_market_value` trên object đó ⇒ `undefined` ⇒ `—`.

### 4.3 Kết luận về guard `null` (nói thẳng)

| Lớp | Số | Đánh giá |
|---|---:|---|
| Guard tường minh 3 trạng thái (không dùng `\|\| 0`) | **1 file** | `SmartStatsHeader.js` — chuẩn, có test |
| `\|\| 0` trên **field tiền** | **21 chỗ / 6 file** | **NGUY HIỂM** — `null` → `0`, hiển thị sai |
| `\|\| 0` trên field đếm (volume, token, `count`, `synced_count`, `length`, `status`) | ~28 dòng | Rủi ro thấp (0 là giá trị hợp lý của số đếm) |
| `\|\| 0` trên **request**/form | 7 dòng | Vô hại |
| Guard `?? 0` nhưng có fallback chuỗi | 3 dòng (`AICommandCenterForm.tsx:287` `?? 0.3`) | Vô hại |

**84/230 dòng (36%) `nullable_guard = N`.** Đó là tỉ lệ lớn, nhưng phần lớn `N` là field đếm, không phải tiền.
**Nguy hiểm thật sự = 21 chỗ tiền ở §3B.**

---

## 5. Phát hiện nghiêm trọng hơn `|| 0`: **silent-empty fallback**

Không nằm trong định nghĩa `coerced`, nhưng **nguy hiểm hơn** vì không báo lỗi, không log, và trông giống hệt
"tài khoản thật sự không có gì":

**`features/dashboard/useCoreDashboardData.js:22-27`**
```js
function safeResults(res) {
  if (!res) return EMPTY_ARRAY;
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.results)) return res.results;
  return EMPTY_ARRAY;          // <-- nuốt, không lỗi
}
```
Nếu BE bọc `{data:[…], meta}`: không phải array, `res.results` undefined ⇒ **`EMPTY_ARRAY`**.
Áp dụng cho **4/7** fetch song song ở `:133-138`: `holdings`, `watchlists`, `trackedSymbols`, `watchlistGroups`.
Thêm `extractTechnicalsResponse:29-35` cùng dạng ⇒ `technicals` (tổng cộng **5/7**).

**`pages/watchlist/components/WatchlistContext.tsx:70-73`** — `normalizeHoldingsList` cùng dạng ⇒ holdings rỗng.

**`pages/watchlist/components/WatchlistContext.tsx:268`, `:278`** — cùng dạng cho `portfolios` / `tracked`.

⇒ Đây là kênh hỏng **âm thầm** số 1 khi đổi shape, trước cả `|| 0`. `SmartStatsHeader` an toàn; **watchlist + dashboard thì không**.

---

## 6. Chỗ nào **đã** mong đợi wrapper (`data`)

`node scripts/dualread.mjs` → **15** dòng khớp mẫu `?.data ??`, **65** dòng đọc field dưới `.data`.
**Không phải cái nào cũng là envelope** — phải phân loại:

### 6a. ĐÃ envelope-tolerant (đọc `.data` trên success payload) — an toàn khi bọc
| File:dòng | Cú pháp |
|---|---|
| `adapters/chartAdapter.js:138`, `:163` | `const data = res?.data ?? res;` |
| `components/workstation/hooks/useOrderBook.js:29` | `return response.data ?? response;` |
| `components/workstation/hooks/useSessionFacts.js:28` | `return response.data ?? response;` |
| `components/workstation/hooks/useTradeLog.js:32` | `return response.data ?? response;` |
| `components/advisory/RecommendationHistoryMini.js:36` | `res?.results \|\| res?.data?.results \|\| res?.data \|\| []` |
| `components/dashboard/PortfolioHeatmap.js:378` | `result?.data \|\| result?.results \|\| []` |
| `components/WhaleBubbleChart.jsx:669` | `response?.data \|\| response \|\| {}` |
| `components/WhaleBubbleChart.jsx:617` | `response?.data?.signals \|\| response?.signals \|\| []` |
| `features/stock-detail/hooks/useStockDetailPageModel.js:38-41` | `payload.data?.points` / `.results` / `.bars` / `.candles` |
| `hooks/useWhaleAdvisoryData.js:274-275` | `advisoryResp?.data?.discovery_signals \|\| …` |
| `pages/SupportPage.tsx:90,122,123` | `response?.results \|\| response?.data?.results \|\| response \|\| []` |
| `pages/tenant-admin/TenantAdminBillingPage.tsx:142` | `invData?.results \|\| invData?.data \|\| []` |
| `pages/watchlist/components/WatchlistContext.tsx:75-79` | **`parseNavValue`** — 6 nhánh: `r?.nav ?? r?.net_asset_value ?? r?.total_value ?? r?.data?.nav ?? r?.results?.nav`, rồi `Number.isFinite(parsed) && parsed > 0 ? parsed : null` — **mẫu tốt nhất trong repo** |
| `context/PortfolioContext.js:448`, `:490` | `payload?.data?.access ? payload.data : payload` — khớp `transport.js:253-270 normalizeRefreshResponsePayload` |
| `hooks/useRealtimeFeedCore.js:36` | `res?.access \|\| res?.data?.access \|\| null` |

⇒ **15 chỗ đã sẵn sàng** cho envelope. 5 nhóm "dual-read 11 chỗ" mà brief nêu là **tập nhỏ nhất**; phần lớn chỗ đọc `.data` còn lại là nhóm dưới.

### 6b. **KHÔNG** phải envelope — false positive (đừng đụng)
| File:dòng | Vì sao |
|---|---|
| `pages/watchlist/components/WatchlistContext.tsx:290-293` | `watchlistsRQ.data` là **react-query**; `.wlList/.groupsList/…` là shape trả về của chính `queryFn` |
| `pages/tenant-admin/TenantAdminMembersPage.tsx:92-94` | `membersQuery.data?.members` — react-query |
| `pages/tenant-admin/TenantAdminPATsPage.tsx:130-131` | `tokensQuery.data?.results` — react-query |
| `pages/tenant/TenantKeysPage.tsx:109`, `TenantUsageSummaryPage.tsx:64-65` | react-query |
| `components/dashboard/PortfolioHeatmap.js:319,359,438,442` · `WhaleBubbleChart.jsx:513` · `utils/whaleTooltipFormatter.js:71` | `params.data` là **echarts** |
| `AIAuditLogsPanel.tsx:55` … `ScreenerPage.tsx:208,312,346,427,454-457` · `AdvisoryOrderTicket.js:62` · `ScreenerSchedulePanel.tsx:97` · `WhaleAnalyticsAdvisoryModal.jsx:37,62` · `useWhaleAdvisoryData.js:317,357` | `err.response.data.*` — **payload lỗi kiểu axios**, không thuộc success envelope |

---

## 7. Chỗ đọc payload qua nhiều lớp biến trung gian (dễ sót khi đổi shape)

Xếp theo số lớp trung gian:

| Tầng | Chuỗi | Vì sao dễ sót |
|---|---|---|
| **4 lớp** | `useCoreDashboardData.js:134` `summaryRes` → `:193` `state.summary` → `DashboardPage.tsx:139` destructure → `:327` prop `summary` → `SmartStatsHeader.js:42` đọc field | Đổi tên biến ở bất kỳ tầng nào cũng cắt chuỗi. Không có type nào bắt (props JS không kiểm) |
| **4 lớp** | `WatchlistContext.tsx` adapter → `normalizeHoldingsList:70` → `mergeHoldingsBySymbol:34` (export) → `WatchlistTable.tsx:256-259` | Hàm `mergeHoldingsBySymbol` **export** ra ngoài, dùng ở file khác; grep tên field không ra endpoint |
| **3 lớp + truyền hàm** | `useRealtimeFeedCore.js:6-7` `const getRealtimeTickers = (symbols) => coreApiAdapter.getRealtimeTickers(symbols);` → truyền đi làm callback | Endpoint **không xuất hiện** cùng dòng với chỗ đọc field. Đây là dạng "deferred loader" |
| **3 lớp + truyền hàm** | `AdvisoryBacktestPanel.js:25` `const loader = fetchBacktest \|\| ((s,w) => coreApiAdapter.getAdvisoryBacktest(s,w));` · `AdvisoryAlertDialog.js:34` `createPriceAlert` · `AdvisoryOrderTicket.js:42` `placeDNSEOrder` | Giống trên |
| **3 lớp** | `AdvisoryOrderTicket`/`DNSEConnectionPanel.js:117,135,148` `res?.synced_count` → `setSyncResult({count})` → render | Giá trị bị **đóng gói vào object UI state** trước khi render ⇒ đổi shape không lộ ra chỗ đọc |
| **2 lớp + closure anh em** | `ScreenerHistory.tsx:129` `res` (backtest) và `res` (daily-prices) — **cùng tên, khác scope** | Chính tôi đã bị nhầm chỗ này khi trace tự động; đã sửa bằng brace-depth, còn `SocSignalsPanel.tsx:2435` + `WatchlistSidebar.tsx:197` thì **sai thật** |
| **2 lớp, qua react-query** | `WatchlistContext.tsx:280` `return {wlList, groupsList, holdingsList, trackedList, nav}` → `:289-297` đọc `watchlistsRQ.data.*` | Shape trung gian tự định nghĩa, không liên quan envelope |

**Khuyến nghị cho B3 (unwrap tập trung):** unwrap ở `transport.js` 4 điểm + `coreAdapter.js:69` là đúng chỗ
(giữ được 15 chỗ 6a chạy tiếp qua `?? x`), nhưng **phải kèm** sửa `safeResults` / `extractTechnicalsResponse` /
`normalizeHoldingsList` — nếu không, 5/7 fetch của dashboard và holdings của watchlist sẽ **rỗng trong im lặng**,
tệ hơn nhiều so với hiện trạng.

---

## 8. Điều **không** xác minh được

| # | Vì sao |
|---|---|
| 1 | **Chưa chạy test FE** (`node_modules` không cài đủ — theo lệnh). Mọi kết luận về *hành vi runtime* là **đọc code**, không phải **quan sát**. Đặc biệt: chưa xác nhận `SmartStatsHeader` thực sự render `—` khi `summary` là `undefined` (lập luận từ `:43-45,120`, chưa chạy) |
| 2 | **Chưa biết backend có thực sự bọc những endpoint này không.** Bản đồ này là phía FE. 228 endpoint × field có thể không cùng tồn tại với 583 call site BE trong `PLAN_ENVELOPE_MIGRATION_v2.md:18` — hai tập endpoint **không** được đối chiếu chéo ở đây |
| 3 | **Chưa phân biệt được** 6 request *ghi* (`POST`/`PUT`/`PATCH`) — cột `endpoint_path` có verb nhưng bản đồ chỉ ghi path. Backend đổi shape **response** không ảnh hưởng request, nhưng ngược lại thì có |
| 4 | `read_style` không phân biệt `p.foo` trong **biểu thức điều kiện** (`x && x.foo`) với **phép gán** — cả hai đều thành `flat`. Ước lượng ~15% dòng `flat` thuộc loại đầu |
| 5 | `nullable_guard` đánh giá **trên một dòng**. Guard nằm ở dòng trên (kiểu SmartStatsHeader `:43-44` tách khỏi `:45`) bị tính là `N`. Vì vậy 84 dòng `N` là **trần**, không phải đếm chính xác |
| 6 | Chưa đối chiếu `src/types/vninvestcharts-widget.d.ts` (nguyên tắc 4 của `AGENTS.md`) — phạm vi chỉ là payload của `coreApiAdapter`, không phải shape của widget |
| 7 | 17 dòng `FALLBACK_SCOPE` sai đã biết tên (§2); có thể còn dòng sai mà tôi **không** rà tay trong 21 dòng không nhãn của pass `.then()` |
| 8 | Con số "145 file production" trong brief không tái lập được ở bất kỳ scope nào tôi thử — ghi `ƯỚC LƯỢNG`, dùng 364 |
