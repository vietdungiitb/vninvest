# HOTFIX LOG 2026-04-08: Admin, Auth, i18n

## 1) Muc tieu
Tong hop toan bo thay doi da thuc hien trong ngay de:
- Truy vet nguyen nhan su co nhanh
- Doi chieu commit/deploy branch
- Co runbook rollback va kiem tra sau deploy

## 2) Pham vi van de da xu ly

### 2.1 Admin menu khong hien Onboarding Policy/Plan Log
Trieu chung:
- Da truy cap truc tiep duoc URL admin model
- Nhung trang chu admin khong hien model trong menu

Nguyen nhan:
- Admin dang custom `admin.site.get_app_list`
- Danh sach model duoc group thu cong, bo sot `OnboardingPlanPolicy` va `PlanAssignmentLog`

Xu ly:
- Bo sung map ten hien thi cho 2 model
- Bo sung 2 model vao nhom `04. Cau hinh he thong`
- Them co che fallback: model nao cua app portfolio chua duoc group se vao nhom `99. Danh muc khac (tu dong)`
- Bo sung card lien ket tren trang admin index cho nhom cau hinh he thong

Anh huong:
- Menu admin index hien day du model
- Giam rui ro bo sot khi them model admin moi trong tuong lai

---

### 2.2 Tai khoan root khong dang nhap duoc frontend `/login`
Trieu chung:
- Dang nhap that bai o endpoint `/api/auth/token/`

Nguyen nhan:
- Logic JWT login chan tat ca tai khoan co `UserConfig.email_verified = false`
- Chan ca superuser

Xu ly:
- Cap nhat serializer login: superuser duoc bypass gate email verification
- User thuong van giu gate xac thuc email nhu cu
- Them regression test cho case superuser chua verify van dang nhap duoc

Anh huong:
- Tai khoan root/superuser dang nhap frontend duoc
- Khong anh huong policy verify email cho user thuong

---

### 2.3 Cac changelist admin vo bo cuc/lech phai/tran ngang
Trieu chung:
- Nhieu trang nhu `userconfig`, `onboardingplanpolicy`, `planassignmentlog`, `systememailaccount` bi tran bang, vo bo cuc
- Co thoi diem bi day lech toan bo content sang phai

Nguyen nhan:
- Bang co nhieu cot rong
- CSS custom can thiep layout container changelist qua manh, gay side effect

Xu ly cuoi cung (on dinh):
- Giu nguyen layout changelist mac dinh cua Django
- Chi them CSS overflow an toan cho khu vuc ket qua bang:
  - `.results` cho phep cuon ngang
  - `#result_list` giu du lieu day du, khong vo layout
  - O du lieu `th/td` giu `white-space: nowrap`
- Loai bo override container layout de tranh day lech phai

Anh huong:
- Cac trang list admin khong vo bo cuc
- Van xem duoc day du cot qua thanh cuon ngang

---

### 2.4 Dashboard hien key i18n tho `dashboard.syncPricesIdle`
Trieu chung:
- Frontend hien nguyen key `dashboard.syncPricesIdle` tren dashboard

Nguyen nhan:
- Key thieu trong dictionary `vi/en`
- He i18n custom khong ho tro `defaultValue` nhu i18next

Xu ly:
- Them key `dashboard.syncPricesIdle` vao ca `frontend/src/i18n/vi.js` va `frontend/src/i18n/en.js`

Anh huong:
- Dashboard hien text dung theo ngon ngu

## 3) Danh sach commit da push len nhanh deploy

1. `9e40dc46`
- Fix admin index menu to include onboarding policy and plan logs

2. `c4a6315e`
- Allow superuser login without email verification

3. `ee89a4e6`
- Fix global admin changelist overflow layout

4. `1c4fdd6b`
- Avoid admin list layout shift by removing container overrides

5. `b3b87012`
- Add missing dashboard syncPricesIdle translations

## 4) Files da tac dong (tom tat)

### Backend
- `backend/portfolio/admin.py`
- `backend/portfolio/auth_views.py`
- `backend/portfolio/tests/test_api_routes.py`
- `backend/templates/admin/index.html`
- `backend/templates/admin/base_site.html`

### Frontend
- `frontend/src/i18n/vi.js`
- `frontend/src/i18n/en.js`

## 5) Kiem tra sau deploy (smoke checklist)

1. Admin menu:
- `/admin/` phai thay:
  - Chinh sach onboarding trial
  - Nhat ky thay doi goi

2. Admin changelist layout:
- `/admin/portfolio/userconfig/`
- `/admin/portfolio/onboardingplanpolicy/`
- `/admin/portfolio/planassignmentlog/`
- `/admin/portfolio/systememailaccount/`

Ky vong:
- Khong tran vo khung
- Co cuon ngang neu bang rong
- Khong lech toan bo content sang phai

3. Login superuser frontend:
- `/login` dang nhap root
- Phai vao duoc dashboard

4. i18n dashboard:
- `/dashboard` khong con hien key tho `dashboard.syncPricesIdle`

## 6) Rollback nhanh (neu can)

Neu can rollback mot phan:
- Revert commit theo thu tu nguoc tren nhanh `deploy`
- Deploy lai

Lenh tham khao:
- `git revert b3b87012`
- `git revert 1c4fdd6b`
- `git revert ee89a4e6`
- `git revert c4a6315e`
- `git revert 9e40dc46`

## 7) Ghi chu van hanh

- Neu van gap sai lech giao dien admin sau deploy, uu tien kiem tra cache static/CDN va hard refresh.
- Neu root van khong dang nhap duoc, kiem tra lai DB production (co user root khong, password hash, is_active/is_staff/is_superuser).
- Khuyen nghi bo sung test e2e nho cho admin changelist overflow va i18n key ton tai de chan hoi quy.
