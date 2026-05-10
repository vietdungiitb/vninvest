# IMPLEMENTATION PLAN - Native-Only Decommission

**Ngay**: 2026-05-08  
**Status**: APPROVED - READY FOR EXECUTION  
**Scope**: Remove hybrid bridge, remove proxy fallback, keep only native core-api routes

---

## 1. Objective

Loai bo hybrid bridge de production chi con mot mo hinh:

1. Core-api la runtime duy nhat cho HTTP APIs.
2. Moi `/api/*` route active deu co native owner.
3. Khong con request nao di qua catch-all proxy.
4. Legacy backend khong con la fallback path trong production.

---

## 2. Execution phases

### Phase N0 - Live runtime stabilization

Muc tieu:

1. Gom tat ca blocker runtime thuc te sau native-only cutover vao mot slice handoff ro rang.
2. Chuyen `stocks/:symbol`, `admin/core/overview`, `support`, `dashboard`, `transactions` va `whale-alerts` tu trang thai co crash/404 sang trang thai contract ro rang.
3. Dung audit evidence live lam baseline truoc khi phan cong cho team code.

Deliverables:

1. Evidence note [NATIVE_ONLY_RUNTIME_AUDIT_EVIDENCE_20260508.md](NATIVE_ONLY_RUNTIME_AUDIT_EVIDENCE_20260508.md).
2. Taskboard phase N0 cho stock detail, admin-core overview, support va empty-state stabilization.
3. Traceability mapping cho cac blocker runtime.

Exit criteria:

1. `stocks/VCB` khong con JS crash.
2. `admin/core/overview` khong con 404 to advertised route.
3. Support/dashboard/transactions/whale-alerts deu render duoc empty state hop le, khong crash.
4. Audit ledger va progress dashboard da dong bo sau moi slice.

### Phase N1 - Route inventory lock

Muc tieu:

1. Chot danh sach route con lai dang đi qua compat bridge.
2. Freeze new compat additions.
3. Tao mapping route -> native owner -> test -> evidence.

Deliverables:

1. Inventory table trong taskboard.
2. Traceability matrix mapping route families to owners.
3. Baseline smoke test snapshot.

### Phase N2 - Native route promotion

Muc tieu:

1. Move auth/partner routes from compat bridge into native app URLConfs.
2. Move workspace/portfolio routes into `user_workspace` native URLs only.
3. Move stock-management and legal-content bootstrap routes into native owners.

Exit criteria:

1. Each route family has at least one native test suite passing.
2. No new route hits legacy proxy during smoke test.

### Phase N3 - Client contract stabilization

Muc tieu:

1. Ensure frontend callers still receive the same shape or a documented stable shape.
2. Remove consumer assumptions about compat envelopes where possible.
3. Keep `/api/*` URL contract stable during migration.

Exit criteria:

1. Production browser reload has no API 5xx.
2. Network traces show no call to legacy proxy.

### Phase N4 - Delete compat wrappers

Muc tieu:

1. Remove compat route files after native route coverage is complete.
2. Remove `CompatPublicLegalPagesView`, `CompatTrackedSymbolsView`, and similar shims.
3. Update tests to target native route modules.

Exit criteria:

1. `grep` no longer finds active runtime usage of `compat_*` route modules.

### Phase N5 - Remove proxy fallback

Muc tieu:

1. Delete `legacy_proxy.py`.
2. Remove catch-all route from `vninvest_core/urls.py`.
3. Remove legacy env hooks from compose and production env files.

Exit criteria:

1. `resolve()` on active `/api/*` routes never lands in proxy.
2. No request path can route to a generic fallback proxy.

### Phase N6 - Legacy decommission

Muc tieu:

1. Stop/remove legacy backend services.
2. Remove any stale docs or comments that instruct bridge usage.
3. Archive decommission evidence.

Exit criteria:

1. Legacy runtime not part of normal production operation.
2. Soak period passes with zero proxy hits.

---

## 3. Order of execution

Recommended order:

1. Auth / partner
2. Portfolio / workspace
3. Market / realtime
4. Market data / stock management
5. Public legal content
6. Proxy removal
7. Legacy decommission

Reasoning: auth and portfolio are highest blast radius; market/realtime and market-data are high-traffic; public legal content is low-risk and should not block proxy removal once native owner is in place.

---

## 4. Gate rules

1. No proxy deletion until route inventory shows zero remaining consumer on compat-only paths.
2. No compat removal until route family passes focused regression tests.
3. No decommission until browser smoke and container smoke pass after proxy removal.

---

## 5. Rollback

Rollback is allowed only before proxy deletion. After proxy deletion, rollback means reverting the last clean commit and re-publishing images; legacy backend should not be used as a fallback.

---

## 6. Definition of done

1. `legacy_proxy_view` removed.
2. `compat_*` runtime routes removed.
3. `LEGACY_BACKEND_URL` removed from prod compose.
4. Browser production reload has no 5xx.
5. Audit ledger and progress dashboard updated.
