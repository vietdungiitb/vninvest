# Phân tích Cơ chế Ngưỡng Cảnh báo Cá mập (Whale Alert Threshold)
**Ngày:** 23/04/2026  
**Trạng thái:** Thảo luận — chưa code  
**Phạm vi:** Backend detect pipeline, Advisory fan-out, Frontend tooltip nến, Đề xuất LargeOrderCollection service

---

## I. Cơ chế Hoạt động Tổng quát

```
vnstock API ──► IntradayTick DB ──► Celery Task ──► detect_whale_signals() ──► Redis Pub/Sub
                                                                                       │
                                                                              ┌────────┴────────┐
                                                                         whale:{symbol}    user:{id}:alerts
                                                                              │
                                                                    _accumulate_user_advisory_event()
                                                                              │
                                                                    flush_merged_advisory_event (sau 180s)
                                                                              │
                                                                    generate_whale_advisory_task (AI)
```

### Luồng phát hiện tín hiệu realtime

Task `collect_and_publish_realtime` (Celery periodic) chạy tuần tự:

1. **Thu thập giao dịch**: Lấy intraday frame từ Redis Stream → DB fallback → vnstock
2. **Detect**: `detect_whale_signals(symbol, trades_df, thresholds)` trong `backend/portfolio/realtime/compute.py` tính `matched_value = price × volume`, so sánh với ngưỡng, emit một `WhaleSignal` duy nhất tại **threshold cao nhất đạt được**
3. **Dedup**: Cache key `whale:dedup:{event_id}` TTL 300s, bỏ qua signal trùng
4. **Publish**: `whale:{symbol}` channel (public), `user:{user_id}:alerts` channel (private)
5. **Advisory fan-out**: Gọi `_accumulate_user_advisory_event()` → merge window 180s → `flush_merged_advisory_event` → `generate_whale_advisory_task` (AI advisory)

---

## II. Tầng Ngưỡng (Threshold Hierarchy)

Hệ thống có **3 tầng ngưỡng** hoạt động song song:

| Tầng | Model field | Đơn vị lưu | Fallback | Dùng ở đâu |
|---|---|---|---|---|
| **System default** | `settings.REALTIME_DEFAULT_WHALE_THRESHOLD` | VND (=500_000_000) | — | Khi `user_id=None` (global task) |
| **User-level** | `UserConfig.whale_alert_threshold` | Triệu VND (default=500) | System default | Mọi mã của user đó |
| **Symbol-level override** | `TrackedSymbol.whale_alert_threshold_million` | Triệu VND | User-level | Riêng cho từng mã đã track |

### Hằng số trong `domain_constants.py`

```python
WHALE_ALERT_DEFAULT_THRESHOLD_MILLION = 500      # 500 triệu VND
WHALE_ALERT_DEFAULT_THRESHOLD_VND = 500_000_000
WHALE_SIZE_CLASS_SHARK_MIN_VND = 5_000_000_000   # ≥5 tỷ = "shark"
WHALE_SIZE_CLASS_WHALE_MIN_VND = 1_000_000_000   # ≥1 tỷ = "whale"
```

### Resolve logic theo từng path

**Path 1 – Realtime detect** (`tasks_realtime.py`):
```python
user_thresholds = _whale_thresholds_for_user(user_id)          # User-level
symbol_threshold_overrides = {sym: override_vnd for ...}       # Symbol-level
# Runtime: lấy symbol override nếu có, else user_thresholds[0]
thresholds = [symbol_threshold_overrides.get(normalized_symbol, user_thresholds[0])]
```
→ Đúng: symbol override được ưu tiên ✓

**Path 2 – Advisory fan-out** (`_resolve_advisory_threshold_vnd()`):
```python
if tracked_threshold_million is not None:
    return resolve_user_whale_threshold_vnd(tracked_threshold_million)  # Symbol override
return resolve_user_whale_threshold_vnd(user_cfg.whale_alert_threshold)  # User default
```
→ Đúng: cũng ưu tiên symbol override ✓

**Path 3 – Whale feed API** (`market_data_service.get_whale_feed()`):
→ Resolve: symbol override → user default → system default ✓

---

## III. Vấn đề: Ngưỡng TT Cảnh báo ≠ Ngưỡng từng mã từng user

### Câu hỏi gốc
> "Ngưỡng cảnh báo cá mập ở TT cảnh báo là ngưỡng chung của hệ thống chứ không phải là ngưỡng của từng mã cổ phiếu riêng lẻ cho từng người dùng riêng lẻ đúng không?"

### Trả lời: Không hoàn toàn đúng — nhưng có bug theo đúng hướng lo ngại

| Câu hỏi | Thực tế |
|---|---|
| Detection dùng threshold hệ thống (500M) khi global task? | **Đúng** — khi task chạy không có `user_id` |
| Advisory được tạo cho từng user với metadata threshold riêng? | **Đúng** — fan-out resolve per-user per-symbol |
| Advisory **chỉ được tạo** khi signal ≥ ngưỡng riêng của user? | **❌ Bug** — không filter |

### Bug cụ thể

**Kịch bản thực tế:**
1. Global task chạy với `user_id=None` → dùng system default = **500M**
2. Signal 800M VND được detect (vượt 500M)
3. Fan-out đến user B đang track symbol này, user B đặt ngưỡng = **2B VND**
4. `_accumulate_user_advisory_event()` KHÔNG kiểm tra `800M >= 2B` trước khi tạo advisory
5. Advisory được tạo cho user B với `matched_value_vnd = max(800M, 2B) = 2B` — **dữ liệu lệch**

**Code liên quan** (`tasks_realtime.py`, trong vòng lặp fan-out):
```python
for tracked_row in tracked_rows:
    tracked_user_id = int(tracked_row.get('user_id') or 0)
    user_cfg = user_cfgs_map.get(tracked_user_id)
    
    # Advisory threshold được resolve đúng per-symbol per-user:
    threshold_vnd = tasks_facade._resolve_advisory_threshold_vnd(
        user_cfg,
        tracked_threshold_million=tracked_row.get('whale_alert_threshold_million'),
    )
    
    # NHƯNG không có guard: if signal.matched_value >= threshold_vnd
    tasks_facade._accumulate_user_advisory_event(
        ...
        payload={'matched_value': signal.matched_value},   # 800M
        threshold_vnd=threshold_vnd,                        # 2B — chỉ lưu vào metadata
    )
```

**Hệ quả của `_accumulate_user_advisory_event()`:**
```python
'matched_value_vnd': float(max(matched_value_candidate, threshold_vnd)),
# → max(800M, 2B) = 2B VND — sai thực tế
```

---

## IV. Sai khác giữa Tooltip Nến và TT Cảnh báo

### A. Tooltip Bản đồ Nến (`DarkMoneyMasterChart`)

**Nguồn dữ liệu**: API `GET /stock-management/stocks/{symbol}/dark-money-history/`  
**File**: `backend/portfolio/views_dark_money_history.py`

**Cách tính count:**
```
IntradayTick DB
  └── filter(matched_value >= whale_threshold_vnd)   ← SQL annotate
  └── group by (trade_date, inferred_side)            ← Pandas groupby
  └── agg count = số ticks qualifying per date/side
  └── → 1 signal object per (date × side)
```

Frontend `buildWhaleSignalSummaryByTime()` → gom signals theo khung thời gian của nến:
- `whaleInfo.buyCount` = số **signal objects** được map vào candle đó (thường = 1 per day per side)
- Field `count` bên trong signal = số lệnh raw DB trong ngày đó (đây là con số "thật")

**Đặc điểm:**
- Dựa trên `IntradayTick` DB (historical)
- Threshold theo user request hiện tại qua `WhaleSignalEngine.resolve_threshold_vnd(request.user, symbol)`
- Phạm vi: toàn bộ period (1M, 3M, 6M…)

### B. Trung tâm Cảnh báo (Alert Center)

**Nguồn**: Realtime feed → `_accumulate_user_advisory_event()` → `WhaleAdvisory` DB record

**Cách tính:**
- Mỗi merge window (3 phút) = tối đa 1 advisory per user per symbol
- Chỉ tạo advisory nếu `advisory_whale_signal_enabled = True` trong `UserConfig`
- `aggregate_snapshot.whale.signal_count` hardcoded = 1 (không cộng dồn)

### Bảng so sánh chi tiết

| Thuộc tính | Tooltip Nến | TT Cảnh báo |
|---|---|---|
| **Nguồn dữ liệu** | IntradayTick DB (historical) | Realtime feed |
| **Đơn vị đếm** | Ticks qualifying per date/side | Advisory events (merged per 3 phút) |
| **Threshold** | Theo user gọi request | Theo user được fan-out (có thể sai — xem bug trên) |
| **Phạm vi thời gian** | Toàn bộ period (1M, 3M, 6M…) | Chỉ trong phiên hiện tại |
| **Số lượng thường thấy** | Cao hơn (raw tick count per day) | Thấp hơn (merged, throttled) |
| **Phạm vi user** | Chỉ của 1 user | Tất cả user track symbol đó |
| **Granularity intraday** | Daily groupby (bug với interval 1h/15m) | Theo thời gian thực |

---

## V. Tổng hợp Vấn đề Cần Xử lý

### Bug list ưu tiên

| # | Vấn đề | Mức độ | File liên quan |
|---|---|---|---|
| **B1** | Fan-out advisory không guard `matched_value >= threshold_vnd` → user nhận advisory cho signal dưới ngưỡng của họ | Cao | `tasks_realtime.py` (fan-out loop) |
| **B2** | `matched_value_vnd = max(matched_value, threshold_vnd)` làm lệch dữ liệu giá trị lệnh | Trung bình | `tasks_advisory_helpers.py` (`_accumulate_user_advisory_event`) |
| **B3** | `aggregate_snapshot.whale.signal_count` hardcoded = 1, không cộng dồn signal trong merge window | Thấp | `tasks_advisory_helpers.py` (`_build_advisory_aggregate_state_payload`) |
| **B4** | Tooltip nến: `whaleInfo.buyCount` hiển thị số signal objects (≤ số candle), không phải số lệnh raw | Thấp | `DarkMoneyMasterChart.jsx` (tooltip) |
| **B5** | Tooltip intraday (1h/15m): groupby theo `trade_date` thay vì bucket intraday → count luôn = 1 per side | Trung bình | `views_dark_money_history.py` (whale_signals section) |

---

## VI. Đề xuất Background Service: `LargeOrderCollectionService`

### Mục tiêu

Tạo một service chạy ngầm cho phép **thu thập, tổng hợp và lưu số lượng lệnh mua/bán lớn** của các mã cổ phiếu — phục vụ cả realtime lẫn historical, cho cả 1 mã, một số mã, hoặc toàn bộ mã được theo dõi.

### Kiến trúc đề xuất

```
                    ┌─────────────────────────────────────────────┐
                    │         LargeOrderCollectionService          │
                    │                                              │
  Manual API ──────►│  POST /api/portfolio/large-order-collection/ │
  Auto Schedule ───►│  (Celery Beat)                               │
                    │                                              │
                    │  collect_large_orders_task(                  │
                    │    symbols,         # None = all tracked     │
                    │    user_ids,        # None = all users       │
                    │    threshold_policy,# system/per_user/per_sym│
                    │    session_date,    # None = today           │
                    │  )                                           │
                    │                                              │
                    │  ┌──────────────────────────────────────┐   │
                    │  │ 1. Resolve target symbols (TrackedSym)│   │
                    │  │ 2. SQL annotate matched_value filter  │   │
                    │  │ 3. Pandas vectorized aggregation      │   │
                    │  │ 4. Persist LargeOrderSnapshot         │   │
                    │  │ 5. Cache stats → Redis                │   │
                    │  └──────────────────────────────────────┘   │
                    └─────────────────────────────────────────────┘
```

### Model mới đề xuất: `LargeOrderSnapshot`

```python
class LargeOrderSnapshot(models.Model):
    symbol = CharField(max_length=20, db_index=True)
    session_date = DateField(db_index=True)
    threshold_vnd = DecimalField(max_digits=20, decimal_places=0)
    threshold_source = CharField(max_length=20)   # 'system' | 'user' | 'symbol_override'
    buy_count = IntegerField(default=0)            # số lệnh mua lớn
    sell_count = IntegerField(default=0)           # số lệnh bán lớn
    buy_value = DecimalField(max_digits=24, decimal_places=0, default=0)
    sell_value = DecimalField(max_digits=24, decimal_places=0, default=0)
    total_count = IntegerField(default=0)
    collected_at = DateTimeField(auto_now=True)
    scope = CharField(max_length=30)               # 'system' | 'user:{id}'
    
    class Meta:
        unique_together = ('symbol', 'session_date', 'scope', 'threshold_vnd')
        indexes = [
            models.Index(fields=['session_date', 'symbol']),
        ]
```

### Celery Task Signature

```python
@shared_task(bind=True, name='portfolio.tasks.collect_large_orders')
def collect_large_orders_task(
    self,
    symbols: list[str] | str | None = None,   # None = all tracked symbols
    user_ids: list[int] | None = None,         # None = all users
    threshold_policy: str = 'system',          # 'system' | 'per_user' | 'per_symbol'
    session_date: str | None = None,           # ISO date string, None = today
    batch_size: int = 50,                      # số symbol mỗi batch DB query
) -> dict:
    ...
```

### Modes hoạt động

| Mode | `symbols` | `user_ids` | `threshold_policy` | Mô tả |
|---|---|---|---|---|
| **1 mã** | `['FPT']` | `None` | `'system'` | Thu thập FPT theo ngưỡng hệ thống |
| **Theo user** | `None` | `[42]` | `'per_symbol'` | Tất cả mã user 42 track, ngưỡng per-symbol |
| **Tất cả** | `None` | `None` | `'system'` | Toàn bộ mã được theo dõi |
| **Explicit list** | `['FPT','VNM']` | `[1,2]` | `'per_user'` | Kết hợp cụ thể |

### Cấu hình Auto Schedule đề xuất

```python
# Sau đóng cửa: thu thập đầy đủ cả phiên với ngưỡng per-symbol
'collect_large_orders_daily': {
    'task': 'portfolio.tasks.collect_large_orders',
    'schedule': crontab(hour=15, minute=30),
    'kwargs': {'symbols': None, 'user_ids': None, 'threshold_policy': 'per_symbol'},
}

# Intraday: cập nhật nhanh theo ngưỡng hệ thống
'collect_large_orders_intraday': {
    'task': 'portfolio.tasks.collect_large_orders',
    'schedule': crontab(minute='*/15'),
    'kwargs': {'symbols': None, 'user_ids': None, 'threshold_policy': 'system'},
}
```

### Compute Logic (SQL → Pandas)

```python
# Bước 1: SQL-side filter — projection theo đúng chiến lược SSOT
qs = IntradayTick.objects.filter(
    symbol__in=symbols_batch,
    trade_date=session_date,
).annotate(
    matched_value=ExpressionWrapper(
        Case(
            When(price__gte=1000, then=F('price') * F('volume')),
            default=F('price') * 1000 * F('volume'),
        ),
        output_field=FloatField()
    )
).filter(matched_value__gte=min_threshold_vnd)

# Bước 2: Pandas vectorized aggregation
frame = pd.DataFrame.from_records(qs.values('symbol', 'side', 'matched_value'))
result = (
    frame.groupby(['symbol', 'side'])
    .agg(count=('matched_value', 'size'), total_value=('matched_value', 'sum'))
    .reset_index()
)
```

---

## VII. Câu hỏi Cần Thảo luận trước khi Code

1. **B1 fix strategy**: Guard đơn giản `if signal.matched_value < threshold_vnd: continue` trong fan-out loop có đủ không, hay cần thêm logic ghi log khi bỏ qua?

2. **B2 fix strategy**: Bỏ `max(matched_value, threshold_vnd)` và dùng `matched_value` thật? Hay giữ floor là min thresold thực của user?

3. **LargeOrderSnapshot scope**: Lưu theo `'system'` scope hay theo `'user:{id}'` scope? Nếu per-user thì N users = N rows per symbol — có ổn về DB size?

4. **threshold_policy `'per_symbol'`**: Khi collect system-scope, dùng ngưỡng nào — `min()` của tất cả user (capture đủ), hay system default? Trade-off: min() capture nhiều hơn nhưng tốn DB space.

5. **API manual trigger**: Cần authentication level nào — admin only, hay mọi user đã đăng nhập có thể trigger cho symbol họ đang theo dõi?

6. **Tooltip nến B4/B5**: Có cần fix tooltip để hiển thị `count` thật (số lệnh raw) thay vì số signal objects? Hay chấp nhận semantic hiện tại?

---

## VIII. Files Liên quan

| File | Vai trò |
|---|---|
| `backend/portfolio/realtime/compute.py` | `detect_whale_signals()` — core detect logic |
| `backend/portfolio/tasks_realtime.py` | `collect_and_publish_realtime`, `_whale_thresholds_for_user`, fan-out loop |
| `backend/portfolio/tasks_advisory_helpers.py` | `_accumulate_user_advisory_event`, `_resolve_advisory_threshold_vnd` |
| `backend/portfolio/domain_constants.py` | Hằng số ngưỡng, `resolve_user_whale_threshold_vnd()` |
| `backend/portfolio/models.py` | `TrackedSymbol.whale_alert_threshold_million`, `UserConfig.whale_alert_threshold` |
| `backend/portfolio/market_data_service.py` | `get_whale_feed()`, `get_whale_feed_aggregate()` |
| `backend/portfolio/views_dark_money_history.py` | `dark_money_history_api()` — nguồn dữ liệu tooltip nến |
| `frontend/src/components/DarkMoneyMasterChart.jsx` | `buildWhaleSignalSummaryByTime()`, `OhlcTooltip` |
