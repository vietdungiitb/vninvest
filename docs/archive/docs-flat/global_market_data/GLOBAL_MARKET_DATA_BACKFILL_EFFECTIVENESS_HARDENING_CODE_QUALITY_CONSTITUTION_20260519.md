# Code Quality Constitution — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19

---

## 1. Absolute rules

1. `GlobalSymbolRegistry` và `GlobalSymbolCoverage` là nền SSOT; cấm tạo planner universe song song.
2. Cấm `order_by(symbol)` như priority mặc định cho backfill repair path nếu không đi kèm ranking theo gap/tier.
3. `run_now` không được đánh dấu `success` hay `running` chỉ bằng cache marker; phải có state truth từ backend run model/log.
4. Cấm `except: pass` và `except Exception: pass` trong scheduler/API/executor paths.
5. Cấm direct provider imports ngoài `market_data/vnbroker_adapter.py`.
6. Cấm frontend suy diễn completeness/business truth từ dữ liệu cục bộ khi backend đã có planner/progress truth.
7. Cấm overwrite existing history làm default behavior.
8. Tất cả text UI mới phải qua i18n tiếng Việt đầy đủ dấu.
9. Endpoint mới/chỉnh sửa phải theo OpenAPI constitution và error envelope chuẩn.
10. Mọi slice code/runtime phải có evidence + governance updates trước khi đóng.

---

## 2. Required implementation style

1. Planner preview phải trả `priority_reason` và `mode` rõ ràng.
2. Progress API phải trả counters có thể audit, không phải log text raw.
3. Backfill executor phải ghi counters `inserted/updated/skipped_existing/failed` nhất quán.
4. Scheduler history phải phân biệt trigger `beat_schedule` và `operator_run_now`.
5. Tests phải khóa behavior `hot gap > warm no-gap`.

---

## 3. Required review questions

1. Thay đổi này có làm planner quay về full-scan alphabet-first không?
2. UI có còn khả năng hiển thị `ĐANG CHẠY` khi task đã terminal-state không?
3. API response có đủ error envelope và pagination chưa?
4. Mode mới có vô tình implicit `force_refresh=true` không?
5. Hot promoted symbol có còn phải chờ weekly deep history không?
6. Governance docs và evidence template đã cập nhật chưa?

---

## 4. Patterns cấm

```python
# CẤM — sort alphabet làm priority mặc định cho repair
plan_items.sort(key=lambda item: item['symbol'])

# CẤM — set inflight nhưng không clear khi task xong
cache.set(f'scheduler:inflight:{job_key}', celery_task_id, timeout=7200)

# CẤM — frontend tự tính progress giả
const isRunning = job.lastRunAt && Date.now() - new Date(job.lastRunAt) < 7200000;

# CẤM — force refresh implicit
force_refresh = payload.get('force_refresh', True)
```

---

## 5. Patterns bắt buộc

```python
# ĐÚNG — planner ranking theo gap + tier + demand
plan_items.sort(key=lambda item: (
    item['tier_severity'],
    -item['missing_history_days'],
    -item['active_demand_weight'],
    item['symbol'],
))

# ĐÚNG — progress response có counters chuẩn
return Response({
    'run_id': run.run_id,
    'status': run.status,
    'planned_symbols_count': run.planned_symbols_count,
    'completed_symbols_count': run.completed_symbols_count,
    'eta_seconds': run.eta_seconds,
})
```
