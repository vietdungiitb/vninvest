# Handoff — P3.4 license passthrough + nghiên cứu rào cản (2026-11-10)

**Slice:** `feat/p34-license` (PR #338 code + #340 closeout MERGED). Ledger Entry 445.

## Quyết định (Owner ủy quyền)
- App-side: `licenseKey`/`onLicenseDiagnostic` passthrough (optional, undefined-safe).
- KHÔNG `registerProExtension` / `tenantPat` / `client` / đụng BE.
- App-tier (Entry 444) giữ nguyên, cộng gộp với license channel.

## Phát hiện quan trọng (nghiên cứu)
Key vnsaas cấp KHÔNG verify được trong widget hiện tại — 2 chốt độc lập:
1. kid `primary` vs embedded `["prod-2026-10-17","e2e-2026-10-31","prod-2026-11-09"]`.
2. product `vninvestcharts_widget` vs `LICENSE_PRODUCT "vninvestcharts"`.
Cần Owner quyết hướng (A) server ký kid+p tương thích / (B) widget chấp nhận alias + republish / (C) cấp public JWK (chỉ gỡ chốt kid).

## Đã làm
- Code passthrough + S8/S9 (secret-guard) RED→GREEN 13/13; tsc 0; build OK; gates PASS.
- Deploy staging PASS. Live: free-path unchanged + garbage-key fail-closed êm, 0 pageerror mới.
- Dọn staging: 2 rows probe đã revoke (204); key gốc giữ nguyên. Không commit secrets.
- B3 NEED_REVISION×2 → sửa hết; B8 PASS.

## Còn nợ
- Pro-path E2E (blocked — chờ Owner gỡ rào kid/product).
- Tenant subscription pro test cho app-tier panels; E2E full.
