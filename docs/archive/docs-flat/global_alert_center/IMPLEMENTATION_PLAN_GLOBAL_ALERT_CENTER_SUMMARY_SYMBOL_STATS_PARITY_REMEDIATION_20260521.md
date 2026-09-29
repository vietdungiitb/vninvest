# Implementation Plan — Global Alert Center Summary-Symbol Stats Parity Remediation
**Ngày**: 2026-05-21  
**Status**: Approved — Ready for execution  
**Parent**: `docs/GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_HANDOFF_MASTER_20260521.md`

---

## 1. Tổng quan

Kế hoạch này xử lý triệt để 4 lớp lỗi:

1. Scope mismatch giữa summary và symbol-stats.
2. Timeframe control không được backend thực thi.
3. Thuật toán aggregate cục bộ từ sample feed page.
4. UI semantics gây hiểu nhầm toàn scope với page sample.

---

## 2. Dependency graph

```text
P01 Shared scope builder + timeframe parser
  -> P02 Summary aggregate correctness hardening
    -> P03 Symbol-stats endpoints (main + ai lanes)
      -> P04 Frontend adapter contract extension
        -> P05 AlertCenterPage switch to server symbol-stats
          -> P06 UI semantics + scope labeling hardening
            -> P07 Tests + parity invariant gates
```

---

## 3. Task breakdown

| Task ID | Tên | Artifact chính | DoD |
|---|---|---|---|
| P01 | Shared scope builder + timeframe parser | `signal_intelligence/views.py` | `timeframe` được parse nhất quán và áp vào feed/summary/symbol-stats/context |
| P02 | Summary aggregate correctness | `signal_intelligence/views.py` | `total`, `by_severity`, `unseen` đúng user-scope và không phình do join |
| P03 | Symbol-stats endpoints | `signal_intelligence/views.py`, urls | Có endpoint main/ai trả aggregate theo symbol toàn scope |
| P04 | Adapter contract extension | `coreApiAdapter.js`, test | Có methods `getAlertCenterSymbolStats`, `getAIAlertsSymbolStats` |
| P05 | Frontend switch | `AlertCenterPage.js` | Bảng theo mã dùng payload server, bỏ aggregate từ `alerts` page |
| P06 | UI semantics hardening | `AlertCenterPage.js` | Labels rõ `toàn phạm vi lọc` vs `đang hiển thị trang feed` |
| P07 | Tests + parity gates | core + web tests | Pass invariant `summary.total == sum(symbol_stats.count)` |

---

## 4. Chi tiết task

### P01 — Shared scope builder + timeframe parser

**Mục tiêu:** Tạo một đường filter thống nhất cho mọi endpoint alert-center.

**Yêu cầu:**
1. Hỗ trợ `timeframe` giá trị: `5m`, `15m`, `1h`, `session`, `5d`.
2. Tính mốc thời gian tại server bằng timezone chuẩn của hệ thống.
3. `session_date` và `timeframe` có quy tắc ưu tiên rõ ràng, có test.

### P02 — Summary aggregate correctness

**Mục tiêu:** Đảm bảo summary phản ánh đúng delivery scope theo user hiện tại.

**Yêu cầu:**
1. `unseen` chỉ đếm delivery row của user hiện tại.
2. Aggregate tránh sai số do join duplication.
3. Có test đa user để chặn leakage.

### P03 — Symbol-stats endpoints

**Mục tiêu:** Trả server truth cho bảng theo mã.

**Endpoints mới:**
1. `GET /core/v1/signals/alert-center/symbol-stats`
2. `GET /core/v1/signals/ai-alerts/symbol-stats`

**Payload tối thiểu:**
1. `total_alerts_in_scope`
2. `symbols[]` gồm `symbol`, `count`, `buy_count`, `sell_count`, `neutral_count`, `total_value`, `latest_triggered_at`, `by_severity`
3. `generated_at`

### P04 — Adapter contract extension

**Mục tiêu:** packages/web chỉ gọi endpoint qua `coreApiAdapter`.

### P05 — Frontend switch

**Mục tiêu:** AlertCenterPage dùng symbol-stats server payload.

**Yêu cầu:**
1. Không còn `alerts.forEach(...)` để build bảng theo mã.
2. Search/pagination bảng theo mã chạy trên dataset server trả về.

### P06 — UI semantics hardening

**Mục tiêu:** Người dùng nhìn UI không hiểu sai phạm vi dữ liệu.

**Yêu cầu:**
1. KPI gắn nhãn `toàn phạm vi lọc`.
2. Feed gắn nhãn `đang hiển thị N/X sự kiện`.
3. Hiển thị chip scope active: lane, timeframe, symbol, session_date.

### P07 — Tests + parity gates

**Mục tiêu:** Ngăn tái phát lỗi.

**Gate bắt buộc:**
1. Invariant test backend.
2. Frontend integration test scope sync.
3. Không merge nếu invariant fail.
