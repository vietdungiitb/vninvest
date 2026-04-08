# Onboarding Trial Plan - Admin Policy (2026-04-08)

Tai lieu decision pre-code chi tiet:
- docs/ONBOARDING_TRIAL_PLAN_PRECODE_DECISION_PACK_20260408.md

## 0) Quyet dinh da chot voi Product Owner (2026-04-08)
1. Danh sach goi dich vu hien co trong he thong (lay tu UserConfig.PlanChoices):
- free (Mien phi)
- basic (Co ban)
- pro (Chuyen nghiep)
- premium (Cao cap)
- admin (Quan tri vien)
2. Chi bo qua superuser (khong bo qua tat ca staff).
3. Ap dung cho moi kieu dang ky moi (email/password va OAuth).
4. Chi cho phep 1 policy active tai moi thoi diem.
5. Admin UI phien ban day du ngay tu phase 1 (policy + user override + audit filter).

## 1) Muc tieu
- Cho phep quan tri vien cau hinh goi trai nghiem mac dinh cho nguoi dung dang ky moi.
- Tu dong gan goi khi dang ky thanh cong.
- Tu dong het han sau thoi gian cau hinh (vi du 30 ngay) va chuyen ve goi co ban.
- Dam bao an toan nghiep vu: khong downgrade nham tai khoan tra phi hoac tai khoan do admin khoa goi thu cong.

## 2) Pham vi
### Trong pham vi
- Backend model + migration cho chinh sach onboarding.
- Admin UI de quan tri chinh sach.
- Tich hop vao luong dang ky moi.
- Job xu ly het han trial va downgrade ve goi fallback.
- Audit log cho thay doi policy va plan assignment.

### Ngoai pham vi (giai doan nay)
- Thanh toan online va billing tu dong.
- A/B testing cho nhieu policy dong thoi.
- UI frontend self-service doi goi cho nguoi dung.

## 3) Hien trang he thong (co san)
- Da co plan va plan_expires_at trong UserConfig serializer.
- Da co luong auth dang ky, dang nhap va refresh token.
- Da co scheduler/task lifecycle trong he thong Celery beat.
- Danh sach goi dich vu hien tai trong model UserConfig la:
  - free, basic, pro, premium, admin.

## 4) De xuat thiet ke
## 4.1 Model chinh sach cap he thong
- Ten de xuat: OnboardingPlanPolicy
- Truong du lieu:
  - is_active: bool
  - trial_plan: str (free, basic, pro, premium)
  - trial_duration_days: int (mac dinh 30)
  - fallback_plan: str (mac dinh basic)
  - effective_from: datetime nullable
  - effective_to: datetime nullable
  - apply_for_signup_method: str (co dinh all theo quyet dinh da chot)
  - created_by: FK User nullable
  - updated_by: FK User nullable
  - updated_at: datetime auto
- Quy uoc van hanh:
  - He thong chi co 1 policy active tai 1 thoi diem.

## 4.2 Mo rong UserConfig
- plan_source: enum (system_default, onboarding_trial, manual_admin, paid)
- auto_downgrade_enabled: bool (mac dinh true)
- plan_assigned_at: datetime
- downgraded_at: datetime nullable
- plan_locked_by_admin: bool (neu true thi job khong duoc phep tu dong doi plan)

## 4.3 Audit log
- Ten de xuat: PlanAssignmentLog
- Du lieu can luu:
  - user
  - old_plan, new_plan
  - old_expires_at, new_expires_at
  - reason (signup_trial, trial_expired, admin_override, payment_upgrade)
  - actor (system/admin)
  - created_at

## 5) Quy tac nghiep vu
1. Dang ky moi thanh cong:
- Neu policy active va trong khoang hieu luc, user nhan trial_plan.
- plan_expires_at = now + trial_duration_days.
- plan_source = onboarding_trial.

2. Het han trial:
- Dieu kien downgrade:
  - plan_source = onboarding_trial
  - now >= plan_expires_at
  - auto_downgrade_enabled = true
  - plan_locked_by_admin = false
- Ket qua:
  - plan -> fallback_plan
  - plan_expires_at -> null
  - plan_source -> system_default
  - ghi audit log.

3. Truong hop khong duoc downgrade:
- plan_source = paid.
- plan_locked_by_admin = true.
- user la superuser.

## 6) Thiet ke Admin UI
1. Trang cau hinh Onboarding Trial Policy:
- Bat/tat policy.
- Chon trial plan.
- Nhap trial duration days.
- Chon fallback plan.
- Chon khoang hieu luc.
- Preview noi dung: user moi se duoc gi va het han khi nao.

2. Trang UserConfig admin:
- Hien thi plan, plan_source, plan_expires_at.
- Nut admin override plan.
- Toggle plan_locked_by_admin.
- Action reset ve policy mac dinh.

3. Trang audit:
- Loc theo user, reason, khoang thoi gian.

## 7) Luong ky thuat de trien khai
1. Migration tao OnboardingPlanPolicy + PlanAssignmentLog + field moi trong UserConfig.
2. Service layer:
- apply_onboarding_trial_for_new_user(user, signup_method)
- process_expired_onboarding_trials(limit, now)
3. Hook vao registration flow sau khi tao user + userconfig.
4. Tao Celery task chay dinh ky xu ly trial het han.
5. Admin registration + permission chi cho staff/superuser.
6. Unit test + integration test.

## 8) Ke hoach thuc thi de xet duyet
### Giai doan A - Chot nghiep vu (0.5 ngay)
- Chot enum plan hop le.
- Chot rule fallback.
- Chot rule bo qua staff/superuser.

### Giai doan B - Data model va migration (0.5 ngay)
- Tao model va migration.
- Backfill gia tri mac dinh cho user cu.

### Giai doan C - Service + registration integration (1 ngay)
- Goi service khi signup.
- Ghi log assignment.

### Giai doan D - Expiry job (0.5 ngay)
- Them Celery task + beat schedule.
- Idempotent, safe retry.

### Giai doan E - Admin UI + audit (1 ngay)
- Form quan tri policy.
- User override + lock plan.

### Giai doan F - Test + rollout (0.5-1 ngay)
- Unit test + smoke test runtime.
- Rollout canary va theo doi log.

Tong uoc luong: 3-4.5 ngay lam viec.

## 9) Ke hoach test
1. User dang ky moi nhan dung trial plan.
2. plan_expires_at dung timezone Asia/Ho_Chi_Minh.
3. Den han thi downgrade dung fallback.
4. User paid khong bi downgrade.
5. User bi admin lock plan khong bi downgrade.
6. Policy tat thi user moi ve plan mac dinh.
7. Job chay lap lai khong doi du lieu sai (idempotent).

## 10) Rui ro va bien phap
1. Downgrade nham user tra phi
- Bien phap: check plan_source paid + lock flag truoc khi downgrade.

2. Lech gio het han
- Bien phap: su dung timezone aware datetime, test boundary 00:00.

3. Admin cau hinh sai policy
- Bien phap: validate trial_plan va fallback_plan khong rong, trial_duration_days > 0.

4. Race condition voi cap nhat plan thu cong
- Bien phap: transaction + select_for_update trong service expiry.

## 11) Tieu chi chap nhan
1. Co the cau hinh trial policy tu trang admin.
2. User moi nhan policy dung 100%.
3. Sau khi het han, user duoc chuyen ve goi fallback dung rule.
4. Co audit trail day du cho signup_trial va trial_expired.
5. Khong phat sinh regression cho auth/login/user config hien tai.

## 12) Quyet dinh can ban xac nhan truoc khi code
Da duoc xac nhan hoan tat.

## 13) Implementation snapshot (cap nhat 2026-04-08)
- Da trien khai endpoint signup:
  - `POST /api/auth/register/` (email/password)
  - `POST /api/auth/oauth/google/` (Google OAuth access token)
- Ca 2 luong signup deu goi chung onboarding trial service khi `ONBOARDING_TRIAL_APPLY_ON_SIGNUP=True`.
- Da trien khai task expiry downgrade qua Celery beat voi feature flags:
  - `ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED`
  - `ONBOARDING_TRIAL_AUTO_DOWNGRADE_MINUTES`
  - `ONBOARDING_TRIAL_AUTO_DOWNGRADE_BATCH_SIZE`
- Da bo sung structured logs su kien:
  - onboarding_trial_assigned
  - onboarding_trial_skipped
  - onboarding_trial_downgraded
  - onboarding_trial_expiry_summary
- Da co rollback runbook: `docs/SPRINT27_ROLLBACK_RUNBOOK.md`.
