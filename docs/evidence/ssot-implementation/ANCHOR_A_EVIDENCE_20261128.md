# Anchor A — unblock Phase 0 coverage (2026-11-28)

Branch chain: `feat/phase0-remediate` (#592) → `feat/anchor-a-symbols-fix` (#593) → `feat/anchor-a-chunked` (#594) → `feat/anchor-a-cafef-guard` (#595). Claim `phase0-remediate` (đã đóng theo từng PR).

## B3/B4
Audit subagent 2 vòng: NEED_REVISION (5 objection) → **PASS** (0 objection). Plan `PLAN_PHASE0_REMEDIATE_20261128.md` Rev.2 + audit `AUDIT_PLAN_REMEDIATE_20261128.md`.

## Code
- `anchor_a_relabel` command: `--dry-run` (mặc định), `--backup`, `--apply`, `--rollback-sql`, `--limit`.
- `build_relabel_plan`: ghi `price_source='vnbroker_fallback'`, `adj_close=close`, `adj_factor=1`, `is_adjusted=True`, `adj_as_of=now`, `adj_version=F+1`; **không đổi close/OHLC/volume**.
- `iter_keyset_batches`: duyệt `id__gt` theo lô 5000 — sửa lỗi OOM.
- Guard: `target_symbols().order_by()` (sửa lỗi `distinct()` dính `Meta.ordering` → trả 140.182 thay vì 963); pre-check `exclude(price_source='cafef').filter(adj_close__isnull=False)` ⇒ halt nếu nguồn khác có adj; dòng `cafef` được override có kiểm soát theo D-08.
- `integrity.py`: `vnbroker_fallback` vào `foreign_adjusted` để guard vẫn thấy basis lạ.

## E2E staging (đang chạy song song khi viết doc)
| Bước | Kết quả |
|---|---|
| Deploy `dev@f4ba8511f` → `dev@4f9c99dd0` | `deploy_exit=0` |
| `--dry-run` | `symbols=963 rows=2652748`, `would_update=2000 skip=0 backup_exists=False` (sau fix symbols) |
| `--backup` | `backup rows=2652748` (bảng ops `market_data_anchora_backup_20261128`) |
| `--apply` lần 1 (bản cũ) | `exit=137` OOM — **0 dòng ghi** (verify `UNMAPPED=140182`, `FALLBACK=222`) |
| `--apply` lần 2 (keyset) | halt `adj_close_present=885728 > 0`, **0 UPDATE** — guard đúng |
| `--apply` lần 3 (cafef override có kiểm soát) | **ĐANG CHẠY NỀN** — kết quả sẽ ghi ở phần cập nhật |

## Gates
TDD đỏ → **19 passed** (test mới + price_integrity); `pre-push-gate` 36 PASS mỗi PR; B8 code audit đang chạy song song.

## Reservation
Không đổi flag `PRICE_ADJUSTED_DISPLAY=0`; FE nhãn là non-goal (Phase 4). Bảng backup là ops artifact, không phải Django migration. Rollback SQL in qua `--rollback-sql`.
