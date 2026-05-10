# SELF AUDIT AND TEST PROTOCOL - Native-Only Decommission

**Ngay**: 2026-05-08

---

## 1. Goal

Protocol nay bat buoc moi slice phai chung minh 3 dieu:

1. Route da chuyen sang native owner.
2. Khong con request di qua legacy proxy.
3. Evidence va audit trail dong bo voi code change.

---

## 2. Mandatory checks for every slice

### Before edit

1. Xac dinh file neo gan nhat.
2. Xac dinh route family va native owner.
3. Ghi mot hypothesis falsifiable ve where the behavior lives.

### After first substantive edit

1. Chay focused validation ngay.
2. Neu validation fail, repair cung slice truoc khi mo rong.
3. Khong di sang broad refactor neu chang can cho gate hien tai.

### Before marking complete

1. Update `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
2. Update `PROGRESS_DASHBOARD.md`.
3. Attach evidence template.
4. Confirm production or local smoke.

### N0 - Live runtime stabilization

For the runtime blocker slices, add these checks before marking a task done:

1. Open the affected browser route in a clean tab and capture the page body text.
2. Confirm `stocks/VCB` does not throw `Failed to fetch valid analytics snapshot` or `slice` TypeError after the fix.
3. Confirm `/admin/core/overview` no longer returns a browser 404 for the advertised surface.
4. Confirm `/support`, `/dashboard`, `/transactions`, and `/whale-alerts` do not emit new console errors when rendering their empty or degraded states.
5. Update [docs/NATIVE_ONLY_RUNTIME_AUDIT_EVIDENCE_20260508.md](NATIVE_ONLY_RUNTIME_AUDIT_EVIDENCE_20260508.md) with the live result.

---

## 3. Phase-specific test gates

### N1 - Inventory lock

- Confirm active route inventory is complete.
- Confirm there is no new compat surface added in the same slice.

### N2 - Native promotion

- Run focused backend tests for the touched domain.
- Resolve the promoted routes and confirm they hit native view classes.

### N3 - Client stabilization

- Run frontend build.
- Open bootstrap screens and confirm no console errors or promise rejections.

### N4 - Compat removal

- Grep for active runtime references to the removed compat file.
- Confirm route resolver no longer imports the compat wrapper.

### N5 - Proxy removal

- Resolve all active `/api/*` routes and confirm none hit `legacy_proxy_view`.
- Confirm `legacy_proxy.py` is absent or no longer imported.

### N6 - Legacy decommission

- Confirm prod compose no longer exposes legacy env hooks.
- Run browser smoke on production after rebuild/pull.

### N0 cheap disconfirming checks

1. `/stocks/VCB` still logs `Cannot read properties of undefined (reading 'slice')` -> the slice is incomplete.
2. `/admin/core/overview` still shows a browser 404 -> the route contract is still missing.
3. `/support` still shows only a generic technical failure -> the empty/error state contract is not stabilized.
4. `/dashboard` or `/transactions` still crash on empty data -> the bootstrap contract is not stable.

---

## 4. Cheap disconfirming checks

1. `resolve('/api/portfolio/portfolios/')` still lands in proxy -> slice is incomplete.
2. `grep` still finds `legacy_proxy_view` in runtime URLConfs -> proxy removal not done.
3. Browser bootstrap console reports 502 -> compat removal or native route migration not done.
4. Production compose still contains `LEGACY_BACKEND_URL` -> decommission not done.

---

## 5. Required evidence per slice

1. File list.
2. Validation commands and result.
3. Route resolver proof.
4. Browser or screenshot proof when UI touched.
5. Residual risk note if any.
