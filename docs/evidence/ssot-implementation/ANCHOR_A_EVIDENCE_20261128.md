# Anchor A — unblock Phase 0 coverage (2026-11-28)

PR chain đã merge: #592 (`feat/phase0-remediate`) → #593 (`anchor-a-symbols-fix`) → #594 (`anchor-a-chunked`) → #595 (`anchor-a-cafef-guard`) → #597 (`anchor-a-harden`).

## B3/B4
- Audit plan 2 vòng: NEED_REVISION (5 objection) → **PASS**.
- Plan: `PLAN_PHASE0_REMEDIATE_20261128.md` Rev.2 (Anchor A toàn chuỗi 963 mã, 2.652.748 dòng).
- Audit hardening: NEED_REVISION (5 objection) → plan `PLAN_ANCHOR_HARDEN_20261128.md` → **PASS**.

## Code
- `anchor_a_relabel`: `--dry-run` / `--backup` / `--apply` / `--rollback-sql` / `--limit`.
- Ghi `price_source='vnbroker_fallback'`, `adj_close=close`, `adj_factor=1`, `is_adjusted=True`, `adj_as_of=now`, `adj_version=F+1`; **không đổi close/OHLC/volume**.
- `relabel_all` = **1 transaction cho toàn bộ** 2,65M dòng; skip ⇒ rollback toàn bộ.
- `integrity.py`: coverage đếm theo `adj_close` (không còn phụ thuộc `price_source='cafef'`); `vnbroker_fallback` vào `foreign_adjusted`.
- Guard: `_backup_exists` so `table_schema`; `--limit` cấm khi apply; dòng `cafef` được ghi đè có kiểm soát (D-08), nguồn khác có `adj_close` ⇒ halt.

## E2E staging (thật)
| Bước | Kết quả |
|---|---|
| Dry-run | `symbols=963 rows=2652748 would_update=2000 skip=0` |
| Backup | `backup rows=2652748` (ops table `market_data_anchora_backup_20261128`) |
| Apply bản đầu | `exit=137` OOM, **partial write** ~940.000 dòng |
| Rollback | `ROLLBACK_ROWS=2652748`; verify `fallback=222` — sạch |
| Apply bản keyset | halt `adj_close_present=885728 > 0`, **0 UPDATE** (guard đúng) |
| Hardening + RAM | `CORE_API_MEM_LIMIT=512m → 4g`, recreate container, `Mem=4294967296` |
| Apply bản hardening | **ĐANG CHẠY NỀN** — chưa có `apply_exit`, chưa báo PASS |

## Gates
TDD đỏ → **22 passed** (anchor_a_relabel + price_integrity); `pre-push-gate` 36 PASS mỗi PR; B8 hardening audit đang chạy song song.

## Bài học
OOM không chỉ là RAM — guard all-or-nothing đã bắt được partial write mà bản "atomic từng chunk" để lọt. Đã sửa trước khi tin kết quả apply. Flag `PRICE_ADJUSTED_DISPLAY=0` không đổi; FE nhãn là non-goal Phase 4.
