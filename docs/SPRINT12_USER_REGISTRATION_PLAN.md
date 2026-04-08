# Sprint 12 Extension Plan - User Registration

Trang thai: IMPLEMENTED, awaiting broader QA/sign-off  
Ngay lap ke hoach: 2026-04-03

## 0. Implementation delta

Da hoan thanh trong codebase:
- Backend `POST /api/auth/register/` da bat buoc `email`.
- Register response da chuyen sang che do `verification_required`, khong auto-login.
- Frontend auth flow da ho tro hai mode `Dang nhap` va `Dang ky`.
- Sau dang ky thanh cong, frontend yeu cau user kiem tra email va xac thuc tai khoan.
- Backend route tests pass va frontend production build pass.

Con lai de dong sprint:
- QA matrix rong hon cho registration flow.
- Cap nhat execution log/checklist neu can xem day la phan deliver chot cua Sprint 12.

## 1. Muc tieu

Bo sung chuc nang dang ky nguoi dung vao Sprint 12 theo dung nhom `User Management Core`, nhung chi chot ke hoach va Definition of Done truoc khi bat dau code.

Ket qua mong doi sau khi trien khai:
- Nguoi dung moi co the tao tai khoan bang `username + email + password`.
- Sau dang ky, he thong tao `UserConfig` mac dinh voi `plan=free`.
- Sau dang ky thanh cong, he thong gui email xac thuc va chi cho phep dang nhap sau khi verify.
- Frontend co luong `Dang nhap <-> Dang ky` ro rang, khong can thao tac tay qua admin.
- Loi validate duoc hien thi ro rang, khong lo thong tin he thong.

## 2. Hien trang codebase

Da co san:
- Backend route `POST /api/auth/register/`.
- Backend `RegisterSerializer` validate `username`, `email`, `password`, `password_confirm`.
- Backend tu dong tao `UserConfig` sau khi tao `User`.
- Route `api/auth/register/` da duoc expose trong `backend/config/urls.py`.

Chua hoan tat:
- Frontend chua co form dang ky thuc su.
- `frontend/src/api/auth.js` chua co helper `register()`.
- `LoginModal.jsx` moi co login flow + OAuth placeholder, chua co che do register.
- Backend response register chua cap token cho auto-login flow.
- Chua co test backend/frontend danh rieng cho register flow.
- Chua co acceptance checklist va taskboard rieng cho registration.

## 3. Pham vi Sprint 12 extension

Trong scope:
1. Registration bang username/password/email bat buoc.
2. Validate input tai frontend va backend.
3. Tao `UserConfig` mac dinh va gan `plan=free`.
4. Gui email xac thuc ngay sau khi register thanh cong.
5. UX chuyen doi giua login/register trong cung auth entrypoint.
6. Xu ly thong bao thanh cong, that bai, duplicate username, mismatch password.
7. Chi cho phep dang nhap voi tai khoan da verify email.
8. Test API + smoke test frontend flow.
9. Cap nhat tai lieu Sprint 12, roadmap, checklist, taskboard.

Ngoai scope:
1. Forgot password / reset password.
2. Forgot password / reset password.
3. OAuth Google/Facebook thuc te.
4. CAPTCHA / anti-bot nang cao.
5. Admin approval workflow.

## 4. Quyet dinh nghiep vu can chot truoc khi code

1. Sau dang ky co tu dong dang nhap khong?
   - Chot: Khong. User phai verify email truoc khi duoc phep dang nhap.

2. Email co bat buoc khong?
   - Chot: Co. Email la bat buoc o UI va backend validation.

3. Username rule co giu nguyen khong?
   - Chot: Giu regex hien tai `^[a-zA-Z0-9_]{3,30}$` de dong nhat backend.

4. Mac dinh plan khi dang ky?
   - Chot: `free`, lay theo `UserConfig` creation flow hien tai.

## 5. Work breakdown chi tiet

### Phase A - Contract va validation design (0.5 ngay)
- Xac nhan request/response chuan cho `POST /api/auth/register/`.
- Xac nhan chien luoc auto-login: tra token ngay trong response hoac login noi tiep sau register.
- Chot mapping loi backend -> thong diep UI.
- Chot cac field form: `username`, `email`, `password`, `password_confirm`.
- Chot post-success UX: tu dong vao app, dong auth modal/redirect dashboard.

Deliverable:
- API contract note.
- Validation matrix.

### Phase B - Backend hardening review (0.5 ngay)
- Review `RegisterSerializer` cho cac case: duplicate username, blank email, invalid email, password mismatch.
- Xac nhan email la required va thong diep loi ro rang.
- Xem co can bo sung unique email check hay khong.
- Xac nhan response 201 phuc vu auto-login: co `access`, `refresh` hoac contract ro rang cho login noi tiep.
- Bo sung test backend cho cac nhanh thanh cong / that bai.

Deliverable:
- Danh sach backend gap.
- Test cases backend.

### Phase C - Frontend auth API layer (0.5 ngay)
- Them `register(payload)` vao `frontend/src/api/auth.js`.
- Chuan hoa shape error tra ve de UI de doc.
- Xac dinh co can helper parse validation error hay khong.

Deliverable:
- Auth API contract cho frontend.

### Phase D - Login/Register UX flow (1 ngay)
- Nang cap `LoginModal.jsx` thanh 2 mode: `login` va `register`.
- Them form field cho register.
- Disable submit khi input khong hop le co ban.
- Hien thi error theo field va error tong.
- Sau thanh cong: tu dong co session hop le va dieu huong vao dashboard.

Deliverable:
- Auth modal flow ro rang tren desktop/mobile.

### Phase E - State va integration (0.5 ngay)
- Xac nhan register flow khong lam vo `PortfolioContext`.
- Dong bo token state, `isAuthenticated`, `/api/auth/me/`, `userPlan`, `ability` sau auto-login.
- Chot redirect sau register thanh cong ve dashboard hoac route protected mac dinh.

Deliverable:
- Integration notes khong anh huong login hien tai.

### Phase F - QA va docs (1 ngay)
- Backend tests cho register API.
- Frontend smoke test: dang ky moi -> auto-login -> vao dashboard.
- Test loi: duplicate username, invalid email, password mismatch, invalid username, password qua ngan.
- Cap nhat checklist, taskboard, roadmap, execution log.

Deliverable:
- Checklist pass.
- Docs sync.

## 6. API contract de xuat

### Request

```json
{
  "username": "new_user_01",
   "email": "user@example.com",
  "password": "StrongPass123",
  "password_confirm": "StrongPass123"
}
```

### Success response `201`

```json
{
  "username": "new_user_01",
  "plan": "free",
   "email": "user@example.com",
   "verification_required": true,
   "message": "Dang ky thanh cong. Vui long kiem tra email de xac thuc tai khoan."
}
```

### Error cases can cover

```json
{
  "username": ["Tên đăng nhập đã tồn tại."]
}
```

```json
{
  "password_confirm": ["Mật khẩu xác nhận không khớp."]
}
```

## 7. UI/UX de xuat

Auth entrypoint:
- Mac dinh vao tab `Dang nhap`.
- Co text action `Chua co tai khoan? Dang ky` de chuyen mode.
- Trong mode dang ky, giu layout gon nhe, cung visual language voi login.
- Nut OAuth van de placeholder, khong tron scope register username/password.
- Email duoc danh dau bat buoc.

Validation UX:
- Frontend validate som cho required + email format + password_confirm.
- Backend van la source of truth cho duplicate username, email rule va regex username.
- Loi hien sat field neu co the; neu khong, hien thong diep tong o dau form.

Post success:
- Hien thong bao kiem tra email va dieu huong user ve trang dang nhap hoac trang verify.
- Khi user bam link trong email, frontend goi `POST /api/auth/verify-email/`.
- Sau khi verify thanh cong, user tu dang nhap bang flow JWT thong thuong.

## 8. Test matrix truoc khi code

Backend:
1. Tao user moi thanh cong.
2. Duplicate username -> 400.
3. Email trong/khong hop le -> 400.
4. Password confirm mismatch -> 400.
5. Username sai regex -> 400.
6. Password ngan hon 8 ky tu -> 400.
7. Sau create, `UserConfig` ton tai va `plan=free`.
8. Response tra `verification_required=true`, khong cap JWT.
9. Login bi chan neu email chua verify.
10. Verify email thanh cong thi login JWT moi duoc phep.

Frontend:
1. Chuyen qua lai login/register khong mat state bat thuong.
2. Dang ky thanh cong tu dong vao dashboard voi session hop le.
3. Duplicate username hien dung loi.
4. Email invalid hoac de trong hien dung loi.
5. Password mismatch bi chan tu UI hoac backend va hien dung.
6. Mobile width van su dung duoc.

Regression:
1. Login cu van hoat dong.
2. `/api/auth/me/` flow sau login khong bi anh huong.
3. Protected route va CASL state van giu nguyen.

## 9. Rui ro va giam thieu

1. Nhieu tai lieu dang coi Sprint 12 da done.
   - Giam thieu: danh dau day la `Sprint 12 extension plan` truoc khi code, khong danh dau completed.

2. Backend da co register co the gay nham rang tinh nang da xong.
   - Giam thieu: tach ro `API exists` khac voi `user-facing flow complete`.

3. Verification link co the het han hoac bi gui loi.
   - Giam thieu: co endpoint gui lai email xac thuc va test branch token invalid/expired.

4. Email required se lam thay doi serializer hien tai.
   - Giam thieu: cap nhat validation backend/frontend cung luc, tranh lech contract.

## 10. Definition of Done de xuat

- User dang ky duoc qua UI, khong can admin.
- Email la truong bat buoc va duoc validate dung.
- Backend API register co test pass.
- Frontend auth form ho tro login/register va hien loi ro rang.
- Dang ky moi tao `UserConfig` plan `free`.
- Sau dang ky, user nhan duoc email xac thuc va chua dang nhap ngay.
- Tai khoan chua verify bi chan o endpoint login JWT.
- Sau verify thanh cong, user dang nhap duoc va `/api/auth/me/` tra ve plan/abilities dung.
- Docs Sprint 12, roadmap, checklist, taskboard duoc cap nhat.

## 11. Thu tu thuc hien de xuat

1. Chot quyet dinh nghiep vu o muc 4.
2. Chot API contract + validation matrix.
3. Implement backend hardening/tests neu can.
4. Implement frontend API layer.
5. Implement login/register UI flow.
6. Run smoke tests + targeted tests.
7. Cap nhat checklist/execution log.

## 12. De xuat phan ra task

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S12-11 | Freeze register contract + UX decisions | PM/BE/FE | 0.5d |
| S12-12 | Backend register hardening + auto-login contract + tests | BE | 0.5d |
| S12-13 | Frontend auth API integration | FE | 0.5d |
| S12-14 | Login/Register UI implementation + auto-login redirect | FE | 1d |
| S12-15 | QA register flow + regression | QA/FE/BE | 1d |
| S12-16 | Docs and sign-off update | PM | 0.5d |

## 13. Extension tiep theo: Starter portfolios provisioning

Muc tieu:
- Sau khi user dang ky thanh cong, he thong tu provision mot bo danh muc dau tu mau.
- Moi danh muc co day du cac tieu khoan thong dung de user khong phai tao thu cong tu dau.

Scope nghiep vu de xuat:
1. Tao 3 portfolio mac dinh:
   - Tich luy dai han
   - Giao dich ngan han
   - Theo doi va thu nghiem
2. Moi portfolio tu tao 3 tieu khoan thong dung:
   - Duoi 1 (Tien mat)
   - Duoi 3 (Chuyen biet)
   - Duoi 6 (Margin)

Nguyen tac ky thuat:
1. Idempotent: goi lai khong tao trung.
2. Fail-soft: seed loi khong chan flow dang ky.
3. Transaction-safe: tao theo lo, tranh trang thai nua chung.
4. Feature-flag rollout: canary theo ty le user moi.
5. Co backfill command cho user cu chua duoc seed.

Diem tich hop:
1. Email/password signup path trong RegisterView.
2. Google OAuth signup path khi `created=True`.
3. Luu trang thai seed vao UserConfig (seeded flag, seeded_at, template_version).

Acceptance bo sung:
1. User moi co du bo portfolio/tieu khoan mac dinh ngay sau dang ky.
2. Retry cung user khong tao trung du lieu.
3. Seed loi khong lam fail API dang ky.
4. Co command backfill va co log ket qua theo user.

## 14. Chinh sach dong bo tai lieu (canonical)

De tranh phan manh tinh nang, moi cap nhat cho nhanh dang ky + provisioning phai dong bo dong thoi:
1. docs/SPRINT12_USER_REGISTRATION_PLAN.md
2. docs/SPRINT12_ACCEPTANCE_CHECKLIST.md
3. docs/SPRINT_EXECUTION_LOG.md
4. docs/ROADMAP_STATUS.md

Khong mo tai lieu sprint moi cho nhanh nay neu 4 tai lieu canonical tren chua duoc cap nhat.

## 15. Implementation-ready package (de co the code ngay)

Phan nay chot toi muc dev co the bat dau lap trinh khong can hop bo sung.

### 15.1 Work items ky thuat

| ID | Task | Owner | Estimate | DoD ky thuat |
|---|---|---|---|---|
| S12-17 | Tao service provision starter portfolios | BE | 0.75d | Co ham idempotent tao du 3 portfolio x 3 sub-account, co unit test |
| S12-18 | Hook vao signup paths | BE | 0.5d | Email/password va Google OAuth (created=True) deu goi provision service |
| S12-19 | Them feature flag + backfill command | BE/DevOps | 0.75d | Co flag bat/tat rollout + command seed cho user cu + summary log |
| S12-20 | QA + docs sync + sign-off | QA/PM/BE | 0.5d | Checklist pass, execution log cap nhat, roadmap/taskboard dong bo |

### 15.2 File-level implementation map

Backend files can sua/cham toi:
1. `backend/portfolio/starter_portfolio_service.py` (tao moi)
2. `backend/portfolio/auth_views.py` (hook RegisterView + GoogleOAuthView)
3. `backend/portfolio/models.py` (bo sung field tracking seed trong UserConfig)
4. `backend/portfolio/management/commands/backfill_starter_portfolios.py` (tao moi)
5. `backend/config/settings.py` (feature flags)
6. `backend/portfolio/tests/test_starter_portfolio_service.py` (tao moi)
7. `backend/portfolio/tests/test_api_routes.py` (bo sung test integration signup)

### 15.3 UserConfig tracking fields de xuat

De xuat mo rong `UserConfig`:
1. `starter_portfolios_seeded` (bool, default False)
2. `starter_portfolios_seeded_at` (datetime, nullable)
3. `starter_portfolios_template_version` (char, default `v1`)

Muc dich:
1. Truy vet rollout theo user.
2. Dam bao idempotency va skip nhanh.
3. Ho tro backfill co dieu kien.

### 15.4 Provision template v1

Danh muc mac dinh:
1. Tich luy dai han
2. Giao dich ngan han
3. Theo doi va thu nghiem

Moi danh muc tao 3 tieu khoan:
1. Duoi 1 - Tien mat (type=`1`, margin_ratio=`1.000`)
2. Duoi 3 - Chuyen biet (type=`3`, margin_ratio=`1.000`)
3. Duoi 6 - Margin (type=`6`, margin_ratio=`0.500`)

### 15.5 Pseudo-flow implementation

```text
if not settings.STARTER_PORTFOLIOS_ENABLED:
   return skipped(flag_off)

cfg = UserConfig.objects.get_or_create(user=user)
if cfg.starter_portfolios_seeded is True:
   return skipped(already_seeded)

with transaction.atomic():
   for portfolio_name in TEMPLATE_PORTFOLIOS:
      portfolio = Portfolio.objects.get_or_create(user=user, name=portfolio_name)
      for sub_template in TEMPLATE_SUBACCOUNTS:
         SubAccount.objects.get_or_create(portfolio=portfolio, name=sub_template.name, defaults={...})
   cfg.starter_portfolios_seeded = True
   cfg.starter_portfolios_seeded_at = now
   cfg.starter_portfolios_template_version = "v1"
   cfg.save(update_fields=[...])

return success
```

### 15.6 Feature flags rollout

Flags de xuat:
1. `STARTER_PORTFOLIOS_ENABLED=false` (global on/off)
2. `STARTER_PORTFOLIOS_CANARY_PERCENT=0` (0-100)

Rule canary de xuat:
1. Deterministic by `user.id % 100 < CANARY_PERCENT`.
2. Superuser bo qua canary (always off) de tranh seed mau trong tai khoan quan tri.

### 15.7 Backfill command contract

Command de xuat:
1. `python manage.py backfill_starter_portfolios --limit 200 --dry-run`
2. `python manage.py backfill_starter_portfolios --username alice`
3. `python manage.py backfill_starter_portfolios --all`

Output can co:
1. so user da seed thanh cong
2. so user skip do da seeded
3. so user fail + danh sach username

## 16. Definition of Ready (DoR) cho coding

Coding duoc phep bat dau khi dat du 6 dieu kien:
1. Chot template v1 (3 portfolio x 3 sub-account).
2. Chot field UserConfig tracking seed.
3. Chot naming feature flags + default values.
4. Chot command options cho backfill.
5. Chot test matrix toi thieu (unit + integration).
6. Chot 4 tai lieu canonical da duoc cap nhat dong bo.