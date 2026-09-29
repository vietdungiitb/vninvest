# SAAS NATIVE PACKAGES WEB AUTH CUTOVER - HANDOFF MASTER

- Program: SAAS_NATIVE_PACKAGES_WEB_AUTH_CUTOVER
- Date stamp: 20260524
- Status: APPROVED FOR IMPLEMENTATION
- Scope: packages/web, packages/core

## 1) Muc tieu

Chuyen toan bo tinh nang frontend auth production (login, register, verify email, resend verification, reset password UI path) sang packages/web, loai bo phu thuoc runtime vao frontend legacy.

## 2) Van de da xac nhan

1. Auth route production hien con nam o frontend cu.
2. packages/web da co auth adapter mot phan (register/resend/verify) nhung chua co bo auth pages production day du.
3. Context auth o frontend cu dang gom state + redirect + token handling, gay overlap voi shell runtime moi.
4. Cutover chua co runbook gate ro rang nen de phat sinh hoi quy login flow.

## 3) Quyet dinh da khoa

1. Frontend auth production moi bat buoc nam trong packages/web.
2. Data-plane auth bat buoc qua coreApiAdapter; cam direct fetch auth trong page production.
3. Legacy frontend chi giu host tam trong giai doan chuyen tiep; sau gate se decommission.
4. Khong mo rong scope sang social login/OAuth moi trong chuong trinh nay.

## 4) Deliverables bat buoc

1. Public auth pages trong packages/web.
2. Route wiring va host integration tai shell app.
3. Auth runtime va token lifecycle dong nhat.
4. Regression tests + runbooks + evidence theo gate.

## 5) Dinh nghia thanh cong

1. Nguoi dung thao tac login/register/verify/resend/reset tren UI moi tu packages/web.
2. Route auth cu o frontend legacy khong con la source of truth.
3. E2E path register -> verify -> login -> refresh -> logout pass.
4. Gate review, integration test, spec audit deu pass va co evidence.

## 6) Constraint va hard rules

1. Tuan thu AGENTS: feature moi chi o packages/core + packages/web.
2. Text UI auth moi phai co i18n tieng Viet day du dau.
3. Khong doi API contract backend ngoai pham vi can thiet cho cutover.
4. Khong merge neu chua pass runbooks trong pack nay.
