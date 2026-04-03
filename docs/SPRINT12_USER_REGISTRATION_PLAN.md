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