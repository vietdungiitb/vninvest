# IMPLEMENTATION PLAN — SaaS Services Recovery

**Ngày**: 2026-05-11  
**Owner**: Backend Lead + DevOps Lead  
**Trạng thái**: READY FOR EXECUTION

---

## 1. Business Objective

Khôi phục full SaaS runtime để:
1. Chấm dứt trạng thái partial-up (service lên nhưng dependency chết).
2. Khôi phục đầy đủ background services và scheduler reliability.
3. Đảm bảo đường chạy chính qua core services theo kiến trúc mới.

KPI mục tiêu:
1. Core runtime startup success rate: 100% trong 3 lần deploy liên tiếp.
2. Queue stalled incidents: 0 trong 24h soak.
3. API health pass liên tục: >= 99.5% trong cửa sổ soak.
4. Recovery MTTR: <= 2 giờ cho sự cố tầng nền (DB/Redis).

---

## 2. Scope

In-scope:
1. Compose/runtime recovery cho dev + production path.
2. Worker/beat recovery, queue verification, scheduler verification.
3. Endpoint health + smoke tests + evidence pipeline.

Out-of-scope:
1. Phát triển tính năng mới.
2. Thay đổi schema/domain lớn ngoài yêu cầu recovery.

---

## 3. Current-State Assessment

Vấn đề chính:
1. Có thời điểm `core-api` ở `health: starting` kéo dài.
2. `db`/`redis` có thể bị exited dẫn tới cascade lỗi runtime.
3. Vẫn tồn tại hybrid runtime path cần gate rõ trước khi khai báo SaaS-only.

Rủi ro kỹ thuật:
1. Drift cấu hình giữa compose files.
2. Queue duplication nếu legacy và core chạy song song không kiểm soát.
3. Missing env bắt buộc trong lệnh compose/config check.

---

## 4. Execution Phases

## R0 — Stabilization Gate (30-60 phút)

Mục tiêu:
1. Freeze thay đổi runtime không liên quan.
2. Chụp snapshot hiện trạng container/env/compose.

Tasks:
1. Xác nhận compose files mục tiêu.
2. Thu thập `docker ps`, `docker compose ps`, health status.
3. Ghi risk register ban đầu.

Exit criteria:
1. Snapshot trạng thái hoàn chỉnh.
2. Danh sách missing env đã rõ ràng.

---

## R1 — Data Plane Recovery (60-120 phút)

Mục tiêu:
1. Đưa `db` và `redis` về healthy trước.

Tasks:
1. Start/restart data services.
2. Kiểm tra healthcheck và connection từ core-api.
3. Xác nhận volume mount và quyền ghi.

Exit criteria:
1. DB healthy.
2. Redis healthy.
3. Không có restart loop 10 phút liên tục.

---

## R2 — Core Runtime Recovery (60-120 phút)

Mục tiêu:
1. Core runtime chạy đầy đủ và stable.

Tasks:
1. Start `core-api`.
2. Start `core-worker`, `core-beat`.
3. Run migrations/check cơ bản.
4. Start `frontend` sau khi `core-api` healthy.

Exit criteria:
1. `core-api` health pass.
2. Worker/beat log không có lỗi broker/db.
3. Frontend call path qua core API hoạt động.

---

## R3 — Background Services Recovery (2-4 giờ)

Mục tiêu:
1. Xác thực scheduler và async tasks trọng yếu.

Tasks:
1. Verify beat schedule dispatch.
2. Verify worker consumption và completion.
3. Verify queue depth không tăng bất thường.
4. Smoke test các jobs trọng yếu theo domain.

Exit criteria:
1. Không còn lỗi `unregistered task`.
2. Không còn lỗi kết nối `localhost redis/db` sai trong container.
3. Task completion ổn định trong ít nhất 3 chu kỳ lịch.

---

## R4 — SaaS-Only Runtime Gate (2-8 giờ)

Mục tiêu:
1. Đảm bảo runtime path chính không phụ thuộc legacy.

Tasks:
1. Khóa traffic path vào core entry point.
2. Ngăn chạy song song legacy background jobs trên path chính.
3. Chạy parity/checklist trước khi tắt hẳn đường legacy còn lại.

Exit criteria:
1. Core là primary runtime path.
2. Không có duplicate background processing.
3. Có rollback plan sẵn sàng.

---

## R5 — Soak & Hardening (24-72h)

Mục tiêu:
1. Chứng minh hệ thống ổn định trong điều kiện vận hành thực tế.

Tasks:
1. Theo dõi metrics: availability, latency, queue depth, failure rate.
2. Theo dõi alerts: stalled, drift, retry spike.
3. Tinh chỉnh resource limits nếu cần.

Exit criteria:
1. Không có incident P1/P0.
2. SLO đạt ngưỡng.
3. Không có service restart bất thường.

---

## R6 — Sign-off & Handover

Mục tiêu:
1. Khóa vòng bàn giao với evidence đầy đủ.

Tasks:
1. Cập nhật taskboard trạng thái cuối.
2. Hoàn tất evidence cho từng slice.
3. Cập nhật audit ledger + progress dashboard.
4. Tổ chức sign-off theo protocol.

Exit criteria:
1. Toàn bộ tài liệu đã hoàn chỉnh.
2. Sign-off của Tech Lead, DevOps Lead, QA Lead.

---

## 5. Validation Matrix (rút gọn)

1. Runtime health:
   - `/core/v1/health`
   - `/api/health/`
2. Queue/Scheduler:
   - worker logs
   - beat logs
   - queue depth
3. Domain smoke:
   - realtime ticker
   - whale/unified alerts
   - portfolio/watchlist core paths

---

## 6. Rollback Strategy

1. Điều kiện kích hoạt rollback:
   - API error rate vượt ngưỡng 10 phút.
   - Queue backlog tăng liên tục không hồi phục.
   - Core runtime health fail kéo dài.
2. Rollback steps:
   - Dừng rollout hiện tại.
   - Khôi phục compose/env snapshot ổn định gần nhất.
   - Restart theo thứ tự data plane -> runtime.
   - Xác nhận health + smoke.
3. Bắt buộc ghi evidence rollback.

---

## 7. Delivery Discipline

1. Mỗi slice có owner rõ ràng, estimate rõ ràng, DoD rõ ràng.
2. Không merge khi chưa có kết quả integration test liên quan.
3. Không đánh dấu DONE khi thiếu evidence template.
4. Bắt buộc cập nhật:
   - `docs/CODE_CHANGE_AUDIT_LEDGER.md`
   - `PROGRESS_DASHBOARD.md`
