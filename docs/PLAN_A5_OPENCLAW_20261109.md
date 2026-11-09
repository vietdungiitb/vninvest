# PLAN — A5 OpenClaw → tính năng hỗ trợ D4 (BE-only) — 2026-11-09 (B2)

> **For agentic workers:** REQUIRED SUB-SKILL: `workflow-dev-loop` — B3/B4 verdict bằng văn bản trước claim. **Plan này là B2 — chưa B3/B4, chưa claim, chưa viết code cho tới khi có verdict PASS/AGREE bằng văn bản (luật cứng #6).**

**Goal:** Fail-closed của OpenClaw hiển thị đúng định vị D4 "tính năng hỗ trợ" thay vì khiến user tưởng AI chính chết — BE-only, không đụng FE/locale/migration.

**Architecture:** Sửa đúng **1 message string** trong `openclaw.py` (`_MSG_NOT_CONFIGURED`) thành thông điệp chứa **nguyên văn cụm AC W1.7 "tính năng hỗ trợ đang chưa bật"** + định vị "đây là tính năng phụ trợ — AI chính không bị ảnh hưởng" + thêm **1 test** khóa 2 cụm đó (case-insensitive, tái dùng `_NoEnv` để cô lập `OPENCLAW_*` env trên VPS). Không đổi `error_code`, không đổi status (giữ 503), không đổi protocol, không đoán D-03c.

**Tech Stack:** Python/Django BE + VPS staging (`docker cp` tạm thời + restore).

**Spec:** `docs/PLAN_NEXT_DIRECTION_20261109.md` §A5 + `docs/EVALUATION_HANDOFF_20261109.md` M6-02 (D4) + `docs/evidence/a5-openclaw/B1_MEASURE_20261109.md`.

## Global Constraints

- Không `npm/pip install` · không migration · **không chạm deny-list**. P0-1 (`requirements.txt`) là coordinator-only, **không sửa trong slice này**.
- **Không chạm** `packages/web/src/i18n/vi.js` + `en.js` (6 claim `in-progress` stale tại `CLAIMS.md:1237,1239,1625,1695,1726,1831`; tuân thủ `AGENT_PROTOCOL.md` §3 → deferred, ghi trong claim note).
- Không đọc tiếng Việt qua console; chỉ đếm exit code/số lượng (luật cứng #4).
- Mọi số kèm lệnh tái hiện; chưa chạy = `CHƯA CHẠY`.

## Review Focus

- **Không đoán protocol**: `SUPPORTED_PROTOCOLS` giữ `()`; D-03c vẫn chờ Owner. Không thêm nhánh gọi mạng.
- **Không đổi hợp đồng lỗi**: `error_code` (`openclaw_not_configured`/`openclaw_spec_missing`) + `status_code=503` giữ nguyên → call site phía trên (test-connection, audit `test_connection_failed`) không phải sửa.
- Message mới phải **chứa nguyên văn cụm AC W1.7 "tính năng hỗ trợ đang chưa bật"** và **cụm "ai chính không bị ảnh hưởng"** (case-insensitive; tránh tautology L-V04 — assert cụm đầy đủ, không dùng bare `"không"`). Không dùng từ ngữ hứa hẹn tính năng chưa có.

---

## Baseline exit-code tại HEAD (B2)

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Quy trình | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — 0 lỗi, 0 trùng; 2 cảnh báo stale (không chặn) |
| Lessons | `node scripts/check-lessons.mjs` | **PASS** — 14 file, 57/60, sạch |
| EOL | `node scripts/normalize-eol.mjs` | **OK** — 0 file thay đổi |
| AC W1.7 | `grep -c "tính năng hỗ trợ" src/advisory/ai_clients/openclaw.py` (tại staging cũng như dev) | **0** → AC chưa đạt (fail-before đã có) |
| Git | `git status --short` | `?? docs/PLAN_A4_ROADMAP_20261109.md` + `?? docs/evidence/a4-roadmap/` (A4 BLOCKED, không stage) + `?? docs/evidence/a5-openclaw/` + plan này |

**Lessons áp dụng:** [L-001, L-002, L-003, L-008, L-M02, L-V01, L-V02, L-V03, L-V04, L-T01]

## SCOPE / LIMIT / NON-GOALS / ROLLBACK

- **SCOPE:** `packages/core/backend/src/advisory/ai_clients/openclaw.py` đổi đúng `_MSG_NOT_CONFIGURED` (:45-48) + `packages/core/backend/tests/test_ai_client_openclaw.py` thêm 1 test class/method khóa message "tính năng hỗ trợ" + `docs/CLAIMS.md` (B5) + `docs/CODE_CHANGE_AUDIT_LEDGER.md` (B9 Entry) + `docs/evidence/a5-openclaw/*` + `docs/PLAN_A5_OPENCLAW_20261109.md`.
- **LIMIT:** Tối đa **2 file code** + 2 file quy trình; không sửa `catalog.py`/`model_choices.py`/`models.py:250` (nhãn "System Default", cần review riêng — đổi `TextChoices` cần migration, coordinator-gated), không sửa `portfolio_analytics_views.py:2040` doc.
- **Non-goals:** Không implement protocol, không đoán D-03c, không đụng FE/i18n, không sửa P0-1/P0-3, không đụng B1 (orchestrator `:845-891`) / B2 (live order).
- **Rollback:** revert PR (merge-commit). **Môi trường:** VPS staging qua `docker cp` tạm thời + restore về code bake của image (không đổi `/opt/vninvest`, không rebuild image).

## Việc

### A5-1: Định vị message + khóa bằng test (TDD, VPS)

- [ ] **Step 1 RED:** Thêm test `OpenClawSupportPositioningTests` (mới, cuối `test_ai_client_openclaw.py`, tái dùng `_NoEnv` + `patch.dict` như các test AC1 hiện có để cô lập `OPENCLAW_*` env trên VPS): (a) `probe()` khi thiếu base URL → `ok=False`, `error_code=ERROR_NOT_CONFIGURED`, `detail.lower()` chứa **cả 2 cụm** `"tính năng hỗ trợ đang chưa bật"` **và** `"ai chính không bị ảnh hưởng"` (case-insensitive; không tautology). `docker cp` file test vào container → chạy `tests.test_ai_client_openclaw.OpenClawSupportPositioningTests` → **FAIL** (fail-before, code cũ chứa 0 cụm "tính năng hỗ trợ").
- [ ] **Step 2 GREEN:** Edit `_MSG_NOT_CONFIGURED` thành: "Tính năng hỗ trợ đang chưa bật (OpenClaw, `OPENCLAW_BASE_URL` chưa đặt). Đây là tính năng phụ trợ — AI chính không bị ảnh hưởng. Nếu cần, hãy liên hệ quản trị viên hệ thống." `docker cp` openclaw.py vào container → chạy lại test → **PASS**. Chạy luôn suite openclaw đầy đủ (`tests.test_ai_client_openclaw`) → **PASS** toàn bộ (AC1/AC3/AC4/AC5 không hồi quy).
- [ ] **Step 3:** Restore container: (1) lưu bản sao 2 file gốc **trước** `docker cp`; (2) restore `openclaw.py` từ bản sao + **`rm /app/src/tests/test_ai_client_openclaw.py`** (file test không có "bản gốc" vì `backend/tests/` không bake — `Dockerfile:65`); (3) kiểm chứng bằng **`docker exec` `diff`** trong container (không chỉ `git status` trên `/opt/vninvest` như plan cũ), + `git status` trên `/opt/vninvest` sạch. **Lưu ý:** trong cửa sổ test, staging API đọc được message mới cho tới khi restore — cửa sổ ngắn, đã ghi nhận. `node packages/web/scripts/check-multi-agent.mjs` + `node scripts/check-lessons.mjs` + `git diff --numstat` = đúng 2 file code. Acceptance: Given OpenClaw chưa cấu hình, When gọi `probe()`/test-connection, Then trả 503 + `error_code=openclaw_not_configured` + `detail` chứa nguyên văn "tính năng hỗ trợ đang chưa bật" + "ai chính không bị ảnh hưởng" (định vị D4), không đọc như AI chính chết. **CHƯA CHẠY**: FE/locale, `models.py:250` nhãn migration, P0-1.

## Bàn giao

Plan là **B2**. B3 cần auditor độc lập ghi `docs/evidence/a5-openclaw/AUDIT_PLAN_20261109.md` trước claim (luật cứng #6). Agent đề xuất: `a5-openclaw` → `feat/a5-openclaw`.
