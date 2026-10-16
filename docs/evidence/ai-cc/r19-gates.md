# R1.9 gates — diff preview + 409 optimistic lock (2026-10-16)

Branch `feat/ai-r19-concurrency` ← `dev`. Claim `ai-r19`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:697-718`.

## Fail-before
- BE (VPS Postgres thật): thiếu `config_updated_at` + ghi đè âm thầm.
  (đi vòng: tenant editor + envelope `unwrapped` — không phải lỗi feature).
- FE: 5/5 RED (không modal, lưu trực tiếp, không expected).

## Thực hiện
- BE: GET/PUT trả `config_updated_at`; PUT có `expected_updated_at` lệch ⇒
  **409 `code: ai_config_conflict`** + `current_updated_at` + `current`
  (dùng `code` thay `error_code` của plan — transport map `payload.code`
  thành `err.code`; test assert body trực tiếp). Vắng ⇒ hành vi cũ.
  GET giữ read-only (bảo vệ user legacy prefs) — PUT đầu tạo row.
- FE: `AiConfigPreviewModal` (diffObjects + 409 mode) + form preview → PUT
  kèm expected → 409 → 2 lựa chọn (reload-overwrite / hủy). 8 key i18n mới.
- Sửa 2 test cũ đi qua modal (R1.4 dirty, page R0.3 + policy-save).

## Gates (EXIT=0)
- BE VPS: mới **3/3** + policy_gating + management_center.
- FE: mới **5/5** + r14/page/form-parity.
- `tsc` 0 · `eslint` 0 · `check-ai-cc` SẠCH (chạy từ root — workdir sai báo giả) ·
  `build` PASS · multi-agent 0 lỗi.

## CHƯA CHẠY
- Ảnh modal · full BE ngoài scope · ruff · E2E · staging deploy.
