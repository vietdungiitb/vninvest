# Implementation Plan — Global Market Data Matrix SSOT
**Ngày**: 2026-05-15  
**Phiên bản**: 1.0  
**Status**: Approved — Ready for execution  
**Parent**: `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_HANDOFF_MASTER_20260515.md`

---

## 1. Tổng quan kế hoạch

| Hạng mục | Giá trị |
|----------|---------|
| Tổng số tasks | 12 tasks (T01–T12) |
| Backend core tasks | T01–T08 |
| Frontend/SOC tasks | T09 |
| Testing + rollout | T10–T12 |
| Ưu tiên | T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11 → T12 |

---

## 2. Dependency graph

```text
T01 Governance + schemas
  -> T02 Global registry models
    -> T03 Demand-source promotion flows
      -> T04 Coverage/freshness inventory
        -> T05 Missing-only planner
          -> T06 Ingest task refactor
            -> T07 Queue tiers + schedules
              -> T08 Read-path cutover
                -> T09 SOC Data Ops UI/API
                  -> T10 Tests + audits
                    -> T11 Shadow validation
                      -> T12 Final rollout docs
```

---

## 3. Tasks chi tiết

### T01 — Governance hardening

**Mục tiêu**: Nâng các nguyên tắc SSOT global matrix thành governance công khai của repo.

**Phạm vi**:
- Cập nhật `AGENTS.md`
- Cập nhật `docs/AI_CODING_REGULATION.md`
- Chốt naming cho global market data matrix doc-pack

**DoD**:
- Hard rules xuất hiện công khai ở governance docs
- Future sessions có read-first pack rõ ràng

---

### T02 — Global registry models

**Mục tiêu**: Tạo persistence layer SSOT cho global universe.

**Files mục tiêu**:
- `packages/core/backend/src/market_data/models.py` hoặc app native mới phù hợp

**Models tối thiểu**:
- `GlobalSymbolRegistry`
- `GlobalSymbolDemandSource`
- `GlobalSymbolCoverage`

**DoD**:
- Một symbol có đúng một row registry canonical
- Demand sources được lưu riêng, queryable, audit-friendly
- Coverage/freshness không bị trộn vào execution logs

---

### T03 — Demand-source promotion flows

**Mục tiêu**: Mọi nguồn demand hợp lệ đều đẩy vào cùng một flow promotion.

**Nguồn bắt buộc**:
- system defaults
- admin global groups
- holdings
- watchlists
- tracked symbols
- alerts

**DoD**:
- Watchlist add/update/delete, holdings change, tracked symbol mutation, alert mutation đều gọi cùng một promotion service
- Không còn distinct-query rải rác làm universe truth ở nhiều nơi

---

### T04 — Coverage + freshness inventory

**Mục tiêu**: Tính được tình trạng dữ liệu của từng symbol theo dataset.

**Datasets tối thiểu**:
- `daily_prices`
- `price_board_snapshot`
- `intraday_bars`
- `intraday_ticks`
- `session_facts`

**Outputs tối thiểu**:
- latest available
- freshness state
- missing ranges
- stale reason
- next recommended action

**DoD**:
- Planner không cần suy diễn từ raw table scan ad hoc mỗi lần chạy

---

### T05 — Missing-only planner

**Mục tiêu**: Thay planner `days=N`/full-scan bằng plan items explicit.

**Plan item phải chứa**:
- dataset
- symbol or symbol group
- provider chain
- requested range/window
- reason (`missing`, `stale`, `repair`, `warmup`, `manual_force`)
- overwrite policy

**DoD**:
- Default policy là `missing_only=true`
- `force_refresh` phải explicit, audited, previewable

---

### T06 — Ingest task refactor

**Mục tiêu**: Refactor `data_ingest` để consume plan items thay vì chạy mù.

**Scope**:
- daily history
- price board refresh
- intraday warm-up / tape hydration

**DoD**:
- Task output có `inserted`, `updated`, `skipped_existing`, `failed`, `repaired_conflicts`
- Không fetch range không cần thiết nếu coverage cho thấy đã đủ

---

### T07 — Queue tiers + schedule policies

**Mục tiêu**: Chuẩn hóa hàng đợi global theo độ ưu tiên vận hành.

**Tiers gợi ý**:
- `hot_user_demand`
- `warm_liquid_market`
- `cold_full_market`
- `recovery_backlog`

**DoD**:
- Schedule và queue policy được cấu hình runtime qua SOC Data Ops
- Symbol mới từ user demand được promote đúng tier thay vì full-matrix rebuild

---

### T08 — Read-path cutover

**Mục tiêu**: Dùng global data layer làm source chính cho các product surfaces.

**Surfaces ưu tiên**:
- Watchlist
- Dashboard
- Stock Detail
- AI advisory / alerts liên quan market data

**DoD**:
- Không có feature chính nào recrawl riêng theo user để lấy dữ liệu đã có trong global layer

---

### T09 — SOC Data Ops operator surface

**Mục tiêu**: Mở rộng SOC thành control center thống nhất cho market-data SSOT.

**Panels tối thiểu**:
- Runtime config
- Coverage/freshness board
- Queue tier board
- Manual run builder
- Run history / audit trail

**DoD**:
- Operator có thể xem, lên lịch, preview và trigger crawl theo global policy

---

### T10 — Tests + audit evidence

**Mục tiêu**: Khóa invariants của SSOT global matrix.

**Coverage bắt buộc**:
- add/remove watchlist không tạo silo crawl
- nhiều user theo dõi cùng mã không tạo duplicate plan items
- symbol chỉ hạ tier sau khi hết demand + qua decay window
- planner missing-only không full-scan khi coverage đủ

---

### T11 — Shadow validation

**Mục tiêu**: Chạy song song global planner mới với path cũ đủ lâu để so sánh.

**Yêu cầu**:
- log parity về symbol universe size
- so sánh queue volume
- so sánh freshness distribution

---

### T12 — Final rollout docs

**Mục tiêu**: Cập nhật đầy đủ evidence, progress, audit ledger và pack docs sau rollout.

**DoD**:
- `CODE_CHANGE_AUDIT_LEDGER.md` cập nhật
- `PROGRESS_DASHBOARD.md` cập nhật
- evidence đầy đủ theo template
