# RUN CODE REVIEW - Native-Only Decommission

**Ngay**: 2026-05-08

---

## 1. Review goal

Muc tieu cua code review la tim ra moi noi co the lam hybrid quay lai:

1. Runtime route con tro ve proxy.
2. Compat wrapper con duoc mount trong URLConf.
3. Production config con legacy fallback.
4. Frontend/client con hard-code assumptions ve compat-only shapes ma khong co native contract.

---

## 2. Review checklist

- [ ] Khong con `legacy_proxy_view` trong runtime URLConf.
- [ ] Khong con `api/<path:remaining>` catch-all route.
- [ ] Khong con active import cua `compat_*.py` trong URLConf runtime.
- [ ] `LEGACY_BACKEND_URL` va `LEGACY_DATABASE_URL` da bi remove khoi production compose.
- [ ] Native route owner da co tests cover.
- [ ] Client contract da duoc document neu shape thay doi.
- [ ] Khong co request body logging trong bridge/proxy code.
- [ ] Audit ledger va progress dashboard da duoc cap nhat.

---

## 3. Red flags

1. A route still exists only because of a bridge file.
2. A proxy deletion is blocked by a consumer that never got migrated.
3. A config file still keeps a silent path to legacy backend.
4. A docs change says "temporary" but has no removal criterion.
