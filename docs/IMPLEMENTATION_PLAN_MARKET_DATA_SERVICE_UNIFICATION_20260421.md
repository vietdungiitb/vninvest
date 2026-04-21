# IMPLEMENTATION PLAN: Market Data Service Unification (MDSU)

**Ngày tạo**: 2026-04-21  
**Phạm vi chương trình**: MDSU — Market Data Service Unification  
**Level**: A (Major — thay đổi service/data layer, ảnh hưởng 5+ module nghiệp vụ)  
**Owner**: Backend Lead  
**Reviewer**: Project Lead  
**Trạng thái**: READY FOR REVIEW / ĐỢI PHÊ DUYỆT

---

## 1. Business Objective

### Vấn đề cần giải quyết

Hiện tại `DailyPrice` bị truy vấn trực tiếp tại **13 call-site nghiệp vụ** phân tán qua 7 module khác nhau:

| Module | File | Số call-site | Vấn đề chính |
|--------|------|:---:|---|
| Analytics | `analytics.py` | 4 | Mỗi nơi định nghĩa "latest price" khác nhau |
| Analytics Extended | `views_analytics_extended.py` | 3 | N+1: loop symbols → query từng dòng |
| Watchlist Indicators | `tasks_watchlist_indicators.py` | 2 | 2 cách lấy historical khác nhau trong cùng task |
| Backfill Service | `services_backfill.py` | 1 | Không batch, gây timeout khi 79M rows |
| Screener | `views_screener.py` | 3 | latest_dates + filter lặp theo chunk không nhất quán |
| AI Advisory Helpers | `ai_advisory_helpers.py` | 2 | Mỗi helper định nghĩa lookback window riêng |
| AI Context | `ai_context.py` + `views_ai_advisory_session.py` | 3 | Dùng `legacy_views.DailyPrice` bypass |

**Hệ quả đo được**:
- Backfill timeout trên tập dữ liệu 79M rows.
- Dashboard analytics có thể trả số liệu lệch nhau vì 2 cách xác định "giá mới nhất".
- N+1 query khi xử lý danh sách mã lớn ở Screener và Watchlist.
- Khi đổi logic giá cần sửa 7 nơi, rủi ro miss case rất cao.

### KPI kỳ vọng sau MDSU

| Chỉ số | Trước (baseline) | Mục tiêu |
|--------|:---:|:---:|
| Backfill timeout rate | Xảy ra trên tập > 50 symbols | 0 trên tập 200 symbols |
| Query count / request Analytics | > 10 queries | ≤ 3 queries (batch) |
| Query count / task Watchlist | N queries (N = số symbols) | 1 bulk query |
| p95 latency Screener endpoint | Cần đo baseline | Giảm ≥ 30% |
| Cache hit rate MarketDataService | N/A | ≥ 60% với warm cache |

---

## 2. Scope và Non-Scope

### In-Scope (Phase 1–3)

- Xây dựng `backend/portfolio/market_data_service.py` mở rộng với class `MarketDataService`.
- Migrate 13 call-site nghiệp vụ sang dùng `MarketDataService`.
- Contract tests (snapshot tests) cho API canonical.
- Gate test: scan codebase cấm direct `DailyPrice.objects` trong các module đã migrate.
- Cache layer: local-context cache + Redis cache với TTL/key versioning.

### Out-of-Scope (không chạm trong MDSU v1)

- Tests fixtures: `tests/` vẫn được phép dùng `DailyPrice.objects.create` trực tiếp.
- Admin views (`admin.py`): dùng để thống kê tổng, không ảnh hưởng nghiệp vụ.
- Management commands (`management/commands/`): data migration tools, giữ nguyên.
- Write operations: `DailyPrice.objects.update_or_create` trong `services.py` (backfill write path) giữ nguyên.
- Frontend, mobile, opennews: không có thay đổi.

---

## 3. Current-State Assessment

### 3.1 Các pattern truy vấn hiện tại (phân mảnh)

**Pattern A — Max(date) per symbol (Screener + Analytics Extended)**:
```python
# views_screener.py:65 và views_analytics_extended.py:39
DailyPrice.objects.values('symbol').annotate(latest=Max('date'))
```

**Pattern B — order_by('-date').first() per symbol (N+1)**:
```python
# tasks_prefetch.py:1478, ai_advisory_helpers.py:957
DailyPrice.objects.filter(symbol=s).order_by('-date').first()
```

**Pattern C — filter + slice theo lookback_days (mỗi nơi 1 số khác nhau)**:
```python
# ai_advisory_helpers.py:957 → [:lookback_days]
# ai_context.py:55 → [:30]
# tasks_watchlist_indicators.py:73 → order_by('-date')[:60]
# tasks_watchlist_indicators.py:80 → order_by('-date')[:30]
```

**Pattern D — bulk filter nhiều symbols (services_backfill, analytics)**:
```python
# analytics.py:225 — lấy latest prices cho danh sách symbols
# services_backfill.py:44 — filter theo symbol list để lấy prev_close
```

### 3.2 File hiện tại liên quan

- `backend/portfolio/market_data_service.py` — **đã tồn tại** nhưng chỉ có logic cho Unified Alerts, chưa có Market Data query layer.
- Không có `MarketDataService` class chuyên biệt cho `DailyPrice`.

### 3.3 Constraints

- DB: SQLite local / PostgreSQL prod. Query phải tương thích cả hai.
- Redis: đã có, dùng cho cache realtime. Sẵn sàng dùng cho MDSU cache layer.
- Celery: backfill và watchlist tasks chạy trong worker. Service phải thread-safe, không giữ state per-instance.

---

## 4. Target Design

### 4.1 Kiến trúc đích

```
┌─────────────────────────────────────────────────────────┐
│  Business Modules (views, tasks, services, analytics)   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │            MarketDataService (SSOT)              │   │
│  │  get_ohlcv_batch()                               │   │
│  │  get_latest_snapshot()                           │   │
│  │  get_historical_indicators()                     │   │
│  └─────────────┬────────────────────────────────────┘   │
│                │                                        │
│  ┌─────────────▼──────────────┐  ┌───────────────────┐  │
│  │  Hybrid Cache Layer        │  │  DB Query Layer   │  │
│  │  - Local context dict      │  │  (Django ORM)     │  │
│  │  - Redis (cross-request)   │  │  DailyPrice model │  │
│  └────────────────────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 API Canonical (3 phương thức chính)

```python
class MarketDataService:

    @classmethod
    def get_latest_snapshot(cls, symbols: list[str]) -> dict[str, dict]:
        """
        Trả về giá đóng cửa mới nhất cho danh sách symbols.
        Output: { 'VNM': {'close': 85000, 'date': '2026-04-21', 'volume': ...}, ... }
        Canonical: dùng MAX(date) per symbol theo trading date chuẩn.
        Cache: Redis TTL=300s, key = mdsu:latest:{symbol}:v1
        """

    @classmethod
    def get_ohlcv_batch(
        cls,
        symbols: list[str],
        start_date: date,
        end_date: date,
        fields: list[str] = None,
    ) -> dict[str, list[dict]]:
        """
        Trả về lịch sử OHLCV theo khoảng ngày cho nhiều symbols.
        Output: { 'VNM': [{'date': ..., 'close': ..., 'volume': ...}, ...], ... }
        Canonical: sorted by date ASC, missing candle = bỏ qua (không fill).
        Cache: Redis TTL=3600s (daily data ổn định sau market close).
        """

    @classmethod
    def get_historical_indicators(
        cls,
        symbols: list[str],
        lookback_days: int,
        include_fields: list[str] = None,  # ['close_price', 'volume', 'rsi', 'sma']
    ) -> dict[str, list[dict]]:
        """
        Trả về dữ liệu lịch sử cho tính toán indicators.
        Canonical window: lookback_days tính từ trading date gần nhất.
        Cache: local-context cache cho batch tasks, Redis cho API requests.
        """
```

### 4.3 Caching Design

| Layer | Dùng khi | TTL | Key format | Invalidation |
|-------|----------|:---:|------------|---|
| Local context dict | Batch tasks (Backfill, Watchlist) | Scope của 1 job | N/A (in-memory) | Hết scope tự xóa |
| Redis | API requests, cross-request | 300s (latest) / 3600s (history) | `mdsu:{type}:{symbol}:v1` | Explicit sau market close |

### 4.4 Luồng dữ liệu

```
Request/Task
  → MarketDataService.get_*()
    → Check local context cache (nếu batch)
      → HIT: trả về ngay
    → Check Redis cache
      → HIT: trả về
    → DB Query (bulk, 1 query per request)
      → Populate Redis cache
      → Populate local context cache
      → Trả về
```

---

## 5. Execution Phases

### Phase 0 — Service Skeleton + Contract Tests (3 ngày)

**Mục tiêu**: Dựng `MarketDataService` với 3 API canonical, viết contract tests, **chưa thay code cũ**.

**Công việc**:
1. Tạo class `MarketDataService` trong `backend/portfolio/market_data_service.py`.
2. Implement `get_latest_snapshot()` — dùng `MAX(date)` bulk query.
3. Implement `get_ohlcv_batch()` — bulk filter + group by symbol.
4. Implement `get_historical_indicators()` — bulk filter với lookback.
5. Thêm local context cache (đơn giản: dict per call, thread-safe).
6. Thêm Redis cache layer.
7. Viết contract tests:
   - Snapshot test: kết quả `get_latest_snapshot(['VNM', 'VCB', 'FPT'])` phải khớp với query `DailyPrice.objects.filter(...).order_by('-date').first()` hiện tại.
   - Edge cases: empty list, symbol không tồn tại, missing dates.

**Files thay đổi**:
- `backend/portfolio/market_data_service.py` (MODIFIED — add `MarketDataService` class)
- `backend/portfolio/tests/test_market_data_service.py` (NEW — contract + parity tests)

**Rollback**: Không có gì thay đổi ở business code → không cần rollback.

**DoD Phase 0**:
- [ ] Contract tests pass 100%.
- [ ] Parity test: kết quả service == kết quả query cũ cho bộ symbol test cố định.
- [ ] No P0 defect.

---

### Phase 1 — Migrate Backfill + Watchlist Indicators (3 ngày)

**Mục tiêu**: Giải quyết điểm đau lớn nhất — timeout Backfill và N+1 Watchlist.

**Công việc**:
1. `services_backfill.py:44` → Thay bằng `MarketDataService.get_latest_snapshot()`.
2. `tasks_watchlist_indicators.py:73,80` → Thay bằng `MarketDataService.get_historical_indicators()` với local context cache cho toàn batch.
3. `tasks_prefetch.py:1478,1483` → Thay bằng `get_latest_snapshot()`.
4. Bổ sung feature flag `MDSU_BACKFILL_ENABLED` để rollback nhanh nếu cần.

**Files thay đổi**:
- `backend/portfolio/services_backfill.py` (MODIFIED)
- `backend/portfolio/tasks_watchlist_indicators.py` (MODIFIED)
- `backend/portfolio/tasks_prefetch.py` (MODIFIED)

**Parity test**: Chạy backfill trên 10 symbols, so sánh prev_close với query cũ.

**KPI đo trước/sau**:
- Số query khi chạy Watchlist batch 50 symbols: N+1 → 1 bulk.
- Backfill không timeout trên 50 symbols.

**Rollback Phase 1**: Tắt feature flag `MDSU_BACKFILL_ENABLED`.

**DoD Phase 1**:
- [ ] `services_backfill.py` không còn direct `DailyPrice.objects` (ngoài write operations).
- [ ] `tasks_watchlist_indicators.py` không còn N+1 query.
- [ ] Parity test pass.
- [ ] KPI backfill timeout = 0 trên bộ test 50 symbols.

---

### Phase 2 — Migrate Analytics + Screener (3 ngày)

**Mục tiêu**: Chuẩn hóa "giá mới nhất" và loại bỏ N+1 trong Analytics.

**Công việc**:
1. `analytics.py:93,225,268,805` → Thay bằng `get_ohlcv_batch()` và `get_latest_snapshot()`.
2. `views_analytics_extended.py:39,98,108` → Thay bằng `get_latest_snapshot()` (loại bỏ Max(date) loop N+1).
3. `views_screener.py:65,80,106` → Thay bằng `get_latest_snapshot()` + `get_ohlcv_batch()`.
4. Bổ sung feature flag `MDSU_ANALYTICS_ENABLED`.

**Files thay đổi**:
- `backend/portfolio/analytics.py` (MODIFIED)
- `backend/portfolio/views_analytics_extended.py` (MODIFIED)
- `backend/portfolio/views_screener.py` (MODIFIED)

**KPI đo trước/sau**:
- Query count / Analytics request: từ > 10 xuống ≤ 3.
- p95 Screener latency: giảm ≥ 30%.

**Rollback Phase 2**: Tắt feature flag `MDSU_ANALYTICS_ENABLED`.

**DoD Phase 2**:
- [ ] Không còn `Max(date)` loop N+1 trong `views_analytics_extended.py`.
- [ ] Analytics trả kết quả nhất quán với Phase 0 parity baseline.
- [ ] Screener tests pass.

---

### Phase 3 — Migrate AI Advisory Context + Cleanup (3 ngày)

**Mục tiêu**: Thống nhất lookback window AI và xóa `legacy_views.DailyPrice` bypass.

**Công việc**:
1. `ai_advisory_helpers.py:957,1038` → Thay bằng `get_historical_indicators()`.
2. `ai_context.py:55` → Thay bằng `get_historical_indicators()`.
3. `views_ai_advisory_session.py:79,83` → Xóa `legacy_views.DailyPrice`, dùng service.
4. `tasks_signal_verification.py:43,50` → Thay bằng `get_latest_snapshot()`.
5. Bật gate test: scan cấm `DailyPrice.objects.filter/order_by/annotate` trong 7 module đã migrate.
6. Xóa feature flags sau khi production stable 48h.

**Files thay đổi**:
- `backend/portfolio/ai_advisory_helpers.py` (MODIFIED)
- `backend/portfolio/ai_context.py` (MODIFIED)
- `backend/portfolio/views_ai_advisory_session.py` (MODIFIED)
- `backend/portfolio/tasks_signal_verification.py` (MODIFIED)
- `backend/portfolio/tests/test_mdsu_gate.py` (NEW — gate test cấm direct queries trong migrated files)

**DoD Phase 3**:
- [ ] Không còn `legacy_views.DailyPrice` bất kỳ đâu.
- [ ] Gate test pass (scan 7 module đã migrate).
- [ ] AI advisory contract tests pass với lookback window chuẩn.
- [ ] Toàn bộ KPI target đạt.

---

## 6. API và Data Contract Changes

Không thay đổi API endpoint nào với caller bên ngoài. `MarketDataService` là **internal service layer**, không expose HTTP endpoint.

Contract cần chuẩn hóa:
- `latest` = ngày trading date lớn nhất có trong DB (dùng `Max('date')` aggregate, không phải `order_by('-date').first()` riêng lẻ).
- `reference_price` = close_price của latest date trên (đồng nhất giữa Analytics, Watchlist, Screener).
- Missing candle = bỏ qua (không fill với NaN), trả về list thực tế.
- Timezone: tất cả date là naive date (HOSE trading date, không có tz).

---

## 7. Scheduling và Operations

`MarketDataService` là **synchronous service**, không có scheduler riêng.

Cache invalidation:
- Redis cache tự expire sau TTL.
- Sau market close (15:30 ICT), Redis key có thể được explicit purge nếu cần: `cache.delete_pattern('mdsu:latest:*')`.
- Backfill write → không cần invalidate (dữ liệu lịch sử không thay đổi).

Concurrency:
- Local context cache là dict per function call, không share state giữa Celery workers.
- Redis cache thread-safe do thiết kế Redis.

---

## 8. Testing và Verification

### Test plan

| Layer | Test | File |
|-------|------|------|
| Unit | Service methods với mock DB | `test_market_data_service.py` |
| Parity | Service output == old query output | `test_market_data_service.py` |
| Integration | Endpoint Analytics trả đúng số | `test_analytics_advanced.py` (extend) |
| Integration | Backfill không timeout 50 symbols | manual + smoke |
| Gate | Không còn direct query trong migrated files | `test_mdsu_gate.py` |

### Exit criteria để release mỗi Phase

- 0 test failures trong test suite liên quan.
- Parity test pass với bộ symbol `['VNM', 'VCB', 'FPT', 'VIC', 'HPG']`.
- KPI cải thiện đo được.

---

## 9. Observability và Alerting

Metrics cần thêm vào `MarketDataService`:
- `mdsu.cache.hit` / `mdsu.cache.miss` — đếm cache hit/miss per method.
- `mdsu.query.count` — số DB query thực tế per call.
- `mdsu.latency_ms` — latency từ service.

Log structured:
```python
logger.info("mdsu.get_latest_snapshot", extra={
    "symbols_count": len(symbols),
    "cache_hits": cache_hits,
    "db_queries": 1 if cache_miss else 0,
    "duration_ms": elapsed,
})
```

---

## 10. Security và Governance

- `MarketDataService` không xử lý auth/permission → responsibility thuộc view layer (không thay đổi).
- Không expose secrets hoặc PII trong log.
- Gate test `test_mdsu_gate.py` là **hard blocker** cho CI pipeline sau Phase 3.

---

## 11. Release Plan

| Phase | Rollout | Rollback |
|-------|---------|---------|
| Phase 0 | Dev only, không ảnh hưởng production | Xóa service file |
| Phase 1 | Dev → feature flag → prod | Tắt `MDSU_BACKFILL_ENABLED` |
| Phase 2 | Dev → feature flag → prod | Tắt `MDSU_ANALYTICS_ENABLED` |
| Phase 3 | Dev → smoke 48h → gate test → remove flags | Revert 4 files |

Điều kiện rollback ngay:
- p95 analytics > 2x baseline sau Phase 2.
- Backfill error rate tăng sau Phase 1.
- AI advisory trả kết quả lệch baseline snapshot.

---

## 12. Ownership và Timeline

| Phase | Owner | Reviewer | Thời gian | Mốc |
|-------|-------|---------|-----------|-----|
| Phase 0 | Backend Lead | Project Lead | 3 ngày | D+3 |
| Phase 1 | Backend Lead | Backend Lead | 3 ngày | D+6 |
| Phase 2 | Backend Lead | Project Lead | 3 ngày | D+9 |
| Phase 3 | Backend Lead | Project Lead | 3 ngày | D+12 |
| **Tổng** | | | **~2 tuần** | |

---

## 13. SSOT Integration Map

- Domain SSOT: `vnstock adapter` (provider) + custom `MarketDataService` (computed/cached layer).
- Canonical call-sites sau MDSU: chỉ duy nhất `MarketDataService.*` trong business modules.
- Các luồng cũ cần retire: 13 call-site direct `DailyPrice.objects.*` trong 7 module nghiệp vụ (danh sách đầy đủ ở Taskboard).
- Không tạo parallel pipeline: MDSU là cổng duy nhất — mọi module đều đi qua.

---

## 14. MDSU Compliance Map

- API canonical: `get_ohlcv_batch`, `get_latest_snapshot`, `get_historical_indicators`.
- Query cũ cần retire: xem chi tiết tại Taskboard, cột "Call-site hiện tại".
- Caching design: local context dict (per-batch) + Redis TTL 300s/3600s + key `mdsu:{type}:{sym}:v1`.
- Migration strategy: strangler fig theo 3 phase với feature flag + parity test + rollback switch.
- KPI: xem mục 1 bảng KPI kỳ vọng.

---

*Tài liệu này thuộc Mandatory Triad MDSU. Tham chiếu:*
- *Tech Spec: `TECH_SPEC_MARKET_DATA_SERVICE_UNIFICATION_20260421.md`*
- *Taskboard: `TASKBOARD_MARKET_DATA_SERVICE_UNIFICATION_20260421.md`*
