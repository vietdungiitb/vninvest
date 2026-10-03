# Sprint 28 Acceptance Checklist - Legal Content

Status: OPEN  
Sprint: 28  
Ngay cap nhat: 2026-04-08

## A. Backend schema + admin

- [ ] A1. Co model LegalPage trong backend/portfolio/models.py.
- [ ] A2. Co migration tao bang LegalPage va chay migrate thanh cong.
- [ ] A3. Co rang buoc 1 ban active cho moi slug+locale.
- [ ] A4. Django Admin hien thi legal pages voi list/filter/search.
- [ ] A5. Admin action active/deactive chay dung.

Evidence:
- [ ] Link changelist admin + screenshot (internal)
- [ ] Log migrate

## B. Public API

- [ ] B1. Co endpoint public legal pages (khong can JWT).
- [ ] B2. Endpoint tra du lieu day du: slug, locale, title, summary, content, version, updated_at.
- [ ] B3. Co fallback locale neu locale request khong ton tai.
- [ ] B4. Khi content chua publish, API fail-soft va co thong bao hop ly.

Evidence:
- [ ] API response mau cho about/disclaimer vi/en
- [ ] Test case fallback locale

## C. Frontend truoc dang ky

- [ ] C1. Login page hien thi duong dan/mo modal doc Gioi thieu.
- [ ] C2. Login page hien thi duong dan/mo modal doc Tuyen bo trach nhiem.
- [ ] C3. User co the doc noi dung truoc khi dang ky.
- [ ] C4. Loi tai legal content khong chan login/register submit.

Evidence:
- [ ] Video smoke test luong /login

## D. Frontend sau dang nhap

- [ ] D1. Menu nguoi dung co 2 muc legal content.
- [ ] D2. Route legal pages render duoc sau dang nhap.
- [ ] D3. Chuyen ngon ngu vi/en cap nhat dung noi dung.
- [ ] D4. Hien thi tot tren mobile va desktop.

Evidence:
- [ ] Screenshot desktop
- [ ] Screenshot mobile

## E. Test va quality gate

- [ ] E1. Unit/API test backend pass.
- [ ] E2. Frontend build pass.
- [ ] E3. Regression auth flow pass (register/login/verify email).
- [ ] E4. Khong co blocker P0/P1 truoc deploy.

Evidence:
- [ ] Test output
- [ ] Build output

## F. Release readiness

- [ ] F1. Roadmap + board + taskboard da cap nhat.
- [ ] F2. Rollback note da chot.
- [ ] F3. Owner on-call 24h sau release da chi dinh.
- [ ] F4. PM/BE/FE/QA sign-off.

## G. Go/No-Go

- [ ] GO du dieu kien deploy
- [ ] NO-GO (neu co, ghi ro ly do)

Comment closure:
- 
