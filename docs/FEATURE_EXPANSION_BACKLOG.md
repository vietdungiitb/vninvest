# Feature Expansion Backlog (Canonical, aligned with current codebase)

> **Status**: ACTIVE BACKLOG  
> **Last aligned**: 2026-04-03  
> **Note**: Tài liệu này đã được chuẩn hóa theo trạng thái source hiện tại. Các mục đã triển khai được giữ lại dưới dạng historical record, không coi là pending backlog.

---

## 1) Mục tiêu backlog

- Duy trì một backlog mở rộng có thứ tự ưu tiên rõ ràng.
- Tách bạch giữa:
  - **Delivered** (đã có trong code)
  - **Hardening** (đã có foundation nhưng cần nâng chất lượng vận hành)
  - **Future** (chưa triển khai)
- Tránh lặp kế hoạch giữa các tài liệu roadmap/sprint/checklist.

---

## 2) Nguyên tắc ưu tiên

1. Ưu tiên hạng mục tận dụng trực tiếp nền realtime + analytics đã có.
2. Ưu tiên hardening vận hành trước khi mở rộng tính năng phụ thuộc bên ngoài.
3. Mọi hạng mục vào sprint phải có owner, DoD và KPI kiểm chứng được.

---

## 3) Delivered (Historical, không còn backlog pending)

### D-01 Shared frontend realtime layer
- Hook dùng chung `useRealtimeFeed` đã áp dụng cho Watchlist + Dashboard.

### D-02 Realtime portfolio value / unrealized P&L (foundation)
- Dashboard realtime panel đã có lớp hiển thị giá trị gần realtime và trạng thái stale.

### D-03 User-defined price alerts (vertical slice)
- Có model/API/UI cơ bản cho price alerts + cooldown.

### D-04 Scheduled sync watch assets (foundation)
- Có command/task nền tảng cho đồng bộ watch assets.

### D-05 Sprint 13 core outcomes (đã hiện diện)
- Portfolio analytics nâng cao.
- Allocation by sector.
- Stock detail workspace nâng cấp.
- Admin ops stats/dashboard foundation.

> Nguồn tham chiếu trạng thái: `docs/ROADMAP_STATUS.md`, `docs/SPRINT_EXECUTION_LOG.md`, `docs/SPRINT13_ACCEPTANCE_CHECKLIST.md`.

---

## 4) P0 — Hardening gần hạn (ưu tiên cao)

### P0-1 Realtime reliability hardening
- Mục tiêu:
  - Ổn định reconnect/backoff, stale state, fallback behavior trong điều kiện runtime thực.
- DoD:
  - Có checklist vận hành và baseline metric cho reconnect/fallback/stale.

### P0-2 Aggregate whale feed hardening
- Mục tiêu:
  - Củng cố endpoint aggregate feed (cursor behavior, sorting stability, filter semantics).
- DoD:
  - Contract ổn định, tài liệu rõ filter/sort/cursor, có test edge-case bổ sung.

### P0-3 Ops observability & alerting baseline
- Mục tiêu:
  - Chuẩn hóa metric/log tối thiểu cho realtime + admin ops.
- DoD:
  - Có danh sách signal cảnh báo chính và runbook phản ứng sự cố mức cơ bản.

---

## 5) P1 — Product expansion gần hạn

### P1-1 Analytics mở rộng chiều sâu
- Mục tiêu:
  - Hoàn thiện các chỉ số còn thiếu/đang deferred (ví dụ HHI, VaR nhẹ, stress view tối thiểu).
- DoD:
  - API + UI + test + mô tả business meaning rõ ràng.

### P1-2 Stock workspace nâng cấp kỹ thuật
- Mục tiêu:
  - Mở rộng chart/insight panel và khả năng đọc tín hiệu theo symbol.
- DoD:
  - Trải nghiệm click-through nhất quán từ watchlist/dashboard/alerts.

### P1-3 Admin operations hardening
- Mục tiêu:
  - Tăng tính vận hành: trạng thái worker/task, retry flow, hạn mức và lỗi 429/5xx UX.
- DoD:
  - Có dashboard trạng thái + hành động vận hành cốt lõi + error UX chuẩn.

---

## 6) P2 — Nâng cấp nghiệp vụ trung hạn

### P2-1 Screener nâng cao
- RSI/MACD/MA cross/volume breakout và bộ lọc dựng sẵn.

### P2-2 Backtest strategy UI
- Chạy backtest và hiển thị report hiệu suất có giải thích.

### P2-3 Risk management pack
- Diversification/HHI nâng cao, VaR, stress scenarios.

---

## 7) P3 — Phụ thuộc ngoài hệ thống

### P3-1 News/events feed theo symbol
### P3-2 Brokerage integration
### P3-3 Order book/depth nâng cao theo vendor data
### P3-4 Social/community features

> Các mục P3 chỉ đưa vào sprint khi P0/P1 ổn định và đã có nguồn dữ liệu/đối tác rõ ràng.

---

## 8) Mapping backlog vào sprint (re-baseline)

- Sprint gần nhất đã chốt: tham chiếu `docs/ROADMAP_STATUS.md`.
- Sprint kế tiếp:
  - Ưu tiên P0 hardening trước.
  - Sau đó mới mở rộng P1 theo năng lực đội và rủi ro phụ thuộc.

---

## 9) Tiêu chí đưa item backlog vào sprint

1. Có owner rõ (BE/FE/QA/DevOps).
2. Có estimate theo task cụ thể.
3. Có đầu vào dữ liệu rõ và rủi ro phụ thuộc.
4. Có KPI đo được trên local/staging.
5. Không phá vỡ API contract hiện tại.
6. Có cập nhật docs đồng bộ (roadmap + execution log + checklist).
