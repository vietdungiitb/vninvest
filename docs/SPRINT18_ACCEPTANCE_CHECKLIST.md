# Sprint 18 Acceptance Checklist — Django Admin Google Mail OAuth2

**Sprint**: 18  
**Ngay lap**: 2026-04-04  
**Trang thai**: CODE COMPLETE — 19/19 tests PASS — cho canary staging + sign-off

---

## A. Data Model & Migration

- [x] Co field `auth_type` tren `SystemEmailAccount` (`smtp_password|google_oauth2`).
- [x] Co field OAuth2 metadata va token ciphertext cho Google.
- [x] Migration apply thanh cong tren DB hien tai, khong mat du lieu SMTP cu.
- [x] Validation model dung cho ca hai flow SMTP/OAuth2.

## B. Security

- [x] Client secret va refresh token duoc luu encrypted/signed.
- [x] Khong log plaintext token/secret.
- [x] OAuth callback co state/nonce validation.
- [x] Chi superuser/staff duoc cap quyen thao tac OAuth connect/revoke.

## C. Admin UX

- [x] Trang admin `SystemEmailAccount` co action `Connect Google`.
- [x] Co callback route xu ly OAuth code thanh cong/that bai ro rang.
- [x] Co action `Revoke Google Token`.
- [x] Co action `Send test email` voi account duoc chon.
- [x] Co badge status token: connected, refreshed_at, last_error.

## D. Mail Service Integration

- [x] `send_system_email` branch theo `auth_type`.
- [x] Account SMTP legacy van gui mail dung nhu truoc.
- [x] Account Google OAuth2 gui mail thanh cong qua Gmail API.
- [x] Token refresh duoc xu ly tu dong truoc khi gui.
- [x] Mapping loi Gmail API -> message van hanh de hieu.

## E. Test Coverage

- [x] Unit test model methods set/get token encrypted pass.
- [x] Unit test OAuth callback state validation pass.
- [x] Unit test token refresh service pass. (GoogleOAuthServiceTests: 4 tests)
- [x] Integration test send test email qua OAuth2 pass (mock HTTP).
- [x] Regression test email verification flow pass. (EmailVerificationRegressionTests: 2 tests)

## F. Operations & Rollout

- [x] Runbook cap nhat cho cau hinh Google mail account.
- [ ] Co rollback plan ve SMTP legacy.
- [ ] Co canary rollout tren 1 account truoc khi mo rong.
- [ ] Monitoring sau release 24-48h khong co P0/P1 incident.

## G. Sign-off

- [ ] BE Lead sign-off
- [ ] QA sign-off
- [ ] DevOps sign-off
- [ ] PM/BA sign-off
