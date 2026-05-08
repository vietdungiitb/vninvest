# HANDOFF MASTER - Native-Only Decommission: Xoa hoan toan hybrid bridge va legacy fallback

**Ngay**: 2026-05-08  
**Trang thai**: READY FOR TEAM EXECUTION  
**Pham vi**: Loai bo catch-all proxy, compat bridge va legacy fallback de de core-api tro thanh duong chay duy nhat cua production

---

## 1. Muc tieu

Muc tieu cua go tai lieu nay la dua VNInvest ve trang thai **native-only**:

1. Khong con bat ky request nao phu thuoc vao `legacy_proxy_view`.
2. Khong con route catch-all `/api/<path:remaining>` trong runtime production.
3. Khong con `compat_*` route files la duong chay san xuat.
4. Khong con legacy backend la fallback an toan hay backup am tham.
5. Moi `/api/*` con lai phai duoc phuc vu boi native app/URLConf trong core-api.

Tai lieu nay ke thua trang thai sau cac slice da hoan tat: auth/tenant, portfolio/workspace, market/realtime va tenant admin da chay tren GHCR native images; phan con lai la cleanup de xoa nốt hybrid bridge.

---

## 2. Current state

Production hien tai:

1. Core-api da duoc pull tu GHCR va chay tren host production.
2. `LEGACY_BACKEND_URL` trong compose production dang rong, nen khong co live target legacy backend.
3. Tuy nhien, codebase van con:
   - catch-all proxy route trong [packages/core/backend/src/vninvest_core/urls.py](../packages/core/backend/src/vninvest_core/urls.py#L23-L32)
   - transparent proxy trong [packages/core/backend/src/vninvest_core/legacy_proxy.py](../packages/core/backend/src/vninvest_core/legacy_proxy.py#L1-L45)
   - compat route files cho auth, portfolio/workspace, market/realtime va market-data
4. Nghia la production da native-first, nhung chua native-only.

---

## 3. Target state

Sau khi hoan tat, phai dat:

1. `vninvest_core/urls.py` khong con import hay route `legacy_proxy_view`.
2. `vninvest_core/legacy_proxy.py` bi xoa khoi repo.
3. `compat_*.py` khong con duoc import trong runtime routes.
4. Public/legal pages, tracked-symbol bootstrap, portfolio/workspace va auth/partner flow deu di vao native app URLConfs.
5. `docker-compose.ghcr.yml` khong con env/service legacy related cho production runtime.
6. Legacy backend co the bi decommission hoan toan ma khong lam hoi sinh request path nao.

---

## 4. Bundle files

### Triad bat buoc
1. `docs/IMPLEMENTATION_PLAN_NATIVE_ONLY_DECOMMISSION_20260508.md`
2. `docs/TECH_SPEC_NATIVE_ONLY_DECOMMISSION_20260508.md`
3. `docs/TASKBOARD_NATIVE_ONLY_DECOMMISSION_20260508.md`

### Audit va thuc thi
4. `docs/NATIVE_ONLY_DECOMMISSION_HANDOFF_MASTER_20260508.md`  
5. `docs/NATIVE_ONLY_DECOMMISSION_TRACEABILITY_MATRIX_20260508.md`
6. `docs/NATIVE_ONLY_DECOMMISSION_SELF_AUDIT_AND_TEST_PROTOCOL_20260508.md`
7. `docs/NATIVE_ONLY_DECOMMISSION_EXECUTION_EVIDENCE_TEMPLATE_20260508.md`
8. `docs/NATIVE_ONLY_DECOMMISSION_CONFIG_OWNERSHIP_MATRIX_20260508.md`
9. `docs/NATIVE_ONLY_DECOMMISSION_CODE_QUALITY_CONSTITUTION_20260508.md`
10. `docs/RUN_CODE_REVIEW_NATIVE_ONLY_DECOMMISSION_20260508.md`
11. `docs/RUN_INTEGRATION_TESTS_NATIVE_ONLY_DECOMMISSION_20260508.md`
12. `docs/RUN_SPEC_AUDIT_NATIVE_ONLY_DECOMMISSION_20260508.md`

### Tai lieu ke thua
1. `docs/SAAS_FULL_INDEPENDENCE_HANDOFF_MASTER_20260504.md` - baseline cu, doc de cache hybrid bridge
2. `docs/SAAS_FULL_INDEPENDENCE_*_20260504.md` - tham chieu cho cutover, validation va decommission gate cu
3. `docs/SM-P6-DECOMMISSION-RUNBOOK.md` - runbook decommission legacy root sau khi native-only xong

---

## 5. Route inventory con lai can xoa

### 5.1 Route group that can no longer stay as compat bridge

| Group | Current compat surface | Target native home |
|---|---|---|
| Auth / partner / tenant | `identity_access.compat_urls.py` | `identity_access.urls` and `identity_access.partner_urls` direct native mounts |
| Portfolio / workspace | `user_workspace.compat_urls.py` and `vninvest_core.compat_portfolio.py` | `user_workspace.urls` direct native routes |
| Realtime / market | `market_serving.compat_urls.py`, `signal_intelligence.compat_urls.py` | native app URLConfs in owning domains |
| Market data / stock management | `market_data.compat_urls.py` plus bootstrap shims in `compat_portfolio.py` | `market_data.urls` direct native routes |
| Public legal content | `CompatPublicLegalPagesView` | a small native content route in the owning core app |
| Tracked symbols bootstrap | `CompatTrackedSymbolsView` | `market_data` native route or owning stock-management app route |

### 5.2 Runtime proxy to delete

| Item | File | Action |
|---|---|---|
| Catch-all proxy route | `vninvest_core/urls.py` | remove |
| Transparent proxy implementation | `vninvest_core/legacy_proxy.py` | delete |
| Legacy env hooks | `docker-compose.ghcr.yml`, dev/prod compose overlays | remove |

---

## 6. Rules for team execution

1. Khong them route compat moi trong slice native-only.
2. Khi mot endpoint da co native owner, route compat cu phai bi giai tan ngay sau khi consumer migrate xong.
3. Moi slice phai co focused validation ngay sau edit dau tien.
4. Neu mot request con hit proxy, do la blocker, khong phai backup.
5. Moi thay doi phai cap nhat `docs/CODE_CHANGE_AUDIT_LEDGER.md` va `PROGRESS_DASHBOARD.md`.
6. Khong de lai cach quay ve legacy backend trong production env sau decommission.

---

## 7. Acceptance criteria

Native-only chi dat khi tat ca dieu kien sau PASS:

1. Browser production khong con bat ky 5xx/502 nao chay qua proxy fallback.
2. `resolve()` trong core-api khong con tra ve `legacy_proxy_view` cho bat ky `/api/*` route dang dung.
3. `compat_*` files khong con duoc import tu runtime URLConfs.
4. Compose production khong con env legacy va khong con service legacy la path van hanh.
5. Smoke test cho auth, tenant-admin, portfolio, realtime, market-data, legal content va tracked-symbol bootstrap deu PASS.

---

## 8. Working agreement

1. Doc tai lieu nay truoc khi bat dau slice moi.
2. Lam theo taskboard, khong hoc lai route inventory tung lan.
3. Sau moi slice, cap nhat evidence va audit ledger ngay.
4. Neu can quay lai legacy path, phai mo mot exception review; mac dinh la khong duoc.
