# R2.8 gates — AIBudget 4 tầng × 3 chiều (2026-10-17)

Branch `feat/ai-r28-budget` ← `dev`. Claim `ai-r28`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:959-982`.

## Fail-before
- `ModuleNotFoundError: advisory.budget` / `AIBudget` chưa có (test commit RED).

## Thực hiện
- `advisory/models.py`: `AIBudget` — 1 dòng = **1 hạn mức trên 1 chiều**
  (`cost|tokens|requests`), scope `(user, tenant, provider, model, period)`,
  `soft_ratio=0.80`, unique 6 khoá. Migration `0016_aibudget`.
- `advisory/budget.py` (mới): `resolve_budget()` + `period_start()` + `_usage_totals()`.
- `views._advisory_budget_state(..., tenant, model, provider)`: ưu tiên kết quả
  `AIBudget`; **không** có dòng khop ⇒ giữ nguyên hành vi cũ (AC9).
- 429 nay có `error_code='ai_budget_exhausted'` + `budget{used,limit,pct,source,dimension}`.
  201 thêm cùng khoá vào `budget` (giữ nguyên khoá cũ để client cũ không hỏng).

## Quyết định (lệch cách hiểu thuần của plan, đã ghi)
- **"Mức chặt nhất" = pct cao nhất, KHÔNG phải tầng đầu tiên trong thứ tự.**
  Lấy theo thứ tự ưu tiên ⇒ budget theo model vô hiệu hoá hạn mức user/tenant ⇒
  AC7 hỏng đúng thứ nó sinh ra để chặn. Bằng pct → scope hẹp hơn thắng.
- **Phạm vi đếm usage do chính dòng ngân sách quyết định**, không theo model của
  lệnh gọi. (Sửa sau khi AC7 fail: lọc theo model lệnh gọi là lỗ hổng đổi model.)
- **AC6: `AIUsageRecord` không có FK tenant** (R0.7 đã từ chối đoán tenant thanh toán)
  ⇒ chỉ số tầng tenant = hợp user thuộc tenant (owner + `TenantMember`).
  User nhiều tenant bị tính ở **mọi** tầng ⇒ thiếu nghiệm, không bao giờ lỏng.
  Đây là **deviation** đã ghi, không phải chỗ khác đi được với schema hiện tại.
- **AC8**: ngân sách `cost` của provider hạn mức (copilot) **không bị loại khỏi ứng
  viên** — cost luôn 0 ⇒ pct 0 ⇒ không bao giờ chặn, nhưng vẫn hiện để UI thấy tầng.
  `requests` mới là chiều có ý nghĩa. (Loại hẳn sẽ biến "chỉ có cost budget" thành
  *không giới hạn* — đúng lỗ hổng AC8 cảnh báo.)
- Plan §4.2 gán `test_ai_budget.py` cho R2.5: số hiệu Rev.1 (R2.5 = openclaw). Giữ
  tên file, gắn đúng R2.8.

## Bẫy đã gặp
- Test ma trận AC1 ban đầu tôi **tự hardcode `pct` rồi tự assert bằng công thức** —
  vừa sai số học vừa thừa. Viết lại để test **tự tính** expected winner.
- `_usage_totals` trả tuple nhưng `_dimension_value` index như dict ⇒ 21 lỗi/error
  một lượt. Sửa trả dict.

## Gates (VPS Postgres thật, EXIT=0)
- Mới **21/21** · advisory_budget (cũ) 12/12 · advisory_status 7/7 · usage 6/6 ·
  pricing 22/22 · ai_clients 6/6 · mgmt 30/30 = **104 test**.
- `manage.py check` 0 · `makemigrations --check` 0 · pre-push 23/23.

## CHƯA CHẠY
- Admin `AIBudget` (**chưa đăng ký** — cần cho staff cấu hình từ giao diện).
- Celery task tổng hợp/reset theo kỳ (hiện tính trực tiếp từ `AIUsageRecord`).
- full BE ngoài scope · ruff · E2E · staging deploy.