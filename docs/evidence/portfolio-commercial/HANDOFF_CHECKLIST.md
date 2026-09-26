# HANDOFF CHECKLIST — Portfolio Commercial Hardening

**Plan nguồn:** `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` (**Rev.2** — 52 slice / 9 wave / ~192-251 ed)
**Audit nguồn:** `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` (36 finding ID; map đầy đủ ở plan §17.5)
**Baseline:** branch `dev`, HEAD `8b479d24` (working tree có WIP AI Advisory — không revert).

Checklist này là **mẫu bàn giao cho từng slice**. Không đóng slice nếu ô chưa tick hoặc bằng chứng chưa lưu.

Quy ước bắt buộc khi chạy lệnh (chi tiết ở plan §5.4):
- Backend test của `user_workspace` là **flat `test_*.py`** (dotted path `user_workspace.test_x`); **cấm** tạo `src/user_workspace/tests/` vì `tests.py` đã tồn tại.
- Lệnh Django trên **host** dùng `python manage.py` (cwd `packages/core/backend`); chỉ trong container mới `python src/manage.py`.
- Celery app là `vninvest_core` (`celery -A vninvest_core`), không phải `config`.

---

## 0. Quy tắc sử dụng

1. Copy mẫu `## Slice <ID>` vào `docs/evidence/portfolio-commercial/wave-N-<name>/<slice-id>.md` cho mỗi slice.
2. Điền manifest (commit SHA, image digest, migration version, vnbroker SHA, tên env — **không** ghi giá trị secret).
3. Chạy gate, dán **toàn bộ** stdout/stderr + exit code vào `commands.log` (không truncate).
4. Bắn ảnh/screenshot authenticated cho UI (VI/EN × light/dark × desktop/tablet/mobile).
5. Ký `signoff.md` theo vai trò.

---

## 1. Mẫu slice

```markdown
## Slice <ID> — <tên>

- **Owner:** <vai trò>
- **Reviewer:** <vai trò>
- **Estimate:** <n> ed
- **Depends on:** <slice-id> (commit <sha>)
- **Plan reference:** §7 <ID>
- **Audit findings closed:** <IDs>

### Files touched
- path:line — thay đổi gì

### Requirements (D-xx liên quan)
- [ ] D-xx ...
- [ ] ...

### Acceptance criteria
- [ ] AC-1 Given ... When ... Then ... (kèm expected value/state)
- [ ] AC-2 ...

### Tests
- [ ] Unit: <test name> — expected
- [ ] Integration: <test name> — expected
- [ ] Negative/adversarial: <test name> — expected
- [ ] Regression: <suite> — expected

### Migration (nếu có)
- [ ] expand applied
- [ ] backfill count/checksum trước–sau
- [ ] idempotent (chạy 2 lần)
- [ ] reverse rehearsal trên clone
- [ ] quarantine report (nếu ambiguous)

### Security
- [ ] không secret/token/PII trong log/response/DOM/evidence
- [ ] tenant scope đúng
- [ ] capability đúng
- [ ] audit event ghi (kể cả rejected)
- [ ] idempotency nếu là write tài chính
- [ ] kill-switch đúng scope

### Gates (exit code + thời gian)
```
<command>  # exit 0
```

### Evidence
- [ ] manifest.json
- [ ] commands.log (đầy đủ)
- [ ] test names + kết quả
- [ ] api/ (đã redact)
- [ ] ui/ (nếu FE)
- [ ] ops/ (nếu hạ tầng)
- [ ] security/ (nếu security slice)
- [ ] rollback/ (kịch bản + kết quả drill)

### Rollback
- [ ] Kịch bản viết
- [ ] Đã rehearsal
- [ ] Feature flag tắt được trong <X> phút

### Sign-off
- [ ] Owner — <tên> — <date>
- [ ] Reviewer — <tên> — <date>
- [ ] Tech Lead (nếu schema/security) — <date>
```

---

## 2. Evidence manifest template

```json
{
  "slice_id": "SAFE-02",
  "wave": "0",
  "commit_sha": "<git rev-parse HEAD>",
  "branch": "dev",
  "image_digest": "<sha256:...>",
  "migration_versions": ["00XX_..."],
  "vnbroker_sha": "1ff04e609b940f672d44bb88e9f006b721fd1262",
  "web_commit": "<sha>",
  "env_keys_used": ["DJANGO_DEBUG", "CORE_PAT_PEPPER"],
  "env_values_recorded": false,
  "test_db": "sqlite-memory | postgres-clone | staging",
  "broker": "mock | sandbox | none",
  "ran_at_utc": "<ISO8601>",
  "operator": "<vai trò>"
}
```

---

## 3. Gate runner (copy-paste)

```bash
# FE — chạy từ packages/web
npx tsc --noEmit
npm run lint
npm run build
npm test
for i in 1 2 3; do npm run test:components || exit 1; done
npm run check:shell
npm run i18n:scan

# BE — chạy từ packages/core/backend (host: `manage.py` nằm ở đây, KHÔNG phải src/manage.py)
$env:DJANGO_DEBUG='true'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1'
$env:DJANGO_SECRET_KEY='local-audit-secret-key-2026'
$env:CORE_PAT_PEPPER='local-audit-pepper'
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test user_workspace identity_access ops_audit service_ops --keepdb

# Celery (app = vninvest_core, KHÔNG phải config)
celery -A vninvest_core inspect active_queues

# Trong container core-api mới dùng `python src/manage.py ...` (entrypoint.sh:18)

# Security / infra
bash scripts/check_no_hardcoded_secrets.sh
gitleaks detect --no-banner --redact
docker compose -f docker-compose.dev.yml config
```

Ghi rõ exit code từng lệnh. Nếu lệnh fail vì lý do ngoài scope, ghi `PRE-EXISTING` + bằng chứng HEAD sạch reproduce; không được dùng `|| true`.

---

## 4. Definition of Ready / Done (rút gọn)

**Ready:** dependency merged, AC đo được, file inventory duyệt, test RED hoặc có repro, evidence path tồn tại, owner+reviewer.

**Done:** AC pass, unit+integration+negative pass, migration rehearsal (nếu có), audit/redaction/tenant đúng, gates xanh, evidence đầy đủ, ledger entry, 2 chữ ký.

---

## 5. Wave checklist (tick khi đóng wave)

### Wave -1 — Security
- [ ] SEC-01 secret đã revoke/rotate; report ký
- [ ] SEC-02 repo không còn secret thật; compose fail-fast
- [ ] SEC-03 secret scan CI xanh; PR test token giả bị chặn
- [ ] SBOM artifact tồn tại

### Wave 0 — Safety
- [ ] SAFE-01 kill-switch fail-closed + scope
- [ ] SAFE-02 order fail-closed; broker call = 0 khi thiếu gate
- [ ] SAFE-03 capability matrix role×endpoint xanh
- [ ] SAFE-04 audit 100% mutation/rejected; redaction pass
- [ ] SAFE-05 job durable qua queue broker; DLQ; ownership
- [ ] SAFE-06 CI fail-closed (không `|| echo`/`|| true`)
- [ ] SAFE-07 entrypoint fail-closed (migrate/collectstatic/repair lỗi ⇒ container exit ≠ 0)

### Wave 1 — Tenant
- [ ] TEN-01 canonical resolver; conflict reject
- [ ] TEN-02 middleware nhánh lỗi xanh
- [ ] TEN-03 FE tenant SSOT + cache tenant-aware
- [ ] TEN-04 broker config tenant + backfill/quarantine
- [ ] TEN-05 migration 0008: fix cho fresh build + forward repair cho DB đã apply; harness 2 kịch bản
- [ ] TEN-06 tenant matrix đầy đủ (≥ 30 case)

### Wave 2 — Ledger + Analytics
- [ ] LED-01 spec + golden fixtures ký
- [ ] LED-02 models + validators xanh
- [ ] LED-03 idempotency durable xanh
- [ ] LED-04 valuation golden khớp
- [ ] LED-05 migration backfill idempotent, checksum khớp
- [ ] ANA-01 performance TWR (MWR chỉ khi ≥ 2 external cash flow)
- [ ] ANA-02 allocation (tổng weight 100% ± 0.01%)
- [ ] ANA-03 risk (thiếu dữ liệu ⇒ `null`, không bịa số)

### Wave 3 — Read-only
- [ ] API-01 OpenAPI + RFC 9457 khóa
- [ ] API-02 envelope/compat xanh
- [ ] FE-01..06 xong; i18n/a11y/visual sign-off
- [ ] E2E journey xanh

### Wave 4 — Broker read-only
- [ ] BRK-01..06 xong
- [ ] Capability matrix versioned
- [ ] Sandbox contract test từng provider
- [ ] SOC Broker Ops + kill-switch drill

### Wave 5 — Paper
- [ ] PAP-01..04 xong
- [ ] 72h soak báo cáo

### Wave 6 — Live (optional)
- [ ] License ký
- [ ] LIV-01..05 xong
- [ ] ASVS L3 + pen test
- [ ] Canary 7 ngày xanh

### Wave 7 — Hardening
- [ ] OPS-01..05 xong
- [ ] SLO dashboard + alert drill
- [ ] Load report
- [ ] DR drill
- [ ] Runbooks

---

## 6. STOP conditions (dừng release ngay)

- Bất kỳ secret thật còn trong HEAD hoặc evidence.
- Cross-tenant test đỏ hoặc isolation violation > 0.
- Duplicate order > 0.
- Migration rehearsal mất row hoặc sai tenant.
- Kill-switch fail-open.
- Broker gọi live khi thiếu OTP/confirm/capability.
- CI còn `|| true`/`|| echo` ở gate bắt buộc.
- `npm run test:components` fail ở bất kỳ lần nào trong 3 lần.
- Chưa có written license mà flag live đang bật.
