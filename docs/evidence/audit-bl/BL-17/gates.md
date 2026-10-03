# BL-17 gates — MFA verify + rotation (2026-09-24)

## Verify
- Grep MFA (`totp|hotp|pyotp|qrcode|two-factor|2fa|backup-codes|webauthn|passkey`) BE + FE: **0 hits** → MFA absent (Fact, không phải Absence mơ hồ).
- Decision: accepted-risk + roadmap TOTP staff-first (trong `docs/SECURITY_SECRET_ROTATION_20260924.md`).

## Change
- New `docs/SECURITY_SECRET_ROTATION_20260924.md`: cadence quý + quy trình canary + ma trận impact 6 secrets (đặc biệt SECRET_KEY logout toàn bộ, PAT_PEPPER reissue, DB password thứ tự restart).

## DoD tick
- [x] MFA existence verdict bằng grep · [x] rotation runbook + cadence + owner (DevOps) · [ ] drill xoay 1 secret thật (lên lịch cùng BL-04 monthly drill).
