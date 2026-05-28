# Implementation Plan — Project Hardening Backend
**Ngày**: 2026-05-28  
**Status**: Approved — Ready for execution  
**Parent**: docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md

---

## 1. Tổng quan

Kế hoạch chia làm 4 cụm chính:
1. Baseline & bootstrap an toàn cho execution.
2. Hardening bắt buộc của Giai đoạn 1.
3. QG-1 closeout với evidence thật.
4. Greenfield workstreams của Giai đoạn 2.

---

## 2. Dependency graph

```text
PH00 doc-pack lock
  -> PH01 core-env bootstrap + QG baseline
    -> PH02 orphan audit + quarantine contract
      -> PH03 tenant NOT NULL migration on 6 entities
        -> PH04 legacy DB/container shutdown execution gate
          -> PH05 app-level throttle audit + gateway throttle
            -> PH06 backend fat-file refactor
              -> PH07 packages/web fat-file refactor + packaging proof
                -> PH08 QG-1 closeout
                  -> PH09 VNPay/IPN foundation
                    -> PH10 outbound notification pipeline
                      -> PH11 AI advisory cost control
```

---

## 3. Task breakdown

| Task ID | Tên | Artifact chính | DoD |
|---|---|---|---|
| PH00 | Doc-pack lock | docs/detailed_designs/* | 12 tài liệu đầy đủ, cross-reference sạch |
| PH01 | Core backend env bootstrap | `packages/core/backend/manage.py`, runbooks | Test gate có prerequisite rõ ràng, không ambiguous env |
| PH02 | Pre-migration orphan audit | quarantine script + SQL audit notes | Quét đủ 6 bảng, reject migration nếu còn orphan |
| PH03 | Tenant `NOT NULL` migration | `user_workspace` migrations + tests | 6 tenant FK mục tiêu không còn nullable |
| PH04 | Legacy DB/container shutdown gate | ops checklist + compose audit | Chỉ được đóng legacy path khi data cutover evidence đạt |
| PH05 | Rate limiting hardening | auth views audit + nginx conf | App throttling giữ đúng, gateway throttle bổ sung |
| PH06 | Backend fat-file refactor | `views_auth.py`, `dataops.py` | File target dưới ngưỡng và tách trách nhiệm rõ |
| PH07 | Web fat-file refactor | `coreApiAdapter.js`, `AlertCenterPage.js` | Refactor xong, `build-community` pass |
| PH08 | QG-1 closeout | evidence + taskboard + ledger | Giai đoạn 1 có evidence executable, không còn blocker mơ hồ |
| PH09 | VNPay/IPN foundation | `commercial` extensions | PaymentTransaction + VNPayIPNLog + IPN workflow ready |
| PH10 | Outbound notification pipeline | `signal_intelligence` + provider config | Email/FCM/WebPush delivery path có contract và delivery truth |
| PH11 | AI cost control | advisory/runtime config | Quota, semantic cache, router failover có gate rõ |

---

## 4. Chi tiết task

### PH00 — Doc-pack lock

**Mục tiêu**
- Biến action plan thành pack có thể giao việc được.

**Definition of Done**
- Đủ 12/12 docs trong `docs/detailed_designs/`.
- Mọi file dùng cùng date stamp `20260528`.
- Handoff master, plan, spec, taskboard, traceability, self-audit và runbooks cross-reference đúng.

### PH01 — Core backend env bootstrap

**Mục tiêu**
- Loại bỏ ambiguity khi chạy core backend test gate.

**Files dự kiến**
- `packages/core/backend/manage.py`
- `packages/core/backend/requirements.txt`
- `docs/detailed_designs/PROJECT_HARDENING_ACTION_PLAN_20260528.md`
- `docs/detailed_designs/RUN_INTEGRATION_TESTS_PROJECT_HARDENING_BACKEND_20260528.md`

**Definition of Done**
- Có command bootstrap dependency rõ ràng.
- Có environment variables tối thiểu rõ ràng.
- Có note về private dependencies và `VNBROKER_GITHUB_TOKEN`.

### PH02 — Pre-migration orphan audit + quarantine

**Mục tiêu**
- Không cho migration chạm tenant FK khi dữ liệu source chưa sạch.

**Files dự kiến**
- `packages/core/backend/src/user_workspace/models.py`
- migration/audit script mới trong `packages/core/backend/src/user_workspace/` hoặc `service_ops/`

**Definition of Done**
- Script quét đủ `Portfolio`, `Transaction`, `Watchlist`, `TrackedSymbol`, `PriceAlert`, `SubAccount`.
- Có output cohort theo bảng + số bản ghi + khóa chính.
- Có bảng hoặc artifact quarantine riêng, không overwrite dữ liệu gốc.

### PH03 — Tenant `NOT NULL` migration

**Mục tiêu**
- Siết tenant isolation đúng thực trạng codebase.

**Definition of Done**
- 6 tenant FK mục tiêu không còn nullable.
- Regression tests chặn cross-tenant access vẫn pass.
- Không làm hỏng fields nullable khác không thuộc scope migration.

### PH04 — Legacy DB/container shutdown gate

**Mục tiêu**
- Chỉ shutdown legacy containers khi đã có evidence cutover cho nhánh này.

**Definition of Done**
- Có compose/service audit cho `vninvest-backend` và `vninvest-db`.
- Có checklist rollback và snapshot path.
- Không tuyên bố decommission sớm hơn roadmap tổng thể.

### PH05 — Rate limiting hardening

**Mục tiêu**
- Giữ app-level throttling đúng, bổ sung gateway-level guard còn thiếu.

**Files dự kiến**
- `packages/core/backend/src/identity_access/views_auth.py`
- `packages/core/backend/src/vninvest_core/tests/test_rate_limiting.py`
- `frontend/docker/nginx.conf`
- `packages/opencore/distribution/nginx-opencore.conf`

**Definition of Done**
- Auth rate-limit logic không regress.
- Có `limit_req_zone` và `limit_req` ở gateway config đúng scope.
- Có test hoặc smoke evidence cho HTTP 429 path.

### PH06 — Backend fat-file refactor

**Mục tiêu**
- Tách `views_auth.py` và `dataops.py` theo responsibility thật.

**Definition of Done**
- `views_auth.py` còn controller wiring, logic chia module.
- `dataops.py` không còn chứa business flow dày đặc.
- Không đổi contract công khai ngoài phạm vi đã phê duyệt.

### PH07 — Web fat-file refactor

**Mục tiêu**
- Tách `coreApiAdapter.js` và `AlertCenterPage.js` nhưng vẫn giữ packaging lane sống.

**Definition of Done**
- Có `packages/web/src/adapters/core/` theo domain.
- `AlertCenterPage.js` được tách sub-components có ownership rõ.
- `npm --prefix packages/web run build-community` pass.

### PH08 — QG-1 closeout

**Mục tiêu**
- Khóa Giai đoạn 1 bằng evidence thật, không bằng wording.

**Definition of Done**
- Backend test gate pass trong env đã bootstrap đúng.
- Web build gate pass.
- Taskboard, traceability, self-audit và evidence template được điền cho từng slice Giai đoạn 1.

### PH09 — VNPay/IPN foundation

**Mục tiêu**
- Xây phần greenfield cho payment mà không rewrite nền `commercial/` hiện có.

**Definition of Done**
- Có models/payment state machine/logs.
- Có IPN path idempotent, locking rõ ràng.
- Có reconciliation/replay flow.

### PH10 — Outbound notification pipeline

**Mục tiêu**
- Mở rộng từ in-app delivery sang outbound multi-channel.

**Definition of Done**
- Có canonical delivery state và retry policy.
- Có config ownership cho Email, FCM, WebPush.
- Không synthesize truth ở frontend.

### PH11 — AI advisory cost control

**Mục tiêu**
- Giảm cost mà không làm lệch advisory truth.

**Definition of Done**
- Có quota policy theo plan.
- Có semantic cache TTL và invalidation rules.
- Có failover router policy với guardrails quan sát được.

---

## 5. Validation gates toàn workstream

1. `git diff --check` sạch cho mọi slice.
2. Core backend tests phải chạy trên env đã bootstrap đúng requirements.
3. `npm --prefix packages/web run build-community` pass cho slice chạm `packages/web`.
4. Nếu chạm runtime code, chạy `./start_dev.ps1` theo lane phù hợp.
5. Cập nhật governance artifacts mỗi slice.

---

## 6. Slice-exit gate bắt buộc

1. Focused tests/build pass.
2. Evidence template được điền đủ.
3. Taskboard và traceability cập nhật đúng status.
4. Ledger/progress/modified-files đã cập nhật.
5. `module_tree_full.md` đã regenerate.

---

## 7. Rủi ro và giảm thiểu

| Risk | Mức độ | Mitigation |
|---|---|---|
| Shared `backend/.venv` thiếu dependency của `packages/core` | High | Khóa bootstrap command trong runbooks, không giả định env có sẵn |
| Migration tenant FK chạy khi còn orphan data | High | Bắt buộc pre-audit + quarantine + reject gate |
| Web refactor pass unit nhưng vỡ packaging lane | High | Dùng `build-community` làm gate bắt buộc |
| Shutdown legacy container sớm hơn roadmap | High | Treat sub-plan as subordinate gate only |
| VNPay/IPN phát triển theo hướng rewrite domain cũ | Medium | Reuse `Subscription`/`QuotaRecord`/`Invoice`, chỉ mở rộng payment path |
