# Audit kế hoạch SSOT Phase 1 — vòng 1 (2026-11-27)

**Auditor**: subagent read-only (model khác), không sửa file.
**Verdict**: **NEED_REVISION** — 6 objection.

| # | Mức | Objection |file:line |
|---|---|---|---|
| 1 | P0 | Exception bị nuốt trước khi tới `BulkRouter`: `vci/quote.py:439-442`, `kbs/quote.py:261-262` trả `None`; `fetch_multiple` chỉ gom frame thành công (`vci/quote.py:496-507`, `kbs/quote.py:266-269`). `RateLimitError` không tới `bulk_router.py:460`/`:267-270` ⇒ không cooldown, không requeue. Plan không liệt kê 2 handler này | `PLAN_SSOT_IMPLEMENTATION_20261127.md:34,42-43` |
| 2 | P0 | DNSE mất `retry_after` và không nhận 418: `exceptions.py:292` `RateLimitError` kế thừa `ConnectionError` ⇒ `dnse/quote.py:139-140` bọc lại thành `ConnectionError` thường; `_FAILOVER_MARKERS` `:125-129` thiếu `"418"`; `:462-470` nuốt tiếp | `:7,34,42` |
| 3 | P1 | AC2 gọi sai API: `bulk_router.py:95` là `fetch_history()`, `history()` ở `api/bulk.py:41` | `:43` |
| 4 | P1 | AC3 thiếu điểm sửa: `api/bulk.py:108` `attrs.get("symbol","unknown")`; `bulk_router.py:512-520` nhánh `len(frames)!=len(symbols)` trả frame chưa tag | `:34,44` |
| 5 | P1 | Baseline không có cột lệnh; trích sai `async_client.py:314` (thực tế `status_code == 429 or status_code >= 500`); HEAD đã đổi do claim commit, plan là file untracked | `:9-20,49` |
| 6 | P1 | Thiếu DNSE trong Phase 1 (`SSOT_DECISIONS_REV2:40` mock 418/429, `:21,29,33-34` cap/budget riêng); thiếu đếm 418 trong benchmark (`REV2:91`); thiếu ràng không mutate `os.environ` (`REV2:92`, thực tế `performance_profiles.py:98` ghi thẳng) | `:34,42-45` |

## Hướng sửa đã áp dụng vào plan vòng 2

- Bổ sung §5.1 danh sách file bắt buộc: `vci/quote.py`, `kbs/quote.py`, `dnse/quote.py`, `api/bulk.py`, `core/exceptions.py`, `tests/examples/vci_perf_benchmark.py`.
- Sửa AC2 thành `BulkRouter.fetch_history()` / `BulkAPI.history()`; AC3 trỏ đúng `api/bulk.py:108` + `bulk_router.py:512-520`.
- Baseline thêm cột lệnh, sửa trích dẫn, ghi rõ HEAD tại thời điểm đo.
- Thêm AC5 (DNSE), AC6 (418 benchmark), AC7 (không mutate `os.environ`).

## Reservation
Auditor vẫn là model khác nhưng chạy solo theo yêu cầu Owner; không thay thế được con người review.
