# PLAN — Broker Config R1 (2026-11-26) — REV 1 sau audit kế hoạch

- **Nguồn:** `docs/AUDIT_BROKER_MANAGEMENT_PAGE_20261126.md` (audit độc lập NEED_REVISION → đã sửa; D1–D6 đã chốt).
- **Slice:** `feat/broker-config-r1` · agent `broker-config-r1` · gồm S1 + S2 + S2b + phần S4 (AC6), **không** làm S3/S5. Tên cũ `S1+S2b` sai phạm vi (reviewer objection 6) đã đổi.
- **Audit kế hoạch:** reviewer độc lập chốt **NEED_REVISION** (`docs/evidence/broker-config-r1/PLAN_REVIEW.md`), 8 objection; REV 1 này sửa cả 8 trước khi viết code.
- **Lessons áp dụng:** `[L-V01, L-V02, L-T02, L-F03, L-G01, L-G02]`
- **SCOPE:** `SocBrokerPanel.tsx`, `adapters/core/soc.js` (nếu cần map lỗi), `i18n/locales/{vi,en}/soc.js`, `i18n/locales/{vi,en}/brokerWave4.js`, `service_ops/views/broker.py`, `service_ops/domain_configs/broker.py`, `data_ingest/tasks.py` (1 điểm wiring), test component + test BE. **Không** đụng `service_ops/models.py` (không migration); **không** deny-list.
- **LIMIT:** 3 vòng sửa/bước; quá → `blocker`, dừng, báo partial.
- **Non-goals:** không live trading (ADR-008); không tự implement broker logic (ADR-006); không enforce rpm/retry (D3); không redesign 4 bước (S5); B-12/`decrypt_failed` để S2 sau (không làm ở R1); nhãn "xác minh tài khoản (read-only)" = B-20/S3, **defer**.

## AC (Given/When/Then) — REV 1

- **AC1:** Given mở `/operations-center?tab=broker`, When load, Then không có raw key `soc.broker.table_caption`, `soc.broker.col_provider`, `soc.broker.no_queues` (3 key duy nhất; `cred_secrets` **đã có** ở `vi/soc.js:1032`, không thêm trùng). Test render có `LangProvider` + assert text dịch.
- **AC2:** Given textarea credential rỗng (không default `{}`), When bấm "Lưu credential", Then FE chặn + i18n, **không** gọi POST, không banner JSON thô.
- **AC3:** Given form DNSE, When xem placeholder, Then `client_id`/`client_secret` khớp `user_workspace/broker/dnse.py:67-70`.
- **AC4 (sửa objection 1):** Given config bật `backfill` cho provider **có credential nhưng purpose không khớp**, When preview/apply, Then 400 + `validation_errors`. **Given provider chưa có credential** (staging: 0 row cả 3 provider) ⇒ **warning trong `validation_errors`, KHÔNG chặn Apply**. Helper đặt tại `service_ops/views/broker.py` (gọi cả `preview` `:306-318` và `post` `:260-286`), không nằm trong dataclass thuần `domain_configs/broker.py:120-148`.
- **AC5 (sửa objection 3):** Given config registry, When backfill task chạy, Then `P = provider_for_purpose('backfill')` (local import theo pattern `tasks.py:2497-2512`); **chỉ chấp nhận `P == 'dnse'`** (provider duy nhất có tape). Khác giá trị ⇒ log warning + ép DNSE, secrets vẫn DNSE — không để UI nói SSI mà runtime chạy DNSE. Không hardcode `('dnse','backfill')` ở `tasks.py:2515`.
- **AC6 (sửa objection 4):** Given đổi `allowed_purposes` mà **không** đổi plaintext secrets, When lưu, Then giữ `is_verified`/`last_verified_at`; so sánh `cred.get_secrets()` **trước** `set_secrets()` (`broker.py:462-470`, plaintext, không so ciphertext/masked). Rotate secret ⇒ reset verify.
- **AC7 (sửa objection 2):** Given payload có `tenant_kill_switches` / `provider_kill_switches` (được đọc ở `broker_runtime.py:190,217`), When apply, Then 2 key này **được giữ** — merge tại **view** `broker.py:270,312` (`after = {**payload, **cfg.to_dict()}` với allowlist 2 key), **không** chỉ sửa `to_dict()` (mất ở `from_dict()` `:150-162` trước đó).
- **AC8 (sửa objection 5):** Given purpose lạ (`foo`) gửi qua API, When validate, Then 400 — validate **payload thô tại `broker.py:264-268,309-310`** trước khi `from_dict()` lọc ở `domain_configs/broker.py:94`.
- **AC9 (test, objection 7):** Viết lại `soc-broker.component.test.tsx` + `soc-broker-wave4.component.test.tsx` dùng `LangProvider`, assert text dịch; thêm test fail-before: (a) Lưu rỗng không gọi POST, (b) placeholder đúng schema, (c) BE preview/apply cross-check, (d) reserved key giữ lại, (e) purpose lạ 400, (f) verify giữ khi đổi purpose.
- **AC10 (E2E, objection 7):** Trên staging sau deploy branch: mở tab broker → header dịch + textarea rỗng → bấm Lưu rỗng → không POST (Network) + thông báo i18n → chụp ảnh; additionally API probe cho 4 AC BE. **Không báo hoàn thành khi thiếu ảnh/API evidence.**

## Baseline gate (trước code)

| Gate | Lệnh | Kết quả |
|---|---|---|
| multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** (0 lỗi, chạy thật 2026-11-26) |
| agent-sync | `pwsh -File scripts/agent-sync.ps1` | **BLOCKED** — working tree có 5 doc untracked + ledger modified của phiên khác; không phải lỗi code; chạy lại khi kết thúc |
| tsc | `npx tsc --noEmit` (packages/web) | CHƯA CHẠY |
| vitest | `npm run test:components -- <file>` | CHƯA CHẠY |
| BE test | pytest trên VPS, DB riêng | CHƯA CHẠY |
| E2E | Playwright trên `https://docker.edusuccess.vn` sau deploy `REPO_BRANCH=feat/broker-config-r1` | CHƯA CHẠY — điều kiện bắt buộc |

**Re-baseline working tree (theo reviewer):** `git status --short` tại lúc lập plan = ledger modified + 5 file docs untracked (`AUDIT_BROKER_MANAGEMENT_PAGE...`, `AUDIT_DNSE_PROVIDER...`, `AUDIT_DIVIDEND_PRICE_HANDLING...`, `REPORT_DIVIDEND_PRICE_ADJUSTMENT...`, plan này). Không commit file của phiên khác.

## Rollback

`git revert` commit slice; FE về behavior cũ (raw key/JSON error) — không mất dữ liệu (không migration). Deploy rollback `REPO_BRANCH=dev bash scripts/deploy-staging.sh`.

## Gate nghiệm thu

`npx tsc --noEmit` sau mỗi sub-step · `npm run build` cuối step · vitest fail-before/pass-after · BE test VPS · `check-multi-agent` · `normalize-eol` (`git diff --numstat`) · `bash scripts/deploy-staging.sh --verify` · **E2E thật + mở ảnh** (L-V05) · re-audit độc lập ghi file.
