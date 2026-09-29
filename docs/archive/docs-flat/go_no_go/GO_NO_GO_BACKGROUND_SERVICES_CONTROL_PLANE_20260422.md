# GO / NO-GO CHECKLIST: Background Services Control Plane

**Ngày tạo**: 2026-04-22  
**Mục tiêu**: Checklist readiness trước khi team code bắt đầu implementation.

---

## 1. Scope Gate

- [x] Danh sách pilot services đã được chốt.
- [x] Out-of-scope đã được chốt rõ.
- [x] Không có yêu cầu “làm luôn toàn bộ mọi service” trong phase đầu.

## 2. Architecture Gate

- [x] Chốt dùng Django + Celery + Redis + Beat.
- [x] Chốt run ledger là nguồn sự thật cho điều hành service.
- [x] Chốt lease/heartbeat/idempotency contract.

## 3. Data Safety Gate

- [x] Mỗi pilot service có write mode mặc định.
- [x] `force_overwrite` có approval rule.
- [x] `reconcile` có preview/dry-run rule.

## 4. API Gate

- [x] Prefix API `/api/v1/admin-ops/` (đã đổi thành `/api/v1/admin/crawl/` theo implementation phase 0) đã được chốt.
- [x] Error contract đã được chốt.
- [x] Idempotency scope đã được chốt.

## 5. Ops Gate

- [x] Threshold stalled per service type đã được chốt.
- [x] Alert recipients đã được chốt.
- [x] Release metadata (`release_sha`, `image_tag`) có đường inject runtime rõ ràng.

## 6. Team Gate

- [x] Owner backend đã được chỉ định (đã thực thi).
- [x] Owner frontend/admin UI đã được chỉ định (đã thực thi).
- [x] Reviewer kiến trúc đã được chỉ định.
- [x] Người chịu trách nhiệm canary/rollback đã được chỉ định.

## 7. Documentation Gate

- [x] Proposal đã cập nhật đầy đủ.
- [x] Implementation Plan đã có.
- [x] Tech Spec đã có.
- [x] Taskboard đã có.
- [x] Walkthrough/Handoff đã có.
- [x] Runbook đã có.

## 8. Decision

### GO: APPROVED (Phase 0 Scope Only - 2026-04-22)
**Lý do:** Tất cả các luồng back-end pilot cho `stock_profile_sync`, `whale_advisory_auto`, `market_snapshot` và front-end React interface (AdminCrawlControl) đã được audit kỹ lưỡng và triển khai an toàn đúng như thiết kế. Chú ý: Quyết định GO này chỉ áp dụng ranh giới Phase 0. Để xác nhận GO toàn hệ thống, yêu cầu full suite regression tests pass 100%.