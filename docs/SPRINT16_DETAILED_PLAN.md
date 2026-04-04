# Sprint 16 — Whale Volume Weighting & Order Flow Time Window

**Ngày thực hiện**: 2026-04-04  
**Trạng thái**: ✅ COMPLETED  
**Chuỗi Sprint**: Sprint 14 → Sprint 15 → **Sprint 16**

---

## 1. Mục Tiêu Sprint

Sprint 16 bổ sung hai nhóm tính năng độc lập, cùng tận dụng nền tảng aggregate whale feed và order flow engine từ Sprint 14–15:

| # | Tên | Loại | Ưu tiên |
|---|-----|------|---------|
| Phase 1 | Aggregate feed trả thêm field `volume` | BE | P1 |
| Phase 2 | Whale Avg Price trên FE (WhaleAlertsHub + WhaleAdvisory) | FE | P1 |
| Phase 3 | Order flow `?window` query param + time range selector FE | BE + FE | P1 |

---

## 2. Phase 1 — BE: `volume` Field trong Aggregate Feed

### Vấn đề trước
Endpoint `GET /api/realtime/aggregate-whale-feed/` không trả field `volume` (khối lượng cp),
chỉ trả `matched_value` (giá trị VNĐ). Frontend không thể tính `Whale Avg Price = value / volume`.

### Thay đổi kỹ thuật

**File**: `backend/portfolio/views.py`

Bốn hàm builder được mở rộng để include `volume`:

#### `_build_aggregate_event_payload(row, ...)`
```python
'volume': int(getattr(row, 'volume', 0) or 0),
```

#### `_build_aggregate_event_payload_from_record(record, ...)`
```python
'volume': int(record.get('volume') or 0),
```

#### `_build_stream_aggregate_records(symbols, ...)`
```python
volume = float(tick.get('volume') or 0)
# ...trong record dict:
'volume': int(volume),
```

#### `_build_vnstock_aggregate_records(symbols, ...)`
```python
volume = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
# ...trong record dict:
'volume': int(volume),
```

### Graceful fallback
- `getattr(..., 0) or 0` / `.get(...) or 0` — đảm bảo `None` không làm crash.
- Nếu vnstock không trả volume field → `volume = 0`, `Whale Avg Price` không hiển thị trên FE.

---

## 3. Phase 2 — FE: Whale Avg Price

### Vấn đề trước
- `getFrequencyLabel` dùng `count` (số lệnh) để phân loại "Bùng nổ / Cao / Trung bình / Thấp" → không phản ánh giá trị dòng tiền thực.
- Không có thông tin giá trung bình mỗi lệnh whale.

### Thay đổi trong `frontend/src/pages/WhaleAlertsHub.jsx`

**`buildSymbolStatsFromFeed`**: Thêm tích lũy `totalVolume`:
```js
totalVolume: 0,
// ...
map[sym].totalVolume += Number(item.volume || 0);
```

**`getFrequencyLabel(totalValue)`**: Chuyển từ count-based → value-based:
```js
if (totalValue >= 5_000_000_000)  return { label: 'Bùng nổ', color: 'rose' };
if (totalValue >= 2_000_000_000)  return { label: 'Cao',      color: 'amber' };
if (totalValue >= 500_000_000)    return { label: 'Trung bình', color: 'cyan' };
return { label: 'Thấp', color: 'slate' };
```

**`TrackedSymbolCard`**: Hiển thị Whale Avg Price + total value:
```js
const whaleAvgPrice = st.totalVolume > 0 ? st.totalValue / st.totalVolume : 0;
// Display:
// "Avg lệnh: X VND"
// "Avg giá: X VND/CP"  (ẩn nếu whaleAvgPrice === 0)
// "Tổng N lệnh · X VND"
```

### Thay đổi trong `frontend/src/pages/WhaleAdvisory.jsx`

**`buildSymbolStats`**: Thêm `totalVolume` + sort by `totalValue` desc:
```js
totalVolume: 0,
map[sym].totalVolume += Number(item.volume || 0);
// Sort: b.totalValue - a.totalValue (giá trị tổng, không còn count)
```

**`SymbolCell`**: Hiển thị Whale Avg Price:
```jsx
const whaleAvgPrice = stats.totalVolume > 0 ? stats.totalValue / stats.totalVolume : 0;
// "Avg lệnh: X VND"
// "Avg giá: X VND/CP"  (conditional)
// "Tổng N lệnh · X VND"
```

---

## 4. Phase 3 — Order Flow `?window` Param

### Vấn đề trước
`GET /api/stock-management/stocks/<symbol>/order-flow/` luôn tính CVD trên cửa sổ 30 phút cứng.
Trader muốn xem CVD 5 phút cuối phiên (scalping) hoặc 1 giờ (swing trading).

### Thay đổi Backend — `backend/portfolio/views.py`

Trong `stock_order_flow_api`:
```python
_window_map = {'5m': 5, '15m': 15, '30m': 30, '1h': 60}
window_param = str(request.query_params.get('window', '30m')).strip().lower()
window_minutes = _window_map.get(window_param, 30)   # fallback 30m nếu param không hợp lệ
cvd_series = compute_cvd_series(normalized_symbol, window_minutes=window_minutes, bucket_seconds=60)
# Response thêm:
'window': window_param,
'window_minutes': window_minutes,
```

### Thay đổi Frontend Client — `frontend/src/api/client.js`

```js
export const getStockOrderFlow = (symbol, window = '30m') =>
  apiClient.get(
    `/stock-management/stocks/${encodeURIComponent(symbol)}/order-flow/`,
    { params: { window } }
  );
```

### Thay đổi Frontend UI — `frontend/src/pages/StockDetail.jsx`

**State mới**:
```jsx
const [orderFlowWindow, setOrderFlowWindow] = useState('30m');
```

**fetchOrderFlow** nhận `orderFlowWindow` vào dependency array và truyền vào `getStockOrderFlow(symbol, orderFlowWindow)`.

**Window selector UI** (trong header `OrderFlowPanel`):
```jsx
<div className="flex rounded-lg border border-slate-700 overflow-hidden text-[10px]">
  {['5m', '15m', '30m', '1h'].map((w) => (
    <button key={w} onClick={() => onWindowChange?.(w)}
      className={selectedWindow === w
        ? 'px-2 py-0.5 bg-cyan-600 text-white'
        : 'px-2 py-0.5 bg-slate-900 text-slate-400 hover:bg-slate-800'}>
      {w}
    </button>
  ))}
</div>
```

**`OrderFlowPanel` nhận props**: `window={orderFlowWindow}`, `onWindowChange={setOrderFlowWindow}`.

---

## 5. Verification

| Kiểm thử | Kết quả |
|----------|---------|
| `manage.py test portfolio.tests.test_api_routes portfolio.tests.test_order_flow` | **83/83 PASS** (49.2s) |
| `npm run build` | **Compiled successfully** (293 kB gz) |
| `manage.py check` | 0 issues |

---

## 6. Files Thay Đổi

| File | Loại | Nội dung thay đổi |
|------|------|-------------------|
| `backend/portfolio/views.py` | BE | `volume` field trong 4 builders + `?window` param trong order flow API |
| `frontend/src/pages/WhaleAlertsHub.jsx` | FE | `totalVolume` accumulation, value-based frequency label, whale avg price display |
| `frontend/src/pages/WhaleAdvisory.jsx` | FE | `totalVolume` accumulation, sort by totalValue, whale avg price in SymbolCell |
| `frontend/src/api/client.js` | FE | `getStockOrderFlow(symbol, window = '30m')` với params |
| `frontend/src/pages/StockDetail.jsx` | FE | `orderFlowWindow` state, fetchOrderFlow dep, window selector UI, OrderFlowPanel props |

---

## 7. Tài Liệu Liên Quan

- `docs/SPRINT16_ACCEPTANCE_CHECKLIST.md` — acceptance criteria, tất cả `[x]`
- `docs/TASKBOARD_SPRINT16.csv` — task tracking
- `docs/SPRINT_EXECUTION_LOG.md` — mục Sprint 16 được ghi nhận
- `docs/FEATURE_EXPANSION_BACKLOG.md` — P1-4 Whale Volume Weighting chuyển sang Delivered
