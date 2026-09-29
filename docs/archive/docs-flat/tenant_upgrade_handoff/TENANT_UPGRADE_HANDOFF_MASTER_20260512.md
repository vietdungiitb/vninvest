# HANDOFF MASTER — SaaS Tenant Management Upgrade

**Ngày**: 2026-05-12
**Trạng thái**: READY FOR TEAM EXECUTION
**Phiên bản**: 1.0
**Workstream ID**: TENANT-UPGRADE

---

## 1. Mục tiêu bàn giao

Tài liệu này là master coordination cho chương trình nâng cấp hệ thống quản lý khách thuê (Tenant Management) từ trạng thái skeleton-model lên **SaaS-grade enforcement đầy đủ** theo thông lệ quốc tế.

Hệ thống hiện tại đã có nền data model đúng hướng (`CoreTenant`, `Subscription`, `QuotaRecord`) nhưng tất cả lớp enforcement thực — quota, billing, lifecycle automation, per-request guard — đều là stub hoặc không tồn tại. Chương trình này giải quyết 9 gap đã được audit xác nhận.

### Kết quả cuối bắt buộc

1. **Single SSOT `CoreTenant`**: không còn class `CoreTenant` nào trong `backend/portfolio/models.py`; `backend/core_pat_auth.py` không còn raw SQL tenant queries.
2. **Per-request entitlement guard**: tenant `suspended`/`deprovisioned` bị block ngay khi request — không cần logout/login lại.
3. **Quota enforcement thực**: API calls được đếm theo tenant qua Redis, trả `429` khi vượt `api_calls_limit`.
4. **Invoice automation**: `Invoice` được tạo tự động hàng tháng; tenant quá hạn bị suspend tự động sau 7 ngày.
5. **Trial lifecycle automation**: trial hết hạn → tự động suspend; quota overflow → tự động suspend; có cảnh báo D-7/D-1.
6. **Operator write API**: admin có thể suspend/activate/upgrade plan tenant qua REST API.
7. **Self-service onboarding**: user đăng ký → CoreTenant trial được khởi tạo tự động.
8. **Multi-member per tenant**: `TenantMember` + `TenantInvite` cho phép nhiều user trong một tổ chức.
9. **Immutable audit trail**: mọi thay đổi trạng thái tenant được log vào `TenantLifecycleEvent`.

---

## 2. Bộ tài liệu trong gói này

### 2.1 Triad bắt buộc

1. `docs/IMPLEMENTATION_PLAN_TENANT_UPGRADE_20260512.md`
2. `docs/TECH_SPEC_TENANT_UPGRADE_20260512.md`
3. `docs/TASKBOARD_TENANT_UPGRADE_20260512.md`

### 2.2 Tài liệu bàn giao, audit và thực thi

1. `docs/TENANT_UPGRADE_HANDOFF_MASTER_20260512.md` ← file này
2. `docs/TENANT_UPGRADE_TRACEABILITY_MATRIX_20260512.md`
3. `docs/TENANT_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260512.md`
4. `docs/TENANT_UPGRADE_EXECUTION_EVIDENCE_TEMPLATE_20260512.md`
5. `docs/TENANT_UPGRADE_CONFIG_OWNERSHIP_MATRIX_20260512.md`
6. `docs/TENANT_UPGRADE_CODE_QUALITY_CONSTITUTION_20260512.md`

### 2.3 Repo rulebook phải tuân thủ

1. `AGENTS.md` — hard constraints toàn project
2. `quality/QUALITY.md` — quality standards

---

## 3. Audit input — 9 gap đã xác nhận

| Gap ID | Mô tả | Severity |
|---|---|---|
| G1 | Dual `CoreTenant`: legacy `backend/portfolio/models.py` + canonical `packages/core` | 🔴 P0 |
| G2 | Entitlement chỉ check lúc login — không per-request guard | 🔴 P0 |
| G3 | Commercial layer là stub — quota/billing không enforce | 🔴 P1 |
| G4 | Lifecycle tự động không tồn tại | 🟠 P1 |
| G5 | Operator API chỉ đọc — không có write/action endpoints | 🟠 P1 |
| G6 | Không có self-service onboarding | 🟡 P2 |
| G7 | 1 owner = 1 tenant — không có multi-member | 🟡 P2 |
| G8 | User-owned data không được isolate theo tenant | 🟡 P2 |
| G9 | Audit trail lifecycle thiếu | 🟢 P3 |

---

## 4. Ràng buộc kiến trúc bắt buộc

1. **SSOT `CoreTenant`**: chỉ được import từ `identity_access.models` — không tái định nghĩa.
2. **No parallel writers**: `TenantLifecycleEvent` là single writer cho mọi state transition.
3. **Quota middleware phải exempt**: `/health`, `/api/core/v1/auth/`, `/api/public/` không bị quota check.
4. **Redis atomic**: quota counter phải dùng Redis `INCR` (atomic) — không dùng DB write trực tiếp trong request path.
5. **`IsTenantActive` không block superuser**: `user.is_superuser=True` bypass tenant status check.
6. **Migration additive**: tất cả migration là additive — không drop column, không rename column mà không có migration backward.
7. **Isolation rule trong `packages/core`**: không import từ `backend.portfolio` hoặc `backend.*`.

---

## 5. Thứ tự thực hiện bắt buộc

```
Phase 1 (P0) — Tuần 1, Ngày 1-3:
  T01: Hợp nhất SSOT CoreTenant (xoá dual model)
  T02: Refactor core_pat_auth.py (xoá raw SQL)
  T03: IsTenantActive permission class (per-request guard)

Phase 2 (P1) — Tuần 1-2:
  T04: TenantQuotaMiddleware + Redis metering
  T05: Celery tasks billing (Invoice + flush quota + overdue check)
  T06: Django app tenant_lifecycle + automation tasks

Phase 3 (P1) — Tuần 2:
  T07: Operator write API (suspend/activate/change-plan)

Phase 4 (P2) — Tuần 3:
  T08: Self-service onboarding endpoint + trial activation
  T09: TenantMember + TenantInvite (multi-member)

Phase 5 (P2-P3) — Tuần 3-4:
  T10: Data isolation audit + FK migration
  T11: TenantLifecycleEvent signals + audit trail endpoint
```

**Không được đảo thứ tự T01 → T02 → T03**: các task sau phụ thuộc vào SSOT sạch.

---

## 6. Điều kiện DONE toàn workstream

| Gate | Command / Check | Điều kiện PASS |
|---|---|---|
| V1 | `python manage.py check` | 0 errors, 0 warnings |
| V2 | `python manage.py test identity_access --keepdb` | 100% PASS |
| V3 | `python manage.py test commercial.tests --keepdb` | 100% PASS |
| V4 | `python manage.py test tenant_lifecycle.tests --keepdb` | 100% PASS |
| V5 | `grep -r "class CoreTenant" backend/portfolio/` | 0 kết quả |
| V6 | `grep "identity_access_coretenant" backend/core_pat_auth.py` | 0 kết quả |
| V7 | PAT auth smoke: `status=suspended` → `403` | Thủ công |
| V8 | Quota smoke: 101 requests / limit=100 → `429` | Automated |
| V9 | Trial auto-expire: `trial_ends_at = yesterday` → `suspended` | Automated |
| V10 | `docker compose -f docker-compose.dev.yml up -d --build backend` | Containers healthy |

---

## 7. Governance obligations mỗi slice

Trước khi đánh dấu DONE một slice:

1. Điền đầy đủ `docs/TENANT_UPGRADE_EXECUTION_EVIDENCE_TEMPLATE_20260512.md` cho slice đó
2. Cập nhật `docs/TASKBOARD_TENANT_UPGRADE_20260512.md` (status → DONE)
3. Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` (entry mới)
4. Cập nhật `PROGRESS_DASHBOARD.md`
5. Regenerate `module_tree_full.md` nếu có app mới hoặc model mới
6. Commit riêng per slice: `TENANT-T0X: <mô tả ngắn>`
7. Push ngay `origin/dev`

---

## 8. Điểm liên lạc và escalation

- Mọi ambiguity về scope → dừng, ghi issue vào `docs/TASKBOARD_TENANT_UPGRADE_20260512.md` cột Notes
- Mọi conflict với `AGENTS.md` hard constraints → escalate ngay, không workaround
- Không mở rộng scope ngoài 11 slices đã định nghĩa trong workstream này

---

## 9. Tài liệu nền cần đọc trước khi code

1. `AGENTS.md` — đặc biệt mục 3 (Hard constraints for SaaS Migration) và mục 8-9
2. `quality/QUALITY.md`
3. `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md` — hiểu context migration đang chạy song song
4. `docs/TENANT_UPGRADE_TECH_SPEC_20260512.md` — spec kỹ thuật chi tiết cho từng slice
5. Đọc file nguồn hiện tại trước khi sửa:
   - `packages/core/backend/src/identity_access/models.py`
   - `packages/core/backend/src/identity_access/permissions.py`
   - `packages/core/backend/src/commercial/models.py`
   - `backend/core_pat_auth.py`
   - `backend/portfolio/models.py` (lines 1140–1250)
