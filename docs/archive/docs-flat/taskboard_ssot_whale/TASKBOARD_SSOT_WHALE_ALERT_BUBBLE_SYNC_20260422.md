# TASKBOARD: SSOT Whale Alert - Bubble Sync

**Ngày**: 2026-04-22  
**Mục tiêu**: Đưa alert và bubble chart về cùng một nguồn dữ liệu SSOT, triển khai ngay theo slices.

---

## A. Workstream Backend

- [ ] `BE-01` Chốt contract `WhaleEvent` canonical trong service layer  
Owner: Backend Lead  
Estimate: 2h  
DoD: Có schema + unit test normalize pass

- [ ] `BE-02` Tạo `get_whale_events_by_symbol()` trong market data service  
Owner: Backend Lead  
Estimate: 6h  
Dependency: BE-01  
DoD: Trả payload chuẩn + summary + quality flags

- [ ] `BE-03` Refactor whale feed endpoint dùng canonical service  
Owner: Backend Dev  
Estimate: 3h  
Dependency: BE-02  
DoD: Endpoint cũ vẫn chạy, source metadata chuẩn

- [ ] `BE-04` Refactor whale orders endpoint dùng canonical service  
Owner: Backend Dev  
Estimate: 4h  
Dependency: BE-02  
DoD: Không còn query path riêng gây lệch dữ liệu

- [ ] `BE-05` Triển khai degraded-mode payload khi thiếu ref_price  
Owner: Backend Dev  
Estimate: 2h  
Dependency: BE-04  
DoD: Có `degraded_mode=true` và lý do rõ

- [ ] `BE-06` Bổ sung metric hooks parity/degraded  
Owner: Backend Lead  
Estimate: 3h  
Dependency: BE-03, BE-04  
DoD: Có 4 metrics theo tech spec

---

## B. Workstream Frontend

- [ ] `FE-01` Cập nhật parser dữ liệu bubble chart theo contract mới  
Owner: Frontend Lead  
Estimate: 3h  
Dependency: BE-04  
DoD: Chart đọc đúng event payload canonical

- [ ] `FE-02` Bổ sung banner fallback khi degraded mode  
Owner: Frontend Dev  
Estimate: 2h  
Dependency: FE-01  
DoD: Banner hiển thị rõ lý do degraded

- [ ] `FE-03` Sửa empty-state rule để không báo sai semantics  
Owner: Frontend Dev  
Estimate: 2h  
Dependency: FE-01  
DoD: Chỉ empty khi event_count = 0

- [ ] `FE-04` Cập nhật i18n tiếng Việt cho thông điệp mới  
Owner: Frontend Dev  
Estimate: 1h  
Dependency: FE-02  
DoD: Đủ key i18n và hiển thị có dấu

---

## C. Workstream QA/Test

- [ ] `QA-01` Viết test parity stream-only case  
Owner: QA Engineer  
Estimate: 2h  
Dependency: BE-04  
DoD: Alert và bubble parity event count

- [ ] `QA-02` Viết test parity db-only case  
Owner: QA Engineer  
Estimate: 2h  
Dependency: BE-04  
DoD: Pass với nguồn DB

- [ ] `QA-03` Viết test missing ref_price fallback  
Owner: QA Engineer  
Estimate: 2h  
Dependency: BE-05, FE-02  
DoD: Bubble không rỗng, có banner degraded

- [ ] `QA-04` Viết test mixed price units  
Owner: QA Engineer  
Estimate: 2h  
Dependency: BE-02  
DoD: Không có lỗi x1000

- [ ] `QA-05` UAT matrix timeframe 15m/30m/1h/session  
Owner: QA Lead  
Estimate: 2h  
Dependency: FE-03  
DoD: 4/4 timeframe parity

---

## D. Rollout and Ops

- [ ] `OPS-01` Cấu hình feature flag rollout canary 10%  
Owner: DevOps  
Estimate: 1h  
Dependency: BE-06, FE-04  
DoD: Có bật/tắt nhanh qua config

- [ ] `OPS-02` Thiết lập alert rules cho metrics mới  
Owner: DevOps  
Estimate: 1h  
Dependency: OPS-01  
DoD: Alert hoạt động trên staging

- [ ] `OPS-03` Canary 24h và quyết định promote 100%  
Owner: DevOps + Project Lead  
Estimate: 1 ngày quan sát  
Dependency: OPS-02  
DoD: Không có parity delta kéo dài

---

## E. Delivery Gate

- [ ] Gate-1: Tất cả tasks BE/FE/QA hoàn tất.
- [ ] Gate-2: Không còn case "alert có, bubble rỗng" trong test matrix.
- [ ] Gate-3: Feature flag rollback test pass.
- [ ] Gate-4: Audit ledger + progress dashboard được cập nhật.

---

## F. Ưu tiên thực thi (Run Order)

1. BE-01 -> BE-02 -> BE-03 + BE-04 -> BE-05 -> BE-06
2. FE-01 -> FE-03 + FE-02 -> FE-04
3. QA-01..QA-05
4. OPS-01..OPS-03

---

## G. Mốc thời gian đề xuất

- Day 1: BE-01..BE-04
- Day 2: BE-05..BE-06 + FE-01..FE-03
- Day 3: FE-04 + QA-01..QA-05
- Day 4: OPS rollout + canary decision
