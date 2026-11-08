# PLAN — Fix 4 cổng pre-push (2026-11-08)

## Mục tiêu

Đóng 4 FAIL còn lại của `pre-push-gate` (đã chứng minh pre-existing trên cây sạch `agent-baseline-check` = `origin/dev`) để nhánh T1 (`feat/nextphase-1108`, Entry 425) push được **không dùng `--no-verify`**.

| Cổng | Bản chất (đã xác minh file:line) |
|---|---|
| `global-config-drift` | Bản deployed `~/.opencode/` lệch canonical `tools/opencode-global/` (trong git). `deploy.mjs:1-8` ghi rõ canonical là sự thật — fix = chạy `deploy.mjs` (machine-local, không cần commit repo) |
| `check-ai-cc` AC11 | Gate strip comment `check-ai-cc.mjs:271-274` dùng per-line `/\/\/.*$/` — hỏng trên CRLF (cùng lớp lỗi AC5:T1). `main.tsx:203-205`: comment "bọc StaffRoute" của route `audit` rơi vào statement của `slo` khi strip lỗi → ai-slo bị gán nhầm guard |
| `system-design` C-002/C-005 + freshness | Số trong tài liệu stale: `LicenseKey` (`205867b84`) +1 model → 118; Entry 419 gỡ NOOP beat → 45. Đã đo độc lập: MODELS=118, BEAT=45. Fix = sửa doc (đúng như gate yêu cầu "sua TAI LIEU, dung sua claims de xanh") + `--write` regen |
| `system-design` catalog READ + `openapi-budget` (thiếu django) | `gen-*-catalog.py` và `check-openapi-schema-budget.py` cần Django runtime; máy này không có (không venv, `python` system không có django). Tiền lệ repo (`ui-check-a11y-runtime` CHƯA CHẠY exit 0) + contract của tool ("thiếu thi SKIP trung thuc — L-G02") ⇒ **SKIP trung thực**, không bịa PASS |

**Lessons áp dụng:** [L-001, L-002, L-003, L-007, L-V01, L-V02, L-V04]
**MANDATORY CHECKLIST:** claim trước code · sửa số đo từ code thật (không đoán) · fix gốc rễ ở gate (không gaming điều kiện) · chạy cổng của chính gate đã sửa + self-test · đo lại `pre-push-gate` toàn phần · vẫn giữ mới có thể push.

## Giải pháp từng cổng

### G1 — `global-config-drift` (không sửa repo, chỉ chạy deploy)

- `node tools/opencode-global/deploy.mjs` → copy 6 file canonical → `~/.opencode/`
- Verify: `node scripts/verify-global-config.mjs` exit 0 (6 OK + smoke test)
- Vì sao an toàn: `deploy.mjs` chỉ chép nguyên văn (copyFileSync), không chèn logic

### G2 — AC11 (fix gốc rễ CRLF trong gate, 1 dòng)

- `check-ai-cc.mjs:271-274`: thêm chuẩn hoá EOL trước khi strip:
  `.replace(/\r\n/g, "\n")` rồi mới `split("\n")` + per-line strip
- Chứng minh red→green trên fixture CRLF (giữ hành vi LF như cũ); `--self-test` phải vẫn PASS (mutation AC11 vẫn bắt được drift thật)
- Không bịa `staffOnly` (catalog giữ `staffOnly: false` cho ai-slo, đúng guard thật ở `main.tsx:203`)

### G3 — `system-design` số stale (sửa tài liệu + regen)

- Doc `01.01-tom-tat-dieu-hanh.md`: `117 model`→`118 model`, `46 lịch Celery beat`→`45 lịch Celery beat` (nguyên văn còn trong `claims.json:16,40`)
- `claims.json`: `expected` 117→118, 46→45 (atomically với doc — cấm chỉ sửa claims)
- Regen: `node docs/system-design/_meta/tools/check-system-design.mjs --write` (chỉ ghi `inventory.json` + `freshness-report.md`, không sửa tài liệu viết tay — đúng thiết kế tool)
- Verify `--check` exit 0 (claims + inventory + freshness + links + dups); phần catalog vẫn SKIP (thiếu django — xem G4)

### G4 — Honest SKIP khi thiếu Django runtime (contract L-G02) [rev2: thu hẹp predicate — OBJ-1/2]

- `check-system-design.mjs:checkGenerated` — CHỈ khi đầu ra chứa `No module named 'django'` (chính xác, không dùng `ImportError` chung) → trả **code 2 (SKIP trung thực)**; `ModuleNotFoundError` cho module khác vẫn là code 1 (FAIL). Thêm 1 case self-test âm: gen in `No module named 'requests'` phải FAIL.
- Lan truyền SKIP ra pre-push (OBJ-2): khi catalog SKIP, `runCheck` trả **exit 2** (contract của tool: 0 = sạch, 1 = drift, 2 = không verify được) thay vì nuốt trong output; `pre-push-gate.mjs` map exit 2 → `skip("system-design", "catalog CHUA CHAY (thieu django) — chay VPS")` như tiền lệ `ui-check-*` (PASS có đọc được, không nuốt SKIP).
- `pre-push-gate.mjs` openapi-budget (G4b) — probe `PY -c "import django"` trước; chỉ skip khi probe báo thiếu django (chính xác, không đoán từ output); import được → chạy budget như cũ, lỗi thật vẫn FAIL. SKIP ghi rõ VPS staging.
- Khi có django (VPS) hai cổng vẫn chạy thật như cũ → không mất kiểm soát.
- Claim `scripts/pre-push-gate.mjs` có 3 claim stale giữ file (CLAIMS.md:1708/1760/1772, uistd-w1-theme/w0-foundation/w0-staging-policy, PR đã merge #272/#278/#284 từ Oct 21-22) — đóng bằng đúng *1 từ trạng thái* mỗi dòng theo tiền lệ `uiux-w9-stale-claims` (2026-10-10) trước khi chạm `pre-push-gate.mjs`; commit hygiene riêng, diff giới hạn đúng block `openapi-budget` (`pre-push-gate.mjs:425-443`) + handler exit-2 của `system-design`.

## Audit B3 verdict rev1 (docs/evidence/gates-fix/AUDIT_PLAN_GATES_20261108.md)

- **NEED_REVISION rev1 — 3 OBJ (đã đưa vào rev2):**
  1. OBJ-1 — Predicate G4 quá rộng (`ImportError` chung che drift thật). Rev2: thu hẹp chỉ `No module named 'django'` + self-test âm (module khác vẫn FAIL).
  2. OBJ-2 — SKIP catalog bị nuốt trong output, pre-push vẫn in PASS cố định. Rev2: exit 2 → `skip(...)` có lý do (CHƯA CHAY), như tiền lệ `ui-check-*`.
  3. OBJ-3 — 3 dòng stale giữ `pre-push-gate.mjs` vi phạm chữ §3(2). Rev2: đóng bằng 1 từ trạng thái trước (tiền lệ `uiux-w9-stale-claims`), diff giới hạn block.
- C-001/C-003/C-004/C-006 KHÔNG stale (đã đo: 15/137/10/44) — plan chỉ sửa C-002/C-005 là đủ.

## Phạm vi file (claim này)

`check-ai-cc.mjs` · `01.01-tom-tat-dieu-hanh.md` · `_meta/claims.json` · `_meta/inventory.json` · `_meta/freshness-report.md` · `_meta/tools/check-system-design.mjs` · `scripts/pre-push-gate.mjs` · `docs/PLAN_GATES_FIX_20261108.md` · `docs/evidence/gates-fix/*`
**Không** chạm `commercial/*`, không thêm dependency, không `npm/pip install`.

## NON-GOALS

- T3/T2/T4 của `docs/PLAN_NEXT_PHASE_20261108.md` (ticket riêng, claim riêng)
- Cài Django/VPS cho gate này; sửa số baseline của openapi (giữ nguyên)
- Đụng `scripts/pre-push-gate.mjs` ngoài đoạn openapi-budget (3 claim stale Oct 21-22 còn `in-progress` — sửa tối thiểu, báo coordinator, chỉ khi B4 đồng thuận)
