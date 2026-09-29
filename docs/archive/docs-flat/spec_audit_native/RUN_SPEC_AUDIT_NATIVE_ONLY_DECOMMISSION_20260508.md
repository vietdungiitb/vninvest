# RUN SPEC AUDIT - Native-Only Decommission

**Ngay**: 2026-05-08

---

## 1. Audit purpose

Spec audit xac nhan branch nay dang dong bo voi muc tieu native-only, khong co request path nao con phu thuoc vao bridge cu.

---

## 2. Audit checklist

1. Route inventory trong traceability matrix phai khop voi code hien tai.
2. `legacy_proxy.py` phai bi xoa hoac khong con import duoc.
3. `compat_*` runtime mounts phai khong con ton tai.
4. Production compose phai khong con env legacy bridge.
5. Evidence template va audit ledger phai co entry cho tung slice.

---

## 3. Recommended audit commands

- `grep_search` hoac `rg` for `legacy_proxy_view|compat_.*urls|LEGACY_BACKEND_URL|LEGACY_DATABASE_URL`
- URL resolver checks for active `/api/*` routes
- Frontend smoke against bootstrap endpoints
- Production container config diff review

---

## 4. Audit outcome categories

- PASS: No active proxy path, no compat mount, no legacy config.
- PASS_WITH_RISK: Native route exists but needs one more consumer migration.
- FAIL: Any active request can still fall through to proxy or legacy backend.
