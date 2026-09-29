# Sprint 26 - Day 1 Execution Log (2026-04-07)

## Status
- Sprint: 26 (OpenCore License & Billing)
- Day: 1
- Overall: IN PROGRESS
- Objective hôm nay: Kickoff execution + baseline integration audit

## Done Today
- [x] Xác nhận OpenCore foundation đã có trong backend (models, API, admin, celery tasks).
- [x] Xác nhận route `/api/opencore/*` đã mount qua router.
- [x] Xác định endpoint business ưu tiên cho feature gating trong stock workspace.
- [x] Cập nhật trạng thái Sprint26 trong roadmap sang IN PROGRESS.
- [x] Đồng bộ tài liệu Open Core discussion theo trạng thái Day 1.

## In Progress
- [ ] Lên danh sách endpoint ưu tiên theo mức rủi ro quota/cost.
- [ ] Chốt mapping feature key cho từng endpoint cần `@require_feature()`.

## Risks / Blockers
- Risk 1: Mismatch giữa feature key business và feature key indicator có thể gây deny sai.
- Risk 2: User cũ có thể chưa có license record nếu chưa được backfill.
- Risk 3: Gating có thể làm fail test cũ nếu chưa có test data theo tier.

## Plan Day 2
1. Hook gating cho 2-3 endpoint ưu tiên (order-flow + whale advisory path).
2. Viết test matrix free/pro/enterprise cho endpoint đã hook.
3. Thêm checklist verify trial/grace/quota behavior.

## Deliverable Checkpoint
- Expected by end Day 2:
  - Endpoint gating đầu tiên chạy pass.
  - Test matrix cơ bản pass.
  - No regression trên auth + permission hiện có.
