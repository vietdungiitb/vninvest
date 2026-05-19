# Self Audit and Test Protocol — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19

---

## 1. Mục tiêu audit

Đảm bảo workstream backfill:
1. Đúng SSOT global market data.
2. Đúng scheduler truth và progress truth.
3. Đúng planner priority theo coverage gap.
4. Đúng OpenAPI governance cho operator surfaces.
5. Đủ evidence để rollout và rollback.

---

## 2. Checklist bắt buộc

### A. Scheduler truth
- [ ] `run_now` accepted không bị diễn giải thành `success`
- [ ] inflight cache không treo sau terminal state
- [ ] backfill jobs có history đúng

### B. Planner semantics
- [ ] `missing_only=true` mặc định
- [ ] planner trả `priority_reason`
- [ ] symbol hot gap nặng đứng trước symbol đã đủ coverage

### C. Fast-path and modes
- [ ] newly promoted symbols tạo repair obligation
- [ ] `targeted_symbol_repair` chạy được cho một symbol
- [ ] `repair_missing` không full-refresh mù quáng

### D. Observability
- [ ] progress API có counters/ETA/current batch
- [ ] DataOps hiển thị critical gap và anomaly backlog
- [ ] operator không cần đọc docker logs để biết trạng thái task

### E. OpenAPI and SaaS governance
- [ ] endpoints có schema và error envelope đúng chuẩn
- [ ] list/history endpoint có pagination
- [ ] frontend không direct fetch ngoài adapter/API chuẩn

### F. Governance
- [ ] ledger/progress/modified-files docs cập nhật
- [ ] evidence template điền đủ
- [ ] runtime refresh bằng `./start_dev.ps1` nếu có runtime/code slice

---

## 3. Test categories bắt buộc

1. `service_ops` scheduler action/history/progress tests
2. `market_data` planner/coverage tests
3. `data_ingest` backfill mode/task tests
4. DataOps API contract tests
5. Frontend SOC SchedulerBoard/DataOps tests
6. Runtime smoke checks

---

## 4. Block merge conditions

1. UI vẫn có thể báo `ĐANG CHẠY` vô hạn do inflight cache treo.
2. Planner vẫn ưu tiên alphabet thay vì coverage gap.
3. Không có targeted repair mode.
4. Hot tier coverage anomaly không nhìn thấy trên DataOps.
5. Endpoint mới/chỉnh sửa thiếu OpenAPI schema hoặc error envelope chuẩn.
6. Chuyển sang slice tiếp theo khi chưa pass slice-exit gate.
