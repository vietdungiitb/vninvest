# AUDIT — Tải dữ liệu mã chứng khoán chậm (`/stocks/:symbol`)

- **Ngày**: 2026-11-21
- **Phạm vi**: `/stocks/VIC` trên staging `https://docker.edusuccess.vn` (branch `dev` đã deploy), luồng auth bootstrap → stock detail → widget biểu đồ.
- **Phương pháp**: reproduce-first (Playwright Chromium thật, đăng nhập `testuser@vninvest.vn`), capture toàn bộ network request + timing; đối chứng bằng `curl` với token mới; probe trực tiếp trong container `vninvest-core-api` qua SSH VPS. Không suy luận từ comment/tài liệu.
- **Kết luận ngắn**: **không phải lỗi widget hay bundle FE.** Nguyên nhân chi phối là **độ trễ API backend 5–12 giây/request**, cộng thêm **bootstrap FE tuần tự** và **~15 request fan-out** khi mở 1 mã. Tổng thời gian đo được từ lúc điều hướng đến lúc biểu đồ render xong: **~30 giây**. Hai dòng `404` trong console là **trạng thái "chưa có dữ liệu" được xử lý sẵn**, không gây chậm.

---

## 1. Bằng chứng tái hiện

### 1.1 Playwright (Chromium, đã đăng nhập, `/stocks/VIC`)

Lệnh: `node <temp>/diag-stock-load2.mjs` (scriptcapture request/response, chạy trên `packages/web`, dùng Playwright có sẵn).

| Thời điểm (ms) | Trạng thái UI quan sát được |
|---|---|
| 3.635 | `Đang xác thực tài khoản...`, **0 request stock API** |
| 8.641 | vẫn `Đang xác thực tài khoản...`, **0 request stock API** |
| 18.650 | shell đã render, `Đang tải biểu đồ...` (Suspense) + `Đang đồng bộ...` |
| 33.659 | biểu đồ render xong, hết spinner |

Network (trích, `status duration method path`):

```
200  4826ms  GET /core/v1/auth/me/
200  4824ms  GET /core/v1/identity/profile/
200  1451ms  GET /core/v1/tenant/lifecycle/
200  3442ms  GET /core/v1/workspace/portfolios/
200 12174ms  GET /core/v1/signals/alert-center/summary?timeframe=session
200 10159ms  GET /core/v1/stock-management/stocks/VIC/order-flow/?window=30m
200 11688ms  GET /core/v1/workspace/whale-analytics/VIC/?timeframe=session&compact=1&include_baseline=0
200 11710ms  GET /core/v1/stock-management/stocks/VIC/overview/
200  9544ms  GET /core/v1/stock-management/stocks/VIC/order-flow/?window=1h
301  8697ms  GET /core/v1/session-facts/VIC/cvd?window=1h
200 11654ms  GET /core/v1/workspace/whale-analytics/VIC/?timeframe=1h&compact=0&include_baseline=0
200  9569ms  GET /core/v1/realtime/whale-feed-aggregate/VIC/?limit=50
404  9600ms  GET /core/v1/advisory/latest/VIC/
200  9598ms  GET /core/v1/workspace/watchlists/
200  9027ms  GET /core/v1/realtime/tickers/?symbols=VIC
200  8579ms  POST /core/v1/auth/ws-ticket/
404  9685ms  GET /core/v1/billing/subscription
200  3013ms  GET /core/v1/session-facts/VIC/cvd/?window=1h
```

Tài sản tĩnh (JS/CSS) chỉ **24–554 ms** → loại trừ bundle/widget là nút thắt.

### 1.2 Đối chứng độc lập bằng curl (token mới, bỏ qua FE)

```
200 5.94s  /core/v1/auth/me/
200 9.56s  /core/v1/stock-management/stocks/VIC/overview/
404 5.06s  /core/v1/billing/subscription
404 4.79s  /core/v1/advisory/latest/VIC/
```

→ Độ trễ tồn tại ngay cả khi gọi trực tiếp, không phải artifact của React/Playwright.

### 1.3 Probe trong container API (SSH VPS)

```
tcp pgbouncer:6432:    16ms
tcp core-redis:6379:    1ms
http daphne 8100 auth/me (401): 2162ms
http daphne 8101 auth/me (401): 1498ms
```

TCP tới DB/Redis nhanh; request nội bộ tới Daphne chậm ⇒ **độ trễ nằm trong Django**, không phải mạng/proxy.

---

## 2. Nguyên nhân gốc (root cause)

### 2.1 Mỗi request HTTP ghi 1 dòng audit vào bảng 819 MB

`packages/core/backend/src/ops_audit/middleware.py:35-39` — `RequestTraceMiddleware` luôn gọi `_record_access_event()` sau khi response trả về; `:74` thực thi `AuditEvent.objects.create(...)` cho **mọi** request, kể cả 401 và health-check `/metrics/` (log cho thấy `/metrics/` mỗi ~15 s).

Đo trên staging:

```
ops_audit_auditevent: 1.370.086 dòng, 819 MB
SELECT count(*)       : 1361ms
số index              : 12 (gồm 4 index `_like` song song)
INSERT AuditEvent     : 676ms / 3ms / 582ms  (3 lần đo)
```

Cộng thêm `CORE_DB_CONN_MAX_AGE=0` (`docker inspect vninvest-core-api`) → Django mở kết nối DB mới cho mỗi request. Mỗi INSERT phải cập nhật 12 index của bảng 819 MB.

### 2.2 Daphne ASGI bị chặn bởi middleware/ORM đồng bộ

`docker top vninvest-core-api` chỉ có **2 tiến trình daphne** (port 8100/8101). Middleware trên là sync, ORM là sync → block event loop. Khi FE bắn ~10 request đồng loạt, chúng xếp hàng; vì vậy mọi request stock đều có duration ~9–12 s thay vì 1 request bị chậm riêng lẻ.

### 2.3 Bootstrap FE tuần tự nhân độ trễ lên ~9 s

`packages/web/src/context/PortfolioContext.js:599-642`:

```
bootstrap():
  await withTimeout(syncAuthState(...))   // auth/me + identity/profile + tenant/lifecycle
  await withTimeout(fetchPortfolios(...)) // portfolios
```

Hai bước **tuần tự**, mỗi bước lại gồm nhiều request 3–5 s → shell chỉ render sau ~9 s. Đây là lý do `Đang xác thực tài khoản...` đứng yên 0–9 s.

### 2.4 Trang stock fan-out ~15 request, chờ request chậm nhất

- `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js:122-131` — `Promise.allSettled` của 4 request blocking; chậm nhất 11,7 s → `loadingBlocking` mới tắt.
- Cùng file `:188-191` — 2 request deferred (whale feed + advisory), ~9,6 s mỗi cái.
- `packages/web/src/components/WhaleBubbleChart.jsx:622` và `:670` gọi **lại** `getStockOrderFlow({window:'30m'})` và `getWhaleAnalyticsSnapshot({timeframe:'session'})` trong khi `useStockDetailPageModel` đã gọi `window:'1h'` / `timeframe:'1h'`. → **4 request trùng phục vụ 2 mục đích**, nhân tải backend.

---

## 3. Hai dòng 404 trong console

| Console label | URL thật | file:line | Có hại? |
|---|---|---|---|
| `VIC/:1` | `GET /core/v1/advisory/latest/VIC/` | `adapters/core/advisory.js`; xử lý tại `adapters/core/transport.js:453-459` | **Không.** 404 = "chưa có advisory" → `coreGet` trả `null`, model giữ nguyên. Chỉ là console noise. |
| `subscription:1` | `GET /core/v1/billing/subscription` | `adapters/core/commercial.js:12-14`; xử lý tại `adapters/useTenantTier.js:63-68` | **Không.** 404 → `tier='free'` (fail-closed) theo thiết kế. Chỉ là console noise. |

Cả hai được backend log là `Not Found` (`docker logs vninvest-core-api` tại `01:00:26` và `01:00:27`). **Không phải nguyên nhân chậm** — chính các request này cũng mất 4,8–9,7 s vì lý do §2.

---

## 4. CONTRADICTIONS (đối chiếu giả thuyết ban đầu ↔ thực tế)

| Giả thuyết | Thực tế đo được | Tác động |
|---|---|---|
| "Widget 2,1 MB / lazy chunk làm chậm trang" | Asset tĩnh 24–554 ms; request stock API 9–12 s | Sai; tối ưu bundle không giải quyết được |
| "404 khiến FE retry/rơi vào vòng lặp" | 404 trả về sau 4,8–9,7 s, được catch ngay, không retry | Sai; 404 chỉ là noise |
| "Cần sửa `VIC/` endpoint bị sai path" | Endpoint đúng, trả 404 có chủ đích ("no data yet") | Sai; sửa path là vô hiệu |

---

## 5. Findings

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất |
|---|---|---|---|---|---|
| F-01 | **P0** | `ops_audit/middleware.py:35-39,74` | Ghi `AuditEvent` cho mọi request vào bảng 819 MB / 12 index | ~0,6 s/request, cộng dồn khi fan-out | Giới hạn ghi audit (chỉ write/đối tượng nhạy cảm), hoặc đẩy sang Celery/queue; dọn index `_like` thừa; partition/archive bảng |
| F-02 | **P0** | `settings.py:143-155` + `docker top` (2 daphne) | Sync middleware + ORM chạy trong ASGI event loop | Xếp hàng request, mọi API ~10 s | Tăng worker daphne và/hoặc tách sync middleware vào threadpool (`sync_to_async`) |
| F-03 | **P1** | `PortfolioContext.js:612-625` | `syncAuthState` → `fetchPortfolios` tuần tự | +~9 s trước khi render shell | Chạy song song (có dependency thì gộp thành 1 endpoint bootstrap) |
| F-04 | **P1** | `useStockDetailPageModel.js:122-131,188-191`; `WhaleBubbleChart.jsx:622,670` | 4 request trùng (order-flow 30m/1h, whale session/1h) | Nhân tải backend đúng lúc đang quá tải | Dùng chung 1 response, truyền xuống `WhaleBubbleChart` qua prop |
| F-05 | **P2** | `transport.js:453-459`; `useTenantTier.js:63-68` | 404 "no data" vẫn log console error | Noise, người dùng tưởng lỗi | Trả 204/200+rỗng hoặc suppress console cho 2 path này |
| F-06 | **P2** | `VNStockChartPanel.js:115-154,511-519` | Widget 2,1 MB tải sau IntersectionObserver, nhưng `chartBody` chờ `internalBars.length > 0` | Nếu backend trễ, spinner kéo dài; cần kiểm tra riêng gate này | Giữ nguyên, nhưng đo lại sau khi F-01/F-02 xong (hiện chưa chứng minh là nút thắt) |

---

## 6. Đề xuất thứ tự xử lý

1. **P0 — Backend (F-01, F-02)**: đo lại sau mỗi thay đổi bằng cùng script Playwright + curl. Mục tiêu: `auth/me` < 500 ms, `overview` < 1 s. Đây là thay đổi mang lại ~70–80% cải thiện.
2. **P1 — FE (F-03)**: gộp bootstrap thành 1 request hoặc song song hóa. Mục tiêu: auth gate < 2 s.
3. **P1 — FE (F-04)**: bỏ 2 request trùng. Mục tiêu: giảm 15 → 13 request.
4. **P2 (F-05)**: dọn console noise (sau khi đã sửa P0/P1).

**Không làm**: đổi path `advisory/latest/VIC/` hay `billing/subscription`, tối ưu bundle widget, tăng `BOOTSTRAP_TIMEOUT_MS` để "ẩn" triệu chứng.

---

## 7. Tests / validation cần chạy

- Chạy lại `diag-stock-load2.mjs` trên staging sau mỗi fix, so sánh bảng timing §1.1.
- `curl` đối chứng §1.2 với token mới.
- BE: `ops_audit` middleware test — đảm bảo vẫn ghi audit cho write request sau khi giới hạn.
- FE: `npm run test:components` (các test của `useStockDetailPageModel`, `PortfolioContext`, `Header`).
- **CHƯA CHẠY**: full BE suite, `npm run build`, E2E visual regression (không thuộc phạm vi chẩn đoán này).

---

## 8. Next steps / Owner

- **Owner hạ tầng**: quyết định phương án F-01 (archive/partition bảng audit + bỏ index thừa) và F-02 (tăng daphne workers / tách sync middleware). Cần deploy lại `vninvest-core-api` trên VPS staging.
- **Owner FE**: gộp bootstrap (F-03) và bỏ request trùng (F-04) — làm sau khi backend đã xanh để đo được hiệu quả riêng.
- Tài liệu này là diagnosis; **chưa có thay đổi code nào** trong phiên này.
