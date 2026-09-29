# Kế hoạch Triển khai Chi tiết: Watchlist Strategy Command Center (v2.0)

**Ngày tạo:** 2026-04-20 | **Hiệu chỉnh:** 2026-04-20  
**Trạng thái:** CONFIRMED — Sẵn sàng bàn giao cho đội phát triển  
**Phạm vi:** Refactoring Architecture · Hybrid Indicator Engine · Personalized Strategy Filters  
**Người Audit:** Product Owner (sau khi đội code bàn giao)

---

## 0. Trạng thái Codebase Hiện tại (Baseline)

| Mục | Hiện trạng | Vấn đề |
|-----|-----------|--------|
| `frontend/src/pages/Watchlist.jsx` | **2042 dòng**, 1 file duy nhất | Monolithic — khó maintain, re-render không kiểm soát |
| State management | **20+ `useState`** trong 1 component | Không tách biệt UI state và data state |
| Realtime feed | `useRealtimeFeed` hook (tốt) | Thiếu throttle cho indicators |
| Indicators hiển thị | Chỉ có: Giá, Thay đổi, % | Chưa có RSI, MA20_Dist, RVOL |
| Virtualization | Không có | Lag khi danh sách >50 mã |
| Sparklines | Không có | Thiếu xu hướng trực quan |
| Price Flash | Không có | Không có phản hồi thị giác khi giá thay đổi |

---

## 1. Mục tiêu & Triết lý

- **Bảo toàn 100% tính năng cá nhân hóa hiện có**: nhóm tự chọn, cảnh báo giá, ngưỡng Whale riêng.
- **Zero Lag** với danh sách 120+ mã realtime.
- **Radar Logic**: Người dùng lọc nhanh danh mục theo tín hiệu kỹ thuật (Overbought, Oversold, Volume Breakout).
- **Không code tính năng mới vào file monolithic hiện tại** — refactor trước, thêm tính năng sau.

---

## 2. Quyết định Kỹ thuật Đã Chốt (Architecture Decision Records)

> Các quyết định dưới đây đã được xác nhận. **Đội code không được tự ý thay đổi** mà không có phê duyệt.

| # | Vấn đề | Quyết định | Lý do |
|---|--------|-----------|-------|
| ADR-01 | Tần suất cập nhật Indicators | **10 giây** (hoặc khi giá biến động > 0.5%) | Cân bằng độ nhạy và CPU load server |
| ADR-02 | Web Worker pattern | **File rời** `sparkline.worker.js` | Vite native support, dễ debug, tái sử dụng |
| ADR-03 | Virtualization library | **`@tanstack/react-virtual`** | Nhẹ (~4KB), không dependency nặng, battle-tested |
| ADR-04 | Sparklines chart engine | **ECharts** (inline mini-option) | Nhất quán với toàn dự án, không thêm thư viện mới |
| ADR-05 | Nơi tính RSI/MA/RVOL | **Backend (Celery task)** | Tính nhất quán dữ liệu, giảm tải mobile client |

---

## 3. Kiến trúc Sau Refactor (Target Architecture)

### 3.1 Sơ đồ Module Frontend

```
frontend/src/
├── pages/
│   └── Watchlist.jsx               ← (Giảm xuống ~200 dòng, chỉ layout + router state)
├── components/watchlist/           ← (Thư mục mới, tạo toàn bộ)
│   ├── WatchlistContainer.jsx      ← Quản lý state tổng, kết nối context
│   ├── SmartRadarTable.jsx         ← Bảng chính, virtualized, memo-ized rows
│   ├── WatchlistManagementPanel.jsx← Thêm/xóa mã, Seed, Sync Profile
│   └── PriceAlertModule.jsx        ← Panel cảnh báo giá độc lập
├── hooks/
│   ├── useWatchlistProcessor.js    ← (Mới) Logic filter/sort/normalize
│   └── useRealtimeFeed.js          ← (Giữ nguyên, không sửa)
└── workers/
    └── sparkline.worker.js         ← (Mới) Web Worker build SVG series
```

### 3.2 Data Flow (Luồng Dữ liệu)

```
WebSocket tick_update
    │
    ▼
useRealtimeFeed (hiện tại — giữ nguyên)
    │  price/volume: mỗi tick
    │  indicators (RSI/MA/RVOL): throttle 10s
    ▼
useWatchlistProcessor (mới)
    │  Filter → Sort → Normalize → Memoize
    ▼
WatchlistContainer (state owner)
    │
    ├──▶ SmartRadarTable (virtualized render)
    │        └── SparklineCell (ECharts mini)
    ├──▶ WatchlistManagementPanel
    └──▶ PriceAlertModule
```

---

## 4. Đặc tả Backend: Hybrid Indicator Engine

### 4.1 Mở rộng Payload `ticker_update`

Backend cần bổ sung 3 trường vào message WebSocket:

```json
{
  "symbol": "VNM",
  "current_price": 72500,
  "change_pct": 1.25,
  "rsi_14": 58.3,
  "ma20_dist_pct": 2.1,
  "rvol": 1.8,
  "indicator_ts": "2026-04-20T09:30:00Z"
}
```

### 4.2 Công thức tính (Backend — Celery Task)

| Chỉ số | Công thức | Nguồn dữ liệu |
|--------|----------|--------------|
| `rsi_14` | Wilder's RSI với 14 phiên đóng cửa | OHLCV 30 ngày gần nhất (DB cache) |
| `ma20_dist_pct` | `((current_price / MA20) - 1) * 100` | Trung bình đóng cửa 20 phiên |
| `rvol` | `current_volume / avg_volume_10d` | Volume 10 phiên trung bình |

### 4.3 Task Schedule (Celery Beat)

```python
# Thêm vào celery beat schedule
CELERY_BEAT_SCHEDULE = {
    'compute-watchlist-indicators': {
        'task': 'market.tasks.compute_watchlist_indicators',
        'schedule': 10.0,  # ADR-01: mỗi 10 giây
    },
}
```

**Trigger bổ sung**: Task cũng chạy ngay lập tức khi `change_pct > 0.5%` trên bất kỳ mã nào đang được theo dõi bởi ít nhất 1 user.

---

## 5. Đặc tả Frontend: Từng Component

### 5.1 `useWatchlistProcessor.js` (Hook mới — ưu tiên cao nhất)

**Trách nhiệm duy nhất**: nhận raw data từ realtime feed, trả về data đã lọc/sắp xếp/chuẩn hóa.

```js
// Interface:
const {
  processedSymbols,   // Array — đã filter + sort
  activeFilters,      // Object — trạng thái filter hiện tại
  setFilter,          // Fn — cập nhật filter
  setSortConfig,      // Fn — cập nhật sort
} = useWatchlistProcessor(rawTrackedSymbols, realtimeFeed);
```

**Logic filter cần implement:**

| Filter | Điều kiện | Ghi chú |
|--------|----------|---------|
| `rsi_overbought` | `rsi_14 > 70` | |
| `rsi_oversold` | `rsi_14 < 30` | |
| `vol_breakout` | `rvol >= 2.0` | |
| `near_ma20` | `abs(ma20_dist_pct) <= 1.0` | ±1% so với MA20 |
| `whale_triggered` | `current_price >= whale_threshold` | ngưỡng riêng từng user |
| `gainers` / `losers` | `change_pct > 0` / `< 0` | |
| `stale` | `stale === true` | |

### 5.2 `SmartRadarTable.jsx` (Component mới)

- Sử dụng `@tanstack/react-virtual` cho danh sách >50 mã.
- Mỗi Row dùng `React.memo` — chỉ re-render khi `symbol`, `current_price`, `change_pct`, `rsi_14`, `rvol` thay đổi.
- **Cột bắt buộc** (có thể ẩn/hiện):

| Cột | Dữ liệu | Ghi chú |
|-----|---------|---------|
| Mã CP | `symbol` | Click → `StockDetail` |
| Giá | `current_price` | Flash xanh/đỏ khi thay đổi |
| +/- | `change_value` | |
| % | `change_pct` | |
| RSI(14) | `rsi_14` | Màu: <30 xanh lá, >70 đỏ |
| MA20 Dist | `ma20_dist_pct` | % hiển thị với dấu ±  |
| RVOL | `rvol` | Bold khi >=2.0 |
| Sparkline | 24h series | ECharts mini, via Web Worker |
| Whale | icon | Hiện khi ngưỡng cá nhân bị chạm |
| Alert | icon 🔔 | Hiện khi có price alert active |

### 5.3 `sparkline.worker.js` (Web Worker — file rời)

```js
// workers/sparkline.worker.js
self.onmessage = function(e) {
  const { symbol, priceSeries } = e.data;
  // Build ECharts mini option (không render, chỉ tính toán series)
  const option = buildMiniOption(priceSeries);
  self.postMessage({ symbol, option });
};
```

**Lưu ý:** Worker chỉ tính option object, **không** khởi tạo ECharts instance trong worker. Instance ECharts vẫn tạo trên main thread sau khi nhận option.

### 5.4 Price Flash CSS (thêm vào `index.css`)

```css
@keyframes price-flash-up {
  0%   { background-color: rgba(74, 222, 128, 0.4); }
  100% { background-color: transparent; }
}
@keyframes price-flash-down {
  0%   { background-color: rgba(248, 113, 113, 0.4); }
  100% { background-color: transparent; }
}
.price-flash-up   { animation: price-flash-up   0.6s ease-out; }
.price-flash-down { animation: price-flash-down 0.6s ease-out; }
```

---

## 6. Lộ trình Triển khai (3 Giai đoạn)

### Giai đoạn C — Refactor Hệ lõi (Ưu tiên tuyệt đối)
> Hoàn thành trước khi bắt đầu Giai đoạn B. Không code tính năng mới song song.

| Task | File đích | Ước tính |
|------|----------|---------|
| C1. Tạo thư mục `components/watchlist/` | (mới) | 0.5h |
| C2. Trích xuất toàn bộ helper functions (formatPrice, ChangeCell, PctCell, mergeTickerIntoItem, v.v.) sang `utils/watchlistHelpers.js` | (mới) | 1h |
| C3. Tạo `useWatchlistProcessor.js` — chuyển toàn bộ logic filter/sort từ Watchlist.jsx vào đây | (mới) | 3h |
| C4. Tạo `WatchlistContainer.jsx` — chuyển 20+ useState và các useEffect chính | (mới) | 2h |
| C5. Tạo `WatchlistManagementPanel.jsx` — toàn bộ UI thêm/xóa mã, seed, sync | (mới) | 2h |
| C6. Tạo `PriceAlertModule.jsx` — toàn bộ UI price alert | (mới) | 2h |
| C7. Rút gọn `pages/Watchlist.jsx` về ~200 dòng (chỉ layout + import các module trên) | `Watchlist.jsx` | 1h |

**Gate C:** Toàn bộ chức năng hiện tại phải hoạt động **y hệt** sau khi refactor. Chạy lại smoke test bằng tay trước khi chuyển sang Giai đoạn B.

### Giai đoạn B — Tích hợp Chỉ báo Kỹ thuật
> Chỉ bắt đầu sau khi Gate C được Audit xác nhận.

| Task | File đích | Ước tính |
|------|----------|---------|
| B1. Backend: Tạo Celery task `compute_watchlist_indicators` | `market/tasks.py` | 3h |
| B2. Backend: Mở rộng WebSocket message thêm 3 trường indicators | `consumers.py` | 1h |
| B3. Frontend: Cập nhật `mergeTickerIntoItem` nhận thêm `rsi_14`, `ma20_dist_pct`, `rvol` | `watchlistHelpers.js` | 0.5h |
| B4. Frontend: Thêm 3 cột mới vào `SmartRadarTable` | `SmartRadarTable.jsx` | 2h |
| B5. Frontend: Tích hợp Strategy Filters vào `useWatchlistProcessor` | `useWatchlistProcessor.js` | 2h |
| B6. Frontend: UI Filter Bar (chip-style) trên đầu bảng | `SmartRadarTable.jsx` | 1.5h |

### Giai đoạn A — Nâng cao Trải nghiệm
> Chỉ bắt đầu sau khi Gate B được Audit xác nhận.

| Task | File đích | Ước tính |
|------|----------|---------|
| A1. Thêm Price Flash CSS keyframes | `index.css` | 0.5h |
| A2. Tạo `sparkline.worker.js` và tích hợp vào `SmartRadarTable` | `workers/sparkline.worker.js` | 3h |
| A3. Tạo cột Sparkline với ECharts mini trong bảng | `SmartRadarTable.jsx` | 2h |
| A4. Virtualization với `@tanstack/react-virtual` cho danh sách >50 mã | `SmartRadarTable.jsx` | 2h |
| A5. Compact Mode toggle (mật độ cao/thường) | `SmartRadarTable.jsx` | 1h |
| A6. Whale/Shark icon trực tiếp trên dòng khi ngưỡng bị chạm | `SmartRadarTable.jsx` | 1h |

---

## 7. Danh mục Kiểm tra Audit (Audit Checklist)

Sau mỗi Gate, đội code bàn giao kèm bằng chứng (screenshot/video):

### Gate C — Audit Refactor
- [ ] **Regression**: Thêm mã mới vào Watchlist hoạt động bình thường
- [ ] **Regression**: Xóa mã hoạt động bình thường
- [ ] **Regression**: Price Alert tạo/sửa/xóa hoạt động bình thường
- [ ] **Regression**: Realtime price update hiển thị đúng
- [ ] **Memory Leak**: Không có subscription socket bị leak khi chuyển giữa Groups (kiểm tra Chrome DevTools → Memory tab)
- [ ] **Bundle size**: Không tăng quá 5KB so với baseline

### Gate B — Audit Indicators
- [ ] **Data Integrity**: RSI(14) trong bảng khớp với biểu đồ kỹ thuật chính (sai số ≤ 0.5)
- [ ] **Data Integrity**: MA20_Dist phản ánh đúng % khoảng cách thực tế
- [ ] **Throttle**: Cột indicators không nhấp nháy liên tục mỗi tick giá (phải ổn định 10s)
- [ ] **Filter**: Tất cả 7 filter hoạt động đúng logic (kiểm tra từng loại)
- [ ] **Performance**: FPS ≥ 50 khi filter thay đổi trên 50+ mã (đo bằng React Profiler)

### Gate A — Audit UX
- [ ] **Sparklines**: Hiển thị đúng xu hướng 24h, không block UI thread
- [ ] **Price Flash**: Hiệu ứng mượt mà, không "giật mắt" — thời gian flash 0.6s
- [ ] **Virtualization**: Scroll mượt không lag khi có 100+ mã trong danh sách
- [ ] **Compact Mode**: Toggle hoạt động, không mất dữ liệu khi chuyển chế độ
- [ ] **Responsive**: Hiển thị đúng trên màn hình 1366×768 (laptop 13-14 inch)

---

## 8. Rủi ro & Biện pháp Phòng ngừa

| Rủi ro | Xác suất | Tác động | Biện pháp |
|--------|---------|---------|----------|
| Refactor làm hỏng existing logic (2042 dòng phức tạp) | Cao | Cao | **Bắt buộc** chạy manual smoke test sau Gate C trước khi merge |
| Celery task tính indicators cho 120+ mã mỗi 10s gây quá tải DB | Trung bình | Trung bình | Benchmark với `time.perf_counter()` trước khi deploy production |
| Web Worker không chạy được trong môi trường CI/test | Thấp | Thấp | Cần fallback: nếu Worker không init được, skip sparkline (không crash) |
| ECharts mini instances gây memory leak khi scroll virtual list | Trung bình | Trung bình | Destroy ECharts instance trong `useEffect` cleanup |

---

## 9. Dependencies Cần Cài đặt

```bash
# Frontend — chỉ cài thêm 1 package
npm install @tanstack/react-virtual

# Backend — không cần package mới (dùng Pandas + Celery sẵn có)
```

---

> [!IMPORTANT]
> **Quy tắc bất di bất dịch cho đội code:**
> 1. Không được thêm bất kỳ tính năng mới nào vào `Watchlist.jsx` gốc trong quá trình refactor.
> 2. Mỗi Giai đoạn phải qua Gate Audit trước khi chuyển giai đoạn tiếp theo.
> 3. Mọi thay đổi Backend phải kèm migration nếu có model change.
> 4. Toàn bộ text giao diện người dùng phải dùng `t('...')` — không hardcode tiếng Anh hay tiếng Việt.
