# R2.7 gates — AICostRate + snapshot giá (2026-10-17)

Branch `feat/ai-r27-pricing` ← `dev`. Claim `ai-r27`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:937-957`.

## Fail-before
- `ModuleNotFoundError: No module named 'advisory.pricing'` (chạy thật VPS, worktree tại
  commit RED `8546284bf`).

## Thực hiện
- `advisory/models.py`: `AICostRate` (provider, model, usd_per_1k_input/output,
  effective_from, pricing_source) + unique `(model, provider, effective_from)`.
- `advisory/pricing.py` (mới): `pricing_snapshot` (giá + effective_from + source +
  rate_id + cờ tiered), `resolve_cost` (tương thích 2 số R0.7), `import_pricing_file`
  (idempotent, KHÔNG ghi đè dòng đã có), `format_cost_for_display`.
- `tasks.py` dùng `pricing_snapshot` ⇒ ghi đúng cost input/output thật.
  `orchestrator._resolve_cost` thành alias (test R0.7 không sửa).
- Admin `AICostRateAdmin`.

## Quyết định (lệch AC gốc, đã ghi)
- **AC3 bằng snapshot, không bằng recompute.** Import file trùng `(provider, model,
  effective_from)` báo `skipped` **không** update: đổi giá là thay đổi lịch sử, phải
  thêm `effective_from` mới. Báo cáo dùng giá của từng record.
- **AC6 mạnh hơn plan:** `PRICING_PROVIDER_TIERED` là danh sách provider tính theo hạn
  mức; kể cả khi có dòng giá, `copilot` vẫn `cost=0` + `pricing_available=false`.
- **`tokens_total` fallback = tính hết theo input.** `resolve_cost` 3 tham số giữ tương
  thích R0.7; đường ghi thật (`tasks.py`) luôn truyền tách input/output.
- **AC4 (UI) chưa làm** — FE, ghi rõ ở "CHƯA CHẠY" chứ không báo đã xong.
- Migration `0015_aicostrate` (plan ghi `0016`; head thật sau R2.1 là `0014`).

## Bẫy đã gặp (đáng nhớ)
- **Regen system-design phải `PYTHONUTF8=1`.** Generator Python in tiếng Việt ⇒
  `UnicodeEncodeError` trên cp1252 ⇒ gate báo lệch *giả* (freshness + 2 catalog).
  Không set biến này thì push FAIL dù file đã đúng.
- **Thứ tự đúng:** `makemigrations` **trước** rồi regen. Regen trước, sinh migration
  sau ⇒ catalog lệch ngay (127 migration, +6 route admin).
- 2 lần test của tôi sai (không phải code sai): kỳ vọng dict bằng `==` khi snapshot
  có key thừa; và 1.0×1 + 4.0×0.5 = **3.0** chứ không phải 4.5.

## Gates (VPS Postgres thật, EXIT=0)
- Mới **22/22** · usage 6/6 · mgmt 30/30 · config 9/9 · policy 9/9 · r04_r05 4/4 ·
  r06 5/5 · ai_clients 6/6 = **91 test**.
- `makemigrations --check --dry-run` 0 · `manage.py check` 0 · pre-push 23/23.

## CHƯA CHẠY
- **AC4 UI hiện thời điểm + nguồn giá** (FE — cần nối `format_cost_for_display`).
- Task định kỳ `import_pricing_file` từ `AI_PRICING_FILE` (chưa đăng ký Celery beat).
- full BE ngoài scope · ruff · E2E · staging deploy.