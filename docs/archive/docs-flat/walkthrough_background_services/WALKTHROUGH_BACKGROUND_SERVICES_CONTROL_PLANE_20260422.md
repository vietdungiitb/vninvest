# WALKTHROUGH / HANDOFF: Background Services Control Plane

**Ngày tạo**: 2026-04-22  
**Mục tiêu**: Bàn giao đầy đủ hồ sơ thiết kế và execution pack cho team code trước khi bắt đầu implementation.

---

## 1. Bộ tài liệu bàn giao

Team code phải đọc theo thứ tự sau:
1. `docs/crawling_control_center_proposal.md`
2. `docs/IMPLEMENTATION_PLAN_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
3. `docs/TECH_SPEC_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
4. `docs/TASKBOARD_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
5. `docs/RUNBOOK_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
6. `docs/GO_NO_GO_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md`
7. `docs/PILOT_SERVICE_SELECTION_BACKGROUND_CONTROL_PLANE_20260422.md`
8. `docs/CODING_KICKOFF_PHASE0_PHASE1_BACKGROUND_CONTROL_PLANE_20260422.md`

---

## 2. Quyết định kiến trúc đã khóa

1. Không dùng scheduler song song mới; chỉ dùng Django + Celery + Redis + Beat hiện hữu.
2. Tất cả service nền quan trọng phải đi qua service registry và run ledger.
3. Lock theo `service_code + scope_hash` là bắt buộc.
4. Mọi run mutation phải có `write_mode` rõ ràng.
5. Mọi run phải ghi metadata version: `release_sha`, `image_tag`, `worker_hostname`.
6. API điều hành dùng prefix `/api/v1/admin-ops/`.

---

## 3. Danh sách pilot services đề xuất cho implementation đầu

1. `intraday_side_backfill`
2. `stock_profile_sync`
3. Một prefetch job đại diện

Lý do:
1. Bao phủ đủ 3 kiểu hành vi: mutation/backfill, sync định kỳ, prefetch runtime.
2. Rủi ro thực tế đã thấy trong hệ thống, dễ tạo giá trị nhanh.

---

## 4. Những điểm team code không nên thay đổi nếu chưa review lại

1. Không đổi state machine chuẩn đã chốt.
2. Không bỏ write mode chỉ để “code nhanh hơn”.
3. Không để task pilot chạy mà thiếu heartbeat.
4. Không hardcode role mới tách rời `permissions.py` hiện tại.
5. Không tạo thêm bảng log rời rạc ngoài run ledger trừ khi có lý do rõ.

---

## 5. Điểm cần chốt sớm trong kickoff coding

1. Mapping role thật sự: admin/operator/viewer.
2. Danh sách allowlist pilot services phase đầu.
3. Threshold stalled mặc định cho từng nhóm service.
4. Write mode mặc định cho từng pilot service.
5. Cách inject `release_sha` và `image_tag` vào runtime hiện tại.

---

## 6. Đề xuất cách chia PR để giảm rủi ro

1. PR1: schema + registry + Redis helper.
2. PR2: API layer + serializers + audit trail.
3. PR3: pilot integration for `intraday_side_backfill`.
4. PR4: pilot integration for sync/prefetch.
5. PR5: frontend control UI.
6. PR6: hardening + alerting + docs refresh.

---

## 7. Checklist handoff cho team code

1. Đã có triad bắt buộc.
2. Đã có walkthrough/handoff file vật lý.
3. Đã có runbook mục tiêu.
4. Đã có go/no-go checklist trước coding.
5. Đã có taskboard phase-by-phase.
6. Đã có proposal nền tảng để giải thích bối cảnh và lý do business.

---

## 8. Exit condition của giai đoạn tài liệu

Giai đoạn tài liệu được xem là hoàn tất khi:
1. Team code có thể bắt đầu Phase 0 mà không cần hỏi lại kiến trúc lõi.
2. Mọi quyết định còn mở chỉ còn là cấu hình/policy, không còn mơ hồ về kiến trúc tổng thể.
3. Danh mục tài liệu đã được báo cáo rõ cho PM/lead.