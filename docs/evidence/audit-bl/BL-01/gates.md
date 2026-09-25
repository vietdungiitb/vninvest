# BL-01 gates — SAML fail-closed (PARTIAL; BL-01b còn lại) (2026-09-24)

## Change (fail-closed, không đụng crypto)
- `saml_service.py`: default mode → **strict ở prod**, noop chỉ khi `DJANGO_DEBUG=true`/test-runner/explicit (`_default_signature_mode()`); unknown value → strict (trước: noop); strict đòi Signature element + cert, thiếu → `SAMLSignatureError` (trước: unsigned lọt).
- `requirements.txt`: +`python3-saml>=1.15,<2.0`. `Dockerfile`: builder +`pkg-config libxmlsec1-dev`, runtime +`xmlsec1`.
- New `identity_access/tests/test_saml_signature_mode.py`: 7 tests (default prod/debug/unknown/explicit/override + strict-reject unsigned + noop-pass).

## Gates
- `manage.py test identity_access.tests.test_saml_signature_mode identity_access.tests.test_saml_sso`: **Ran 48 tests OK** (7 mới + 41 cũ, không regression).
- `manage.py check`: 0. `npx tsc --noEmit`: 0 (FE untouched, re-verify).
- Pre-fix repro: default cũ luôn noop (đọc code `:39` cũ) — unsigned pass im lặng.

## Còn lại → BL-01b (1–2w, cần image build có token + tích hợp OneLogin verify)
- Real cryptographic verification trong `_verify_signature` (hiện strict raise unconditional — fail-closed, SSO prod sẽ từ chối cho tới khi xong BL-01b).
- Build image + test vector ký thật/giả + e2e SSO. Image build blocked ở đây (cần `VNBROKER_GITHUB_TOKEN` secret).

## DoD tick
- [x] strict default prod · [x] unsigned reject · [x] 48 tests OK · [ ] real crypto (BL-01b) · [ ] image build (blocked secret).
