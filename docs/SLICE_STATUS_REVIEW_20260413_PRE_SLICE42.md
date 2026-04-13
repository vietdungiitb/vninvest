# Đánh giá hiện trạng trước Slice 42 (2026-04-13)

## 1) Tóm tắt điều hành
- Nhánh làm việc: `dev` đã đồng bộ `origin/dev`.
- Slice 41 đã hoàn tất và push: `c9c116c7`.
- Trạng thái tổng thể: tiến trình tách module whale tasks đang ổn định, không ghi nhận lỗi check/import/schedule ở mốc hiện tại.
- Side-track AdminOps benchmark KBS/VCI đã hoàn tất và merge trước đó: `b3640ab6`.

## 2) Timeline commit gần nhất (mới -> cũ)
1. `c9c116c7` refactor(tasks): extract whale provider phase orchestration
2. `b3640ab6` feat(admin-ops): add separated vnstock provider benchmark module
3. `6c680532` refactor(tasks): extract whale post-provider execution pipeline
4. `a673d349` refactor(tasks): extract whale bookkeeping helpers - slice 39
5. `6b71152e` refactor(tasks): extract whale metrics and response tail - slice 38
6. `6dd7209d` refactor(tasks): extract whale generation preflight gating - slice 37
7. `fbf8989d` refactor(tasks): extract whale provider failover loop - slice 36
8. `c8fd3b45` refactor(tasks): extract whale advisory postprocess helpers - slice 35

## 3) Inventory module đã tách (cụm whale/advisory)
- `backend/portfolio/tasks_whale_advisory.py`
- `backend/portfolio/tasks_whale_auto_generation.py`
- `backend/portfolio/tasks_whale_generation.py`
- `backend/portfolio/tasks_whale_provider_phase.py`
- `backend/portfolio/tasks_whale_provider_generation.py`
- `backend/portfolio/tasks_whale_preflight.py`
- `backend/portfolio/tasks_whale_execution.py`
- `backend/portfolio/tasks_whale_postprocess.py`
- `backend/portfolio/tasks_whale_metrics.py`
- `backend/portfolio/tasks_whale_bookkeeping.py`
- `backend/portfolio/tasks_news_context.py`
- `backend/portfolio/tasks_advisory_helpers.py`

## 4) Snapshot độ phức tạp (line count)
- `backend/portfolio/tasks.py`: 167 lines (đã về vai trò facade/re-export)
- `backend/portfolio/tasks_whale_advisory.py`: 77 lines (mỏng, chủ yếu flush/re-export)
- `backend/portfolio/tasks_whale_generation.py`: 145 lines (orchestrator chính)
- `backend/portfolio/tasks_whale_provider_phase.py`: 46 lines (mới tách ở Slice 41)
- `backend/portfolio/tasks_whale_execution.py`: 203 lines (điểm còn dày nhất trong luồng generation)
- `backend/portfolio/tasks_whale_postprocess.py`: 187 lines
- `backend/portfolio/tasks_whale_provider_generation.py`: 140 lines
- `backend/portfolio/tasks_whale_preflight.py`: 138 lines
- `backend/portfolio/tasks_whale_metrics.py`: 111 lines
- `backend/portfolio/tasks_whale_bookkeeping.py`: 42 lines

## 5) Kiểm tra tương thích đã xác nhận
- `manage.py check`: pass.
- Import smoke cho module mới: pass.
- Celery beat schedule path resolution (`missing []`): pass.
- Mục tiêu tương thích giữ nguyên: task path cũ qua facade `portfolio.tasks.*`.

## 6) Rủi ro còn lại
1. `tasks_whale_execution.py` vẫn gom nhiều concern trong một phase (metadata/severity/aggregate/persist/broadcast/final metrics/result).
2. Vẫn có phụ thuộc chéo mềm qua helper modules; cần tiếp tục tách theo boundary rõ để giảm coupling.
3. Chưa có regression test chuyên sâu cho từng helper phase mới (chủ yếu smoke/integration mức module).

## 7) Đề xuất Slice 42 (khuyến nghị)
- Mục tiêu: tách `tasks_whale_execution.py` thành 2 phase độc lập:
  - `tasks_whale_persist_phase.py`: chuẩn hóa metadata + aggregate snapshot + create advisory + token log + cache cooldown.
  - `tasks_whale_finalize_phase.py`: broadcast + metrics finalize + result payload.
- Kỳ vọng kết quả:
  - `tasks_whale_execution.py` giảm còn vai trò orchestrator trung gian.
  - Dễ test unit theo phase và giảm blast radius khi đổi logic broadcast/metrics.

## 8) Kết luận
- Có thể tiếp tục Slice 42 ngay, nền hiện tại sạch và ổn định.
- Quy trình đề xuất giữ nguyên: tách module nhỏ -> check/import/schedule smoke -> commit/push `dev`.
