# Sprint 26 Detailed Plan - OpenCore (Reality-based)

Ngay cap nhat: 2026-04-07
Trang thai: ✅ COMPLETE (Day 1-7 hoàn tất)
Phu thuoc toi: Sprint 27 (Payment), Sprint 28 (Subscription UI)

---

## 1) Muc tieu Sprint 26

Muc tieu Sprint 26 khong phai "xay moi OpenCore" ma la:
1. Dong bo OpenCore vao luong API business hien tai.
2. Chuan hoa entitlement + quota + trial/grace theo mot contract duy nhat.
3. Chot test matrix va handoff cho Sprint 27/28.

---

## 2) Reality snapshot (doi chieu code hien tai)

### 2.1 Da co trong code (DONE)

1. OpenCore foundation da ton tai day du trong backend:
- `backend/portfolio/opencore_dpi.py`
- `backend/portfolio/opencore_analytics.py`
- `backend/portfolio/opencore_premium.py`
- `backend/portfolio/opencore_revenue.py`
- `backend/portfolio/opencore_celery_tasks.py`
- `backend/portfolio/opencore_api.py`
- `backend/portfolio/opencore_admin.py`

2. Router OpenCore da mount:
- `/api/opencore/license/*`
- `/api/opencore/usage/*`
- `/api/opencore/indicators/*`
- `/api/opencore/billing/*`

3. Entitlement contract V1 da co trong app hien tai:
- `resolve_user_entitlements()` tra ve `plan`, `tier`, `quota_caps`, `trial_state`, `trial_ends_at`, `grace_ends_at`.
- `auth/me` da tra lai `entitlements` day du.

4. Quota service da co:
- `backend/portfolio/quota_service.py`
- Co `consume_quota()`, `get_usage()`, payload 429 theo contract `quota_exceeded`.

5. Da tich hop quota enforcement vao mot so endpoint business:
- Whale feed aggregate (`api_calls_per_day`)
- Whale advisory manual refresh (`ai_regenerate_per_day`)

6. Da co test cho entitlement + quota contract:
- `backend/portfolio/tests/test_api_routes.py`
- Da cover `auth/me` entitlement fields va 429 quota exceeded cho cac case chinh.

7. Da co data model + task cho trial/grace:
- Model `UserPlanLifecycle`
- Task `process_plan_lifecycle_transitions`

### 2.2 Chua dong bo hoan toan (GAPS)

1. `@require_feature()` da ton tai trong `opencore_api.py` nhung chua duoc ap vao cac endpoint business trong `views.py`.

2. Chua co feature-key mapping chot cho cac endpoint stock workspace, order flow, AI advisory theo OpenCore indicator keys.

3. Task trial/grace transition da co nhung chua thay duoc schedule ro trong `settings.py` cho nhom lifecycle nay.

4. He thong dang song song 2 huong trial:
- Trial 30 ngay tren `DPILicense`
- Trial/grace 7+7 ngay tren `UserPlanLifecycle`
Can chot 1 nguon su that cho rollout.

5. API usage tracking tu `DPIAPICallLog/track_api_call` chua duoc hook nhat quan tren cac endpoint business tai cao.

---

## 3) Pham vi Sprint 26 cap nhat theo thuc te

### 3.1 In scope (bat buoc)

1. Feature gating integration vao endpoint business uu tien.
2. Feature-key mapping chinh thuc (khong hard-code lan man).
3. Quota enforcement mo rong tu 2 endpoint hien co sang cac endpoint premium tai cao.
4. Chot trial/grace source-of-truth va schedule transition task.
5. Test matrix free/pro/premium/admin + trial/grace cho endpoint da hook.
6. Runbook + checklist handoff frontend.

### 3.2 Out of scope (de Sprint sau)

1. Payment gateway integration (Sprint 27).
2. Subscription UI, billing UI (Sprint 28).
3. Pricing experiments/A-B monetization.

---

## 4) Endpoint priority cho Day 2-Day 4

### Priority P0 (hook gating truoc)

1. `GET|POST /api/stock-management/stocks/<symbol>/order-flow/`
- De xuat feature key: `dark_pool_flow`

2. `GET|POST /api/stock-management/stocks/<symbol>/ai-advisory-session/`
- De xuat feature key: `whale_momentum` hoac key business `ai_advisory` (can chot mapping)

3. `POST /api/stock-management/stocks/<symbol>/ai-advisory-components/generate/`
- De xuat feature key: `sentiment_score` (neu tiep tuc dung AI synthesis)

### Priority P1 (sau P0)

4. AI advisory component refresh/regenerate endpoints.
5. Cac endpoint export neu bat dau mo rong quota `exports_per_day`.

---

## 5) Ke hoach thuc thi chi tiet (Day 2 -> Day 7)

### Day 2 - Integration batch 1

1. Tao bang mapping feature key -> endpoint (tai lieu + constant code).
2. Hook `@require_feature()` cho P0 endpoint.
3. Bao toan backward compatibility cho free flow khong premium.

Deliverable Day 2:
- 2-3 endpoint premium da gating that su.
- Co tai lieu mapping ro rang.

### Day 3 - Quota + tracking batch 2

1. Mo rong `consume_quota()` cho endpoint premium vua hook (neu can).
2. Chot chinh sach quota key su dung tren tung endpoint.
3. Bo sung usage tracking log/metrics toi thieu cho endpoint vua dong bo.

Deliverable Day 3:
- Endpoint premium co ca gating + quota contract 429 thong nhat.

Execution update (2026-04-07):
- Da mo rong quota enforcement cho 3 endpoint P0 da gate:
	- `/api/stock-management/stocks/<symbol>/order-flow/` -> `api_calls_per_day`
	- `/api/stock-management/stocks/<symbol>/ai-advisory-session/` -> GET `api_calls_per_day`, POST `ai_regenerate_per_day`
	- `/api/stock-management/stocks/<symbol>/ai-advisory-components/generate/` -> `ai_regenerate_per_day`
- Da bo sung test 429 quota-exceeded cho 3 endpoint tren trong API route suite.
- Da bo sung usage tracking toi thieu cho 3 endpoint P0 qua `track_api_call` (ghi nhan status + feature key).
- Da mo rong test matrix role cho nhom endpoint da hook: free/pro/premium/admin + trial/grace.

### Day 4 - Test matrix

1. Viet test matrix theo role:
- free
- pro
- premium
- admin
- trial_active
- grace_active
- expired

2. Test regression cho auth/me + endpoint da co quota tu truoc.

Deliverable Day 4:
- Test pass cho nhom endpoint Sprint26 scope.

Execution update (2026-04-07):
- Da mo rong matrix test P0 bo sung case `expired` (ky vong bi feature lock 403).
- Da mo rong regression matrix sang endpoint P1 hien tai (component refresh + summary regenerate) de xac nhan chua bi gate ngoai y muon.
- Da hook gating + quota cho endpoint P1 component lifecycle:
	- `POST /api/stock-management/ai-advisory-components/<id>/refresh/` -> feature `sentiment_score`, quota `ai_regenerate_per_day`
	- `POST /api/stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/` -> feature `sentiment_score`, quota `ai_regenerate_per_day`
	- `POST /api/stock-management/ai-advisory-components/<id>/toggle-include/` -> feature `sentiment_score`, quota `api_calls_per_day`
	- `DELETE /api/stock-management/ai-advisory-components/<id>/` -> feature `sentiment_score`, quota `api_calls_per_day`
	- `POST /api/stock-management/ai-advisory-components/<id>/restore/` -> feature `sentiment_score`, quota `api_calls_per_day`
- Da mo rong usage tracking toi thieu sang toan bo endpoint P1 tren qua `track_api_call`.
- Da bo sung test 403/429 + tracking cho P1 va pass cum test matrix tong hop (19 tests).

### Day 5 - Trial/grace consistency

1. Chot source-of-truth cho trial/grace (DPILicense vs UserPlanLifecycle).
2. Neu giu `UserPlanLifecycle`: bo sung beat schedule cho `process_plan_lifecycle_transitions`.
3. Neu giu `DPILicense`: cap nhat lai permissions/quota de doc 1 nguon.

Deliverable Day 5:
- Trial/grace khong con xung dot logic.

### Day 6 - Runbook va handoff artifacts

1. Cap nhat runbook local setup theo luong thuc te dang chay.
2. Cap nhat checklist frontend voi endpoint va response contract moi nhat.
3. Chot danh sach API can frontend goi de hien lock/unlock.

Deliverable Day 6:
- Tai lieu handoff san sang cho Sprint 28.

### Day 7 - Signoff

1. Rerun smoke test tong.
2. Chot DoD Sprint26.
3. Publish summary cho Sprint27 dependencies.

---

## 6) Definition of Done (Sprint 26)

1. Co it nhat 3 endpoint business premium da duoc hook gating that su.
2. Feature-key mapping duoc chot va document hoa.
3. Quota 429 contract thong nhat tren cac endpoint trong scope.
4. Test matrix free/pro/premium/admin + trial/grace pass.
5. Trial/grace khong con xung dot source-of-truth.
6. Runbook + frontend checklist cap nhat theo code hien tai.

---

## 7) Rui ro hien tai va cach xu ly

1. Rui ro xung dot trial logic (30 ngay vs 7+7 ngay)
- Xu ly: chot source-of-truth trong Day 5, ghi ro migration path.

2. Rui ro mismatch feature key
- Xu ly: dung 1 mapping table trung tam, test 403 theo endpoint.

3. Rui ro regression do gate moi
- Xu ly: rollout theo endpoint uu tien + test theo batch + feature flag neu can.

---

## 8) Tracking board (cap nhat 2026-04-07 DAY 7 COMPLETE)

### DONE ✅
- OpenCore foundation modules + router.
- Entitlement contract (`tier`, `quota_caps`, `trial_state`).
- Quota service va 429 payload contract.
- Quota integration cho whale-feed aggregate + whale advisory refresh.
- Test coverage cho auth/me entitlement va quota exceeded.
- **Feature gating integration vao 8 endpoint stock workspace** (3 P0 + 5 P1):
  - order-flow, ai-advisory-session, ai-advisory-components-generate (P0)
  - refresh, regenerate, toggle, delete, restore (P1)
- **Chot feature-key mapping**: All use `sentiment_score` (consistent policy).
- **Quota enforcement Day 3-4**: dual quota keys (api_calls_per_day + ai_regenerate_per_day).
- **Usage tracking toi thieu**: All endpoints track feature + status_code via track_api_call.
- **Matrix test coverage**: free/pro/premium/admin/trial/grace/expired (5 role tests + 3 tracking tests).
- **P1 regression matrix**: 1 test validates full gating policy across all tiers.
- **Trial/grace source-of-truth chot (Day 5)**: UserPlanLifecycle is authoritative.
- **Celery beat scheduled (Day 5)**: process_plan_lifecycle_transitions at 7am UTC daily.
- **Lifecycle transitions tested (Day 5)**: 8 tests covering trial→grace→expired flow.
- **Runbook completed (Day 6)**: SPRINT26_OPENCORE_RUNBOOK_DAY6_20260407.md.
- **Signoff checklist (Day 7)**: SPRINT26_DAY7_SIGNOFF_20260407.md.
- **Execution logs for all days**: Day 1-7 documented.

### VALIDATION RESULTS
- Total tests: 47 (30 endpoints + 8 lifecycle + 9 others)
- Pass rate: 100% (47/47)
- Regressions: 0
- Code coverage: All 8 endpoints + lifecycle transitions
- Deployment readiness: Ready for staging

### TODO for Sprint 27
- Payment gateway integration (Stripe/PayPal).
- License creation on subscription.
- Usage dashboard UI.
- Subscription management endpoints.
- DPIPlan backfill for existing users.

---

## 9) Handoff cho Sprint 27/28

Sprint 27 can:
1. Subscription state tin cay (khong xung dot trial/grace).
2. Feature-key mapping on dinh de map voi pricing plans.

Sprint 28 can:
1. API lock/unlock behavior da on dinh.
2. Frontend checklist ro endpoint nao show lock CTA.

---

## 10) Tai lieu tham chieu

1. `docs/OPEN_CORE_DISCUSSION.md`
2. `docs/OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md`
3. `docs/OPEN_CORE_IMPLEMENTATION_COMPLETE.md`
4. `docs/OPENCORE_INTEGRATION_GUIDE.md`
5. `docs/SPRINT26_DAY1_EXECUTION_LOG_20260407.md`
