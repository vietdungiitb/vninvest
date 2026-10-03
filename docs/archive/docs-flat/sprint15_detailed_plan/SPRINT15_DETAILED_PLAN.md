# Sprint 15 Detailed Plan — Order Flow & Dark Money Detection

**Ngày lập**: 2026-04-04  
**Sprint**: 15  
**Mục tiêu**: Xây dựng Order Flow Engine để phát hiện dòng tiền ẩn (iceberg orders, TWAP bots, smart money absorption) — đây là lớp phân tích thứ hai bên trên Whale Alert hiện có, nhắm vào pattern nhiều lệnh nhỏ thay vì một lệnh lớn  
**Ưu tiên thiết kế**: Tận dụng tối đa `IntradayTick`, `whale_scoring.py`, WebSocket pipeline và AI advisory đã có

---

## 0) Quy ước thực thi

- Mỗi Phase có: Scope rõ → Task theo file → Acceptance criteria → Test checklist
- Không chuyển Phase khi Phase trước chưa pass tests
- Mọi event type mới phải cập nhật `WEBSOCKET_EVENT_CONTRACT.md` ngay trong cùng batch
- Áp dụng nguyên tắc **backward-compatible**: Whale Alert cũ không bị thay đổi contract

---

## 1) Bối cảnh kỹ thuật — Tại sao cần Sprint 15

### Limiation hiện tại
`detect_whale_signals()` trong `realtime/compute.py` chỉ bắt **một lệnh đơn lớn** (max matched_value ≥ threshold). Nhưng cá mập chuyên nghiệp dùng:
- **Iceberg Order**: chia 1 lệnh 10 tỷ thành 100 lệnh × 100 triệu, khớp liên tục cùng mức giá
- **TWAP Bot**: gom hàng trải đều theo thời gian, lệnh nhỏ đều mỗi 30-60s
- **Absorption**: giá "bị khoá" tại mức hỗ trợ trong khi tick rate tăng mạnh → cá mập đang hứng lệnh bán

### Foundation sẵn có
| Thành phần | Vị trí | Dùng để |
|---|---|---|
| `IntradayTick` model | `models.py` | Nguồn dữ liệu tick (price/volume/side/time) |
| `compute_vwap()` | `realtime/compute.py` | VWAP đã tính sẵn |
| `whale_scoring.py` | `whale_scoring.py` | Framework scoring (weights + decay) có thể mở rộng |
| Redis Streams pipeline | `tasks.py` + `stream_consumers.py` | Cơ sở chạy task định kỳ |
| WebSocket consumer | `consumers.py` | Fan-out event mới |
| `useRealtimeFeed.js` | `hooks/useRealtimeFeed.js` | Frontend nhận event mới không cần viết lại |
| `ai_context.py` | `ai_context.py` | Thêm context mới cho AI advisory |

---

## 2) Kiến trúc tổng thể Sprint 15

```
IntradayTick DB
      │
      ▼
order_flow.py ─── compute_cvd_series()
(backend layer)   compute_tick_rate()
                  compute_size_distribution()
                  detect_absorption()
                  detect_iceberg_clustering()
                  detect_dark_flow()
                        │
                        ▼
              OrderFlowSignal model (DB)
                        │
                   ┌────┴────┐
                   ▼         ▼
            Celery task   REST API
          (định kỳ 30s)  /order-flow/
                   │
                   ▼
          dark_flow_alert WS event
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
  consumers.py         useRealtimeFeed.js
        │                     │
        ▼                     ▼
AI advisory context    Frontend panels
(order flow context)   CVD Chart + Tick Rate
```

---

## Phase 1 (P0) — Order Flow Compute Engine

### Mục tiêu
Tạo module backend thuần `backend/portfolio/order_flow.py` tính toán order flow metrics từ `IntradayTick`.

### Files tác động
- `backend/portfolio/order_flow.py` (**tạo mới**)
- `backend/portfolio/tests/test_order_flow.py` (**tạo mới**)

### Task S15-01 — CVD Series

**File**: `order_flow.py`

```python
def compute_cvd_series(
    symbol: str,
    window_minutes: int = 60,
    bucket_seconds: int = 60,
) -> list[dict]:
    """
    Trả về list[{bucket_ts, buy_value, sell_value, cvd, cumulative_cvd}]
    CVD = buy_value - sell_value trong mỗi bucket.
    cumulative_cvd = tổng tích luỹ từ đầu cửa sổ.
    """
```

- Source: `IntradayTick.objects.filter(symbol, trade_date=today, trade_time >= now - window_minutes)`
- Group by bucket `floor(trade_time / bucket_seconds)`
- `buy_value = price * volume` khi `side == 'BUY'`
- Side UNKNOWN chia đôi: 50% buy / 50% sell
- Return rỗng nếu không có tick

**Acceptance**: CVD series 60 buckets, cộng dồn đúng, test với fixture ticks

---

### Task S15-02 — Tick Rate

**File**: `order_flow.py`

```python
def compute_tick_rate(
    symbol: str,
    window_seconds: int = 60,
) -> dict:
    """
    Trả {tick_rate_per_min, small_order_count, small_order_ratio, window_seconds}
    small_order = tick có value < SMALL_ORDER_THRESHOLD (default 50 triệu VNĐ)
    """
```

- Count ticks trong `window_seconds` gần nhất
- `tick_rate_per_min = count * (60 / window_seconds)`
- `small_order_ratio = small_count / total_count` (dấu hiệu iceberg)
- Dùng cache Redis 10s để không đọc DB liên tục

---

### Task S15-03 — Size Distribution

**File**: `order_flow.py`

```python
def compute_size_distribution(
    symbol: str,
    ticks: list[dict],
) -> dict:
    """
    {avg_value, median_value, p95_value, small_ratio, large_ratio, bucket_histogram}
    """
```

- `small_ratio` = tỷ lệ lệnh < 50tr VNĐ
- `large_ratio` = tỷ lệ lệnh ≥ 500tr VNĐ
- Histogram 5 buckets: <50tr / 50-200tr / 200-500tr / 500tr-2tỷ / >2tỷ

---

### Task S15-04 — Absorption Detection

**File**: `order_flow.py`

```python
def detect_absorption(
    symbol: str,
    cvd_series: list[dict],
    price_series: list[float],  # giá close mỗi bucket
    min_buckets: int = 3,
) -> dict:
    """
    {detected: bool, strength: float 0-100, price_locked: bool,
     price_range_pct: float, cvd_change: float, description: str}
    Phát hiện khi: |cvd_change| > threshold VÀ |price_change_pct| < 0.3%
    """
```

- `price_locked = True` khi giá thay đổi < 0.3% trong ≥ 3 buckets liên tiếp
- `cvd_change` tính bằng % so với giá trị tuyệt đối trung bình
- `strength = min(abs(cvd_change) / 20 * 100, 100)` (normalized 0-100)

---

### Task S15-05 — Iceberg Clustering Detection

**File**: `order_flow.py`

```python
def detect_iceberg_clustering(
    ticks: list[dict],
    price_tolerance_pct: float = 0.05,
    min_repeat: int = 5,
    window_seconds: int = 300,
) -> dict:
    """
    {detected: bool, level: float, repeat_count: int,
     value_per_occurrence_avg: float, confidence: str}
    Phát hiện nhiều lệnh nhỏ lặp lại tại cùng mức giá (sai số < 0.05%)
    """
```

- Group ticks theo `price_bucket = round(price / price_tolerance_pct)`
- Tìm bucket có count ≥ `min_repeat` trong `window_seconds` gần nhất
- Kết quả là level giá bị "khoan" liên tục

---

### Task S15-06 — Dark Flow Detector (aggregated)

**File**: `order_flow.py`

```python
def detect_dark_flow(
    symbol: str,
    avg_tick_rate_baseline: float | None = None,
) -> dict:
    """
    Gọi tất cả compute functions ở trên, aggregate thành signal tổng hợp.
    {
      signal_type: str,       # 'none' | 'absorption' | 'iceberg' | 'twap_bot' | 'mixed'
      strength: float,        # 0-100
      confidence: str,        # 'low' | 'medium' | 'high'
      components: {...},      # raw data từ mỗi detector
      triggered_at: str ISO,
    }
    """
```

Logic phân loại:
- `absorption`: `absorption.detected AND price_locked`
- `iceberg`: `iceberg.detected AND small_order_ratio > 0.70`
- `twap_bot`: `tick_rate > 3×baseline AND small_order_ratio > 0.60 AND cvd tăng đều`
- `mixed`: ≥ 2 signals cùng lúc

**Acceptance criteria Phase 1**:
- `test_order_flow.py` ≥ 15 unit tests pass (có fixture ticks)
- `detect_dark_flow('VNM')` có thể chạy từ shell không crash
- Mọi function xử lý được empty ticks (trả về giá trị an toàn)

---

## Phase 2 (P0) — OrderFlowSignal Model + Celery Task

### Mục tiêu
Lưu signal phát hiện vào DB, chạy detector định kỳ qua Celery.

### Files tác động
- `backend/portfolio/models.py` (thêm model)
- `backend/portfolio/migrations/xxxx_add_order_flow_signal.py` (**tạo mới**)
- `backend/portfolio/tasks.py` (thêm task)
- `backend/portfolio/admin.py` (register model)
- `backend/portfolio/tests/test_order_flow.py` (mở rộng)

### Task S15-07 — OrderFlowSignal Model

```python
class OrderFlowSignal(models.Model):
    class SignalType(models.TextChoices):
        NONE       = 'none',        'Không có tín hiệu'
        ABSORPTION = 'absorption',  'Hấp thụ (Absorption)'
        ICEBERG    = 'iceberg',     'Lệnh tảng băng (Iceberg)'
        TWAP_BOT   = 'twap_bot',    'TWAP Bot'
        MIXED      = 'mixed',       'Kết hợp nhiều dấu hiệu'

    symbol           = models.CharField(max_length=10, db_index=True)
    signal_type      = models.CharField(max_length=20, choices=SignalType.choices)
    strength         = models.FloatField(default=0)
    confidence       = models.CharField(max_length=10, default='low')
    tick_rate        = models.FloatField(default=0)
    small_order_ratio = models.FloatField(default=0)
    cvd_at_signal    = models.FloatField(default=0)
    price_at_signal  = models.FloatField(default=0)
    window_seconds   = models.PositiveIntegerField(default=300)
    components_json  = models.JSONField(default=dict)
    created_at       = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['symbol', 'created_at'])]
```

---

### Task S15-08 — Celery Task `detect_and_store_order_flow`

**File**: `tasks.py`

```python
@app.task(name='portfolio.tasks.detect_and_store_order_flow')
def detect_and_store_order_flow(symbol: str | None = None) -> dict:
    """
    Chạy detect_dark_flow() cho mỗi symbol đang được theo dõi.
    Lưu OrderFlowSignal nếu signal_type != 'none' OR strength > 20.
    Publish dark_flow_alert WS event nếu signal đủ mạnh (strength > 50).
    Cooldown: 5 phút / symbol (cache key: order_flow_lock:{symbol})
    """
```

- Beat schedule: mỗi 30 giây
- Symbol scope: `TrackedSymbol` + `WatchlistItem` active users (giống prefetch)
- Giới hạn tối đa 30 symbols/run để tránh áp lực DB

---

### Task S15-09 — Beat Config

Trong `config/settings.py` thêm:
```python
'detect-order-flow': {
    'task': 'portfolio.tasks.detect_and_store_order_flow',
    'schedule': timedelta(seconds=30),
},
```
Và env flag `ORDER_FLOW_DETECTION_ENABLED=true` để bật/tắt dễ dàng.

---

## Phase 3 (P1) — WebSocket Event + AI Integration

### Mục tiêu
Phát tín hiệu `dark_flow_alert` qua WebSocket và bổ sung context vào AI advisory.

### Files tác động
- `backend/portfolio/consumers.py`
- `backend/portfolio/realtime/compute.py`
- `backend/portfolio/ai_context.py`
- `backend/portfolio/tests/test_realtime_gateway.py` (mở rộng)
- `docs/WEBSOCKET_EVENT_CONTRACT.md` (bắt buộc cập nhật)

### Task S15-10 — dark_flow_alert WebSocket Event

**Contract mới** trong `consumers.py`:

```json
{
  "event_type": "dark_flow_alert",
  "contract_version": "1.0",
  "symbol": "VNM",
  "signal_type": "iceberg",
  "strength": 72.5,
  "confidence": "high",
  "tick_rate": 18.3,
  "small_order_ratio": 0.82,
  "cvd_at_signal": -1200000000,
  "description": "Phát hiện 23 lệnh nhỏ lặp lại tại mức giá 78,200 VNĐ trong 5 phút",
  "event_id": "dark_flow:VNM:2026-04-04T13:00:00Z:iceberg",
  "ts": "2026-04-04T13:00:00Z"
}
```

`consumers.py` thêm handler:
```python
async def dark_flow_alert(self, event):
    await self.send_json({**event.get('data', {}), 'event_type': 'dark_flow_alert'})
```

---

### Task S15-11 — Frontend hook mở rộng (useRealtimeFeed.js)

Thêm vào parse logic hiện có:
```javascript
} else if (evt.event_type === 'dark_flow_alert') {
  setDarkFlowAlerts(prev => dedup([evt, ...prev], 'event_id').slice(0, 20));
}
```

Export thêm: `darkFlowAlerts`, `latestDarkFlowAlert`

**Không break** `whale_alert` cũ.

---

### Task S15-12 — AI Context mở rộng

**File**: `ai_context.py`, thêm vào `build_symbol_ai_context()`:

```python
# Lấy order flow signals gần nhất (30 phút)
recent_order_flow = list(
    OrderFlowSignal.objects
    .filter(symbol=normalized_symbol, signal_type__in=['absorption','iceberg','twap_bot','mixed'])
    .filter(created_at__gte=timezone.now() - timedelta(minutes=30))
    .order_by('-created_at')
    .values('signal_type', 'strength', 'confidence', 'tick_rate', 'small_order_ratio', 'created_at')[:5]
)
```

Thêm vào `render_context_for_prompt()`:
```
Order flow signals (30 phút gần): absorption×2 iceberg×1 | avg_strength 68.3 | tick_rate 18.3/min | small_ratio 0.82
```

---

## Phase 4 (P1) — Frontend Order Flow Panel

### Mục tiêu
Thêm 3 components vào `/stocks/:symbol` bên dưới KlineChart.

### Files tác động
- `frontend/src/components/OrderFlowPanel.jsx` (**tạo mới**)
- `frontend/src/components/CVDChart.jsx` (**tạo mới**)
- `frontend/src/components/TickRateMeter.jsx` (**tạo mới**)
- `frontend/src/api/client.js` (thêm API calls)
- `frontend/src/pages/StockDetail.jsx` (gắn panel)
- `backend/portfolio/views.py` (REST endpoint)
- `backend/portfolio/urls_realtime.py` (route mới)

### Task S15-13 — REST API Order Flow

**Endpoint**: `GET /api/realtime/order-flow/<symbol>/`

```json
{
  "symbol": "VNM",
  "cvd_series": [...60 buckets...],
  "tick_rate": {"tick_rate_per_min": 18.3, "small_order_ratio": 0.82, "window_seconds": 60},
  "size_distribution": {...},
  "dark_flow": {"signal_type": "iceberg", "strength": 72.5, "confidence": "high"},
  "recent_signals": [...last 5 OrderFlowSignal...]
}
```

Cache 15s trong Redis.

---

### Task S15-14 — CVD Chart Component

**File**: `CVDChart.jsx`

- Dùng thư viện `recharts` (đã có trong dự án) hoặc minimal `<canvas>` bar chart
- Trục X: thời gian (bucket), trục Y: CVD value
- Màu: xanh khi cumulative_cvd > 0 (áp lực mua), đỏ khi < 0 (áp lực bán)
- Đường giữa (zero line) dày hơn
- Tự cập nhật từ WS event `dark_flow_alert` hoặc polling 30s khi WS không có CVD

---

### Task S15-15 — Tick Rate Meter

**File**: `TickRateMeter.jsx`

- Hiển thị `tick_rate_per_min` dạng số lớn
- Badge màu (xanh bình thường / vàng cảnh báo / đỏ bất thường) so với baseline
- `small_order_ratio` dạng progress bar (0–100%)
- Cập nhật polling 15s

---

### Task S15-16 — Absorption Signal Badge

Inline trong `OrderFlowPanel.jsx`:
- Xuất hiện khi `signal_type != 'none' AND strength > 40`
- Các badge state:
  - 🐋 `Absorption` xanh: cá mập đang hứng lệnh bán
  - 🧊 `Iceberg` tím: lệnh tảng băng đang hoạt động
  - 🤖 `TWAP Bot` vàng: thuật toán gom hàng phát hiện
  - 🔥 `Mixed Signal` đỏ: nhiều pattern cùng lúc
- Hiển thị `strength` dạng `(72.5/100)` và confidence label
- Tắt hoàn toàn nếu `signal_type == 'none'`

---

### Task S15-17 — Gắn vào StockDetail.jsx

Thêm section sau advisory session panel hiện có:
```jsx
{/* Order Flow Analysis */}
<OrderFlowPanel symbol={normalizedSymbol} />
```

---

## 3) Timeline & Điểm chốt

| Phase | Tasks | Thời lượng ước tính | Dependency |
|---|---|---|---|
| Phase 1 | S15-01 → S15-06 | 4-5 giờ | — |
| Phase 2 | S15-07 → S15-09 | 2-3 giờ | Phase 1 |
| Phase 3 | S15-10 → S15-12 | 2-3 giờ | Phase 2 |
| Phase 4 | S15-13 → S15-17 | 4-5 giờ | Phase 3 |
| **Tổng** | **17 tasks** | **~12-16 giờ** | — |

---

## 4) Definition of Done (Sprint 15)

### Backend
- [ ] `order_flow.py` tồn tại, có đủ 6 functions chính
- [ ] ≥ 15 unit tests pass trong `test_order_flow.py`
- [ ] `OrderFlowSignal` migration apply thành công
- [ ] Task `detect_and_store_order_flow` có thể chạy từ CLI không crash
- [ ] `GET /api/realtime/order-flow/<symbol>/` trả 200 với đúng contract
- [ ] `dark_flow_alert` được publish qua WebSocket khi có signal strength > 50

### Frontend
- [ ] `CVDChart` hiển thị được với mock data
- [ ] `TickRateMeter` hiển thị tick rate và small_order_ratio
- [ ] Signal badges hiển thị đúng loại tín hiệu
- [ ] `OrderFlowPanel` hiển thị trên `/stocks/VNM` không crash

### AI
- [ ] `ai_context.py` trả thêm key `order_flow_signals` trong context
- [ ] Prompt AI advisory nhận diện khi có iceberg/absorption pattern

### QA
- [ ] `npm run build` compiled successfully
- [ ] `manage.py test portfolio.tests.test_order_flow` ≥ 15/15 PASS
- [ ] `WEBSOCKET_EVENT_CONTRACT.md` đã cập nhật event `dark_flow_alert`
- [ ] Không có regression trên whale_alert cũ

---

## 5) Rủi ro & Giảm thiểu

| Rủi ro | Khả năng | Giảm thiểu |
|---|---|---|
| IntradayTick rỗng trong local dev | Cao | `detect_dark_flow` trả `none` an toàn; seed script bổ sung tick giả |
| Task chạy 30s gây áp lực DB | Trung bình | Giới hạn 30 symbols/run + cache 10s cho tick read |
| False positive Iceberg | Trung bình | Tuning `min_repeat ≥ 5` và `price_tolerance < 0.05%` trước khi alert |
| Recharts chưa có trong project | Thấp | CVDChart có thể dùng CSS/div bars đơn giản nếu không có charting lib |

---

## 6) Phụ lục — Ví dụ test fixture

```python
# test_order_flow.py
FIXTURE_TICKS_ICEBERG = [
    {'price': 78200, 'volume': 1000, 'side': 'BUY', 'trade_time': time(10, 0, i)}
    for i in range(0, 60, 3)  # 20 lệnh mua nhỏ mỗi 3 giây tại cùng mức giá
]
FIXTURE_TICKS_ABSORPTION = [
    # giá không đổi, CVD tăng mạnh
    {'price': 54000 + (i % 2), 'volume': 5000 + i * 100, 'side': 'BUY' if i % 3 != 0 else 'SELL', ...}
    for i in range(60)
]
```
