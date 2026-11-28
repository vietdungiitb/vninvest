# Audit kế hoạch F3 — vòng 1 (2026-11-28)

**Verdict: NEED_REVISION** — 4 objection. SCOPE sạch (không flag, không migration).

| # | Mức | Objection |
|---|---|---|
| 1 | P0 | `anchor_a_relabel.py:42-47,71-75,81-84` — dòng đã anchor (`adj_close` có giá trị) luôn rơi vào halt/skip; chế độ vintage phải tách luồng bypass 2 guard |
| 2 | P0 | Backup chỉ có 6 field cũ (`:17-20,130-134,143-147`), thiếu `base_as_of`/`adj_basis`; tái dùng `BACKUP_TABLE` làm `_backup_count()` so sai `EXPECTED_ROWS` |
| 3 | P0 | `tasks.py:704-711,741,810` — `next_values` không chứa 5 field mới, `bulk_create(update_fields=...)` bỏ chúng; `values()` `:796-798` không select adj ⇒ guard `:730-731` luôn None |
| 4 | P1 | `adjustment.py:121,171-173` fallback `row.date` cho dòng cafef ⇒ vẫn double-adjust; AC4 tự mâu thuẫn vì `adj_version`/`PriceRebaseRun` luôn đổi ở lần recompute thứ 2 |

## Hướng sửa v2
- Thêm `--set-vintage` riêng, chỉ cập nhật 2 field, bypass 2 guard của `--apply`.
- Bảng backup riêng `market_data_vintage_backup_20261128` (id + 2 field), `--rollback-vintage-sql`, không dùng chung `BACKUP_TABLE`/`EXPECTED_ROWS`.
- `next_values` + `values()` + `bulk_create(update_fields)` đều chứa 5 field mới; row T+0 là row **mới chưa tồn tại** nên không bị guard skip.
- Idempotence định nghĩa lại: **giá trị `adj_close`/`adj_factor` giữ nguyên**; `adj_version`/audit được phép tăng (bản chất audit trail). `base_as_of` NULL ⇒ fallback `row.date`, nhưng với dòng `cafef` phải backfill vintage trước khi recompute.
