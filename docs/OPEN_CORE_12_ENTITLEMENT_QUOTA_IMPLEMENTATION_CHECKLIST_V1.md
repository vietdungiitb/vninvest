# OPEN CORE ENTITLEMENT + QUOTA IMPLEMENTATION CHECKLIST V1 (OC-12)

Doc ID: OC-12
Ngay tao: 2026-04-07
Trang thai: Draft ready for coding approval
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md, OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md

## 1. Muc tieu
Chuyen OC-11 (pricing/quota/trial/SLO) thanh backlog ky thuat co the code ngay, co acceptance criteria ro rang.

## 2. Hien trang code da co (backend)
1. Da co plan va plan_expires_at trong UserConfig.
2. Da co resolver: resolve_user_entitlements(user) va DRF permission classes.
3. Da co auth/me tra ve plan + entitlements cho frontend.
4. Da co mot so gate theo plan o API va websocket.

## 3. Mapping V1 de implementation
1. Community -> free
2. Pro Individual -> pro
3. Pro Team -> premium
4. admin giu nguyen la he thong noi bo

Note: Mapping nay dung de ra code V1 nhanh, chua doi ten plan trong DB.

## 4. Scope code V1 (must-have)
1. Entitlement contract V1
- Mo rong resolve_user_entitlements(user) de tra them:
  - tier: community | pro_individual | pro_team | admin
  - quota_caps: api_calls_per_day, ai_regenerate_per_day, whale_symbols_max, exports_per_day
  - trial_state: none | trial_active | grace_active | expired
  - trial_ends_at, grace_ends_at

2. Quota accounting service
- Tao service dung chung (vi du: quota_service.py):
  - consume(user, quota_key, amount=1) -> allow/deny + remaining + reset_at
  - get_usage(user, quota_key)
  - reset theo ngay (timezone Asia/Ho_Chi_Minh)
- Redis-first + DB fallback (neu Redis loi van an toan).

3. API protection and response contract
- Gate cac endpoint premium theo entitlements (khong hard-code plan string tai nhieu noi).
- Khi vuot quota: tra HTTP 429 va payload thong nhat:
  - code: quota_exceeded
  - quota_key
  - limit
  - remaining
  - reset_at

4. Trial + grace lifecycle
- Them lifecycle logic:
  - trial 7 ngay, quota = 70% Pro Individual
  - grace 7 ngay sau trial/paid expiry
  - het grace: khoa premium, giu free flow
- Job hang ngay (Celery beat) de cap nhat trial/grace status.

5. Observability and audit
- Metric toi thieu:
  - entitlement_resolve_total
  - quota_consume_total{quota_key,result}
  - quota_exceeded_total{quota_key,plan}
- Log audit khi doi plan/trial/grace status.

## 5. Scope code V1 (should-have)
1. Endpoint auth/me bo sung quota snapshot de frontend show banner.
2. Them endpoint self-service usage summary (read-only).
3. Feature flag rollout:
- ENABLE_OPEN_CORE_QUOTA_ENFORCEMENT (default false)
- ENABLE_OPEN_CORE_TRIAL_GRACE (default false)

## 6. Data model changes de du kien
1. Khong doi bang UserConfig cho V1 wave 1 (tan dung plan + expires).
2. Them bang usage counters neu can DB fallback ben vung:
- UserQuotaUsage(user, date, quota_key, used, updated_at)
3. Them bang trial state neu can lifecycle ro rang:
- UserPlanLifecycle(user, trial_starts_at, trial_ends_at, grace_ends_at, source)

## 7. File-level implementation checklist
1. backend/portfolio/permissions.py
- Centralize entitlement map + quota map theo tier.
- Tra ve contract entitlements V1 day du.

2. backend/portfolio/views.py
- Doi cac gate hard-code plan sang helper entitlement.
- Chuan hoa 429 response cho quota exceeded.

3. backend/portfolio/consumers.py
- Ap entitlement gating thong nhat voi REST APIs.

4. backend/config/settings.py and backend/.env.example
- Khai bao feature flags va quota defaults by tier.

5. backend/portfolio/tasks.py (hoac module task phu hop)
- Cron daily xu ly trial/grace transitions.

6. backend/portfolio/tests/
- Unit tests: entitlement map, quota consume, trial/grace transitions.
- API tests: 200/403/429 theo plan va quota.
- Websocket tests: masking/gating theo tier.

## 8. Acceptance criteria (go/no-go)
1. Community khong truy cap duoc premium endpoints.
2. Pro Individual dung quota dung theo OC-11.
3. Trial users co 70% quota Pro Individual.
4. Qua grace thi premium bi khoa, free flow van dung duoc.
5. Tat ca gate response dung mot contract (403/429) va co test.
6. Tat feature flags thi he thong quay ve behavior cu.

## 9. Execution slices de code nhanh
1. Slice A (1-2 ngay): entitlement contract + mapping + tests.
2. Slice B (1-2 ngay): quota service + API 429 contract + tests.
3. Slice C (1 ngay): trial/grace scheduler + tests.
4. Slice D (0.5-1 ngay): metrics + log audit + rollout flag.

## 10. Blockers can owner xac nhan truoc khi code
1. Xac nhan mapping plan V1 (free/pro/premium) nhu Muc 3.
2. Xac nhan rollout strategy: bat flag tren staging truoc, production sau.
3. Xac nhan legal wording final lock cho trial/grace message text.

## 11. Ready-to-code gate
Neu 3 blocker o Muc 10 duoc xac nhan, nhom co the vao code ngay theo Slice A -> D.

## 12. Next review checkpoint
- Target review: 2026-04-08 (day 2 execution log update in OC-03).
