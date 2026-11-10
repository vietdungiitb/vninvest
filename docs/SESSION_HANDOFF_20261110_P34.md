# Handoff — P3.4 app-side tier gating (2026-11-10)

**Slice:** `feat/p34-tier` (PR #336 MERGED). Ledger Entry 444.

## Quyết định (Owner ủy quyền)
- Source-of-truth: `Subscription.plan` qua `GET /billing/subscription` (có sẵn).
- Mapping: enterprise/internal/custom → enterprise; pro → pro; còn lại + 403/thiếu sub/status xấu → free.
- KHÔNG `registerProExtension` (chưa có key vni1.*). KHÔNG `tenantPat`/`client` (envelope mismatch + thiếu client → widget-internal tier không chạy).

## Đã làm
- `useTenantTier.js` + test mapping 5/5; panel wiring; S8 source-scan.
- 12/12 PASS, tsc 0, build OK, check-multi-agent PASS.
- Deploy staging PASS. Live: admin tenant chưa có subscription row (404 → free đúng); chart OK, 0 console error mới.
- B3 NEED_REVISION→sửa→B8 PASS (độc lập).

## Còn nợ
- Pro-path live verify (cần BE tạo subscription pro test trên staging).
- `registerProExtension` khi Owner phát hành key vni1.*.
- Envelope BE/widget thống nhất nếu muốn widget-internal gating.
- E2E full.
