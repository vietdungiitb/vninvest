# Self Audit and Test Protocol — Global Market Data Matrix SSOT
**Ngày**: 2026-05-15

---

## 1. Mục tiêu audit

Đảm bảo mọi implementation của chương trình này giữ đúng các invariants SSOT, đặc biệt là:

- không tạo data silo theo user
- không duplicate crawl cho cùng symbol/range
- không để planner full-scan khi coverage đã đủ
- không để read path recrawl dữ liệu đã có trong shared global layer

---

## 2. Checklist self-audit bắt buộc

### A. Registry correctness
- [ ] Một symbol chỉ có một canonical registry row
- [ ] Demand source tách riêng khỏi registry row
- [ ] Coverage tách riêng khỏi run-state

### B. Demand semantics
- [ ] Watchlist add chỉ promote demand, không fetch trực tiếp theo user path
- [ ] Tracked symbol add chỉ promote demand, không mở silo data path
- [ ] Holding change chỉ promote demand, không làm duplicate queue item
- [ ] Alert create/delete chỉ tác động demand edge tương ứng

### C. Planner semantics
- [ ] Default policy là `missing-only`
- [ ] `force_refresh` cần explicit override và audit trail
- [ ] Có bằng chứng `skipped_existing`/`coverage_ok`

### D. Read path semantics
- [ ] Watchlist không recrawl riêng theo user
- [ ] Dashboard không recrawl riêng theo user
- [ ] Stock detail không recrawl riêng vì user mở màn hình
- [ ] AI/alerts đọc từ global layer

### E. Operator surface
- [ ] SOC Data Ops có coverage summary
- [ ] SOC Data Ops có queue tier visibility
- [ ] SOC Data Ops có run-log/audit visibility

---

## 3. Test categories bắt buộc

1. Model tests cho registry/demand/coverage constraints
2. Event-flow tests cho watchlist/tracked/holding/alert promotion
3. Planner tests cho `missing-only`, `force_refresh`, `repair`
4. Queue dedup tests khi nhiều user cùng demand một symbol
5. Read-path tests chứng minh không có direct provider crawl ở primary user path
6. Decay-window tests chứng minh symbol không bị drop ngay khi một user remove source

---

## 4. Fail conditions

Block merge nếu phát hiện một trong các dấu hiệu sau:

- logic universe truth nằm rải rác ở nhiều module thay vì global registry
- user-facing path tự fetch provider dữ liệu đã có trong shared layer
- planner không chứng minh được coverage-gap semantics
- `ScrapeMatrix` hoặc run-log bị dùng làm universe SSOT
