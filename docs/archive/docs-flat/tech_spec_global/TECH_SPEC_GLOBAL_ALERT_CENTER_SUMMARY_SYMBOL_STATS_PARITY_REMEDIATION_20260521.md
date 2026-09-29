# Tech Spec — Global Alert Center Summary-Symbol Stats Parity Remediation
**Ngày**: 2026-05-21  
**Status**: Approved for implementation  
**Parent**: `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_HANDOFF_MASTER_20260521.md`

---

## 1. Phạm vi kỹ thuật

Spec này định nghĩa kỹ thuật cho:

1. Shared query scope cho alert-center main lane và ai lane.
2. Timeframe semantics server-side.
3. Aggregate thống kê theo mã ở backend.
4. Contract frontend-backend thống nhất cho KPI, feed, symbol-stats.

---

## 2. Scope model

Scope chuẩn gồm:

1. `lane`: `main` | `ai`
2. `symbol`
3. `alert_family`
4. `severity`
5. `session_date`
6. `timeframe`: `5m` | `15m` | `1h` | `session` | `5d`

Quy tắc:

1. `session_date` filter theo ngày giao dịch.
2. `timeframe` filter theo ngưỡng thời gian động tương đối với `now`.
3. Nếu cả hai có mặt, phải áp dụng giao của hai điều kiện.

---

## 3. Invariants bắt buộc

1. `summary.total == sum(symbol_stats.symbols[].count)` trong cùng scope.
2. `summary.by_severity.* == sum(symbol_stats.symbols[].by_severity.*)` trong cùng scope.
3. `unseen` chỉ phản ánh user hiện tại.
4. `symbol-stats` không phụ thuộc page size của feed.

---

## 4. API contracts

### 4.1 New endpoints

1. `GET /core/v1/signals/alert-center/symbol-stats`
2. `GET /core/v1/signals/ai-alerts/symbol-stats`

### 4.2 Query params

1. `symbol` (optional)
2. `alert_family` (optional)
3. `severity` (optional)
4. `session_date` (optional)
5. `timeframe` (optional)
6. `page` (optional)
7. `page_size` (optional)

### 4.3 Response shape tối thiểu

```json
{
  "lane": "main",
  "total_alerts_in_scope": 1555,
  "symbols": [
    {
      "symbol": "TLH",
      "count": 120,
      "buy_count": 80,
      "sell_count": 35,
      "neutral_count": 5,
      "total_value": 1234567890,
      "latest_triggered_at": "2026-05-21T14:31:22Z",
      "by_severity": {
        "critical": 1,
        "high": 9,
        "medium": 60,
        "low": 50
      }
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_pages": 8,
    "total_symbols": 154
  },
  "generated_at": "2026-05-21T14:32:00Z"
}
```

---

## 5. Aggregate algorithm

1. Dùng cùng scoped queryset như summary/feed.
2. Group by `symbol`.
3. Count theo direction và severity bằng conditional aggregation.
4. `total_value` là tổng `value` an toàn với null.
5. `latest_triggered_at` là max timestamp theo symbol.

---

## 6. Frontend contract changes

1. `coreApiAdapter` thêm 2 methods symbol-stats.
2. AlertCenterPage bỏ aggregate local từ `alerts`.
3. Summary cards và symbol table dùng cùng scope state object.

---

## 7. Backward compatibility

1. Không đổi contract feed/summary cũ theo hướng breaking.
2. Bổ sung endpoint mới theo additive change.

---

## 8. Observability

Metrics cần có:

1. latency endpoint symbol-stats.
2. scope mismatch detector (`summary_total_minus_symbol_sum`).
3. tỷ lệ request theo từng timeframe.
