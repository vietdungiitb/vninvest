# Audit kế hoạch nghiên cứu — 2026-11-27

**Giới hạn độc lập:** solo, tự audit có cấu trúc; không gọi là independent audit.

## Kiểm chứng phạm vi

| Plan nói | Kiểm chứng | Kết quả |
|---|---|---|
| vnbroker có BulkRouter song song | `core/bulk_router.py:150` `ThreadPoolExecutor(max_workers=len(selected))` | Đúng |
| vninvest có round-robin riêng | `data_ingest/tasks.py:1809-1816` | Đúng — **hai lớp song song không chia sẻ health/rate-limit budget** |
| CafeF là nguồn raw duy nhất | `vci/quote.py:578-585`, `kbs/quote.py:438-445` | Đúng |
| `adj_close` chưa phủ 2026 | probe `ADJ_NONNULL_2026=222`, 2026 ~281k dòng | Đúng |
| `apply_adjustments` tắt | `adjustment.py:93-94`, env `PRICE_ADJUSTMENT_WRITES_ENABLED=None` | Đúng |

## CONTRADICTIONS (plan/old doc vs code)

1. `pricing.py:3-5` ghi "pilot HOSE 2022 (~2%)" — thực tế CafeF 2026 = 0 dòng; tài liệu stale.
2. `adjustment.py:22-29` gọi `close` là "raw close" nhưng cột này đang chứa adjusted (TPB 13934.04 = VCI adjusted).
3. `RAW_USAGE_SCAN` (nhánh chưa merge) khẳng định trần/sàn dùng raw — bị phản chứng bởi FPT ex-date 2026-11-27 (44500−1000=43500). Đã đính chính tại Entry 672.

## Reservation
- R1: không có auditor thứ hai — đóng bằng ghi rõ giới hạn + chạy gate.
- R2: KHÔNG được code theo yêu cầu owner — mọi đề xuất chỉ là khuyến nghị.
- R3: số liệu staging là snapshot 2026-11-27; có thể đổi khi chạy job đêm.

## Verdict
**AGREE** — tiến hành nghiên cứu với SCOPE đã khóa.
