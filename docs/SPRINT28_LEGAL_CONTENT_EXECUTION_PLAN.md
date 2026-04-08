# Sprint 28 - Legal Content (Gioi thieu + Tuyen bo trach nhiem)

Status: PLANNED  
Owner chinh: BE Lead + FE Lead  
Ngay tao: 2026-04-08

## 1) Muc tieu sprint

Trien khai tinh nang legal content de:
- User chua dang nhap co the doc Gioi thieu va Tuyen bo trach nhiem truoc khi dang ky.
- User da dang nhap co the doc lai 2 noi dung nay trong menu nguoi dung.
- Noi dung duoc quan tri truc tiep tren Django Admin (khong can deploy lai).

## 2) Pham vi va ket qua can giao

In-scope:
- Tao CMS nho cho legal content trong backend.
- Tao API public de frontend lay legal content.
- Hien thi legal content o login/register.
- Hien thi legal content trong menu nguoi dung sau dang nhap.
- Ho tro locale vi/en + fallback.
- Test backend + smoke test frontend.

Out-of-scope:
- Consent checkbox bat buoc trong form dang ky (de xep Sprint tiep theo neu can compliance).
- Legal e-sign/audit acceptance version theo tung user.

## 3) Kien truc de xuat

Backend:
- Model LegalPage (slug, locale, title, summary, content_markdown, is_active, version, published_at, updated_by).
- Rule: moi cap slug+locale chi co 1 ban active.
- API public: GET /api/public/legal-pages/ (hoac endpoint chi tiet theo slug).
- Permission: AllowAny.

Frontend:
- LoginModal: them khu vuc doc nhanh legal content (modal/drawer).
- User menu/Layout: them 2 muc legal content.
- Them route legal pages de user da dang nhap doc lai.

## 4) Work breakdown theo milestone

### M1 - Schema + Admin foundation (0.75 ngay)
- S28-01: Tao model LegalPage + migration.
- S28-02: Register Django Admin + list/filter/search + active action.
- S28-03: Seed ban noi dung mac dinh vi/en cho 2 slug (about, disclaimer).

Done when:
- Migration chay pass.
- Admin tao/sua/active content duoc.
- Chi ton tai 1 ban active cho moi slug+locale.

### M2 - Public API legal content (0.5 ngay)
- S28-04: Tao serializer + API view public.
- S28-05: Them locale fallback logic (uu tien locale yeu cau, fallback vi).
- S28-06: Mount route /api/public/legal-pages/*.

Done when:
- Goi API khong can auth.
- Response co title, summary, content, version, updated_at.
- Co fallback khi locale khong ton tai.

### M3 - Frontend truoc dang ky (0.75 ngay)
- S28-07: Tao API client cho legal pages.
- S28-08: Tich hop vao LoginModal (dang nhap/dang ky deu doc duoc).
- S28-09: UX loading/error/retry.

Done when:
- User o /login doc duoc 2 noi dung truoc dang ky.
- Khong pha vo luong register/login hien tai.

### M4 - Frontend sau dang nhap (0.5 ngay)
- S28-10: Them 2 muc legal trong Layout/menu nguoi dung.
- S28-11: Them legal routes + page render reusable.

Done when:
- User da dang nhap vao duoc 2 trang legal tu menu.
- Route hoat dong tren desktop + mobile.

### M5 - i18n + polish (0.25 ngay)
- S28-12: Bo sung text vi/en cho legal labels, button, loading, empty state.
- S28-13: Chinh giao dien de noi dung dai van de doc.

### M6 - Testing + QA gate (0.75 ngay)
- S28-14: Unit/API test backend cho legal endpoints va fallback.
- S28-15: Smoke test frontend login + user menu + language switch.

### M7 - Rollout + docs (0.25 ngay)
- S28-16: Cap nhat board/checklist/roadmap.
- S28-17: Chot go/no-go va rollback note.

## 5) File-level implementation map

Backend:
- backend/portfolio/models.py
- backend/portfolio/admin.py
- backend/portfolio/views.py hoac tao file legal_views.py
- backend/config/urls.py
- backend/portfolio/tests/test_api_routes.py (hoac test file legal rieng)

Frontend:
- frontend/src/api/client.js hoac frontend/src/api/auth.js
- frontend/src/components/LoginModal.jsx
- frontend/src/components/Layout.jsx
- frontend/src/App.jsx
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js

## 6) Risk va giai phap

R1 - Legal content rong/chua publish:
- Giai phap: fallback noi dung mac dinh + canh bao trong admin.

R2 - API public bi cache stale:
- Giai phap: set TTL ngan + ETag neu can.

R3 - UI login bi roi vi noi dung dai:
- Giai phap: su dung modal/drawer va gioi han chieu cao + scroll.

R4 - Xung dot voi auth flow hien tai:
- Giai phap: legal fetch fail-soft, khong block submit login/register.

## 7) Acceptance gate

Gate A - Functional:
- [ ] Co 2 legal pages (about/disclaimer) sua duoc tren admin.
- [ ] Xem duoc legal content truoc dang ky.
- [ ] Xem duoc legal content sau dang nhap trong menu.

Gate B - Quality:
- [ ] Backend tests pass.
- [ ] Frontend build pass.
- [ ] Smoke test pass tren mobile + desktop.

Gate C - Operability:
- [ ] Co rollback huong dan de tat legal links neu co su co.
- [ ] Co owner theo doi sau release 24h.

## 8) Timeline de xuat

Tong effort: 3.5-4.0 ngay cong.
- Day 1: M1 + M2
- Day 2: M3 + M4
- Day 3: M5 + M6
- Day 4 (neu can): hardening + release evidence

## 9) Nguoi phu trach de xuat

- PM: Theo doi board, chap nhan scope, sign-off.
- BE: Model/Admin/API/Test backend.
- FE: Login/Layout/Route/i18n.
- QA: Smoke + regression auth flow.
