# Kế hoạch hardening Anchor A sau B8 NEED_REVISION (2026-11-28)

**Lessons:** [L-V01, L-V02, L-V04, L-T01].

## 5 objection & cách sửa
1. **Partial write** (`anchor_a_relabel.py:150-156`): bọc TOÀN bộ vòng keyset trong 1 `transaction.atomic()`; `chunk_skips>0` ⇒ rollback toàn bộ, 0 UPDATE thật.
2. **AC4 tự mâu thuẫn** (`integrity.py:104-106`): đổi định nghĩa coverage từ "đếm `price_source='cafef'`" sang "đếm dòng có `adj_close`"; giữ `cafef_rows` làm thông tin. `check_price_integrity --min-coverage 0.95` sau anchor sẽ đạt 100% mà vẫn 0 violation.
3. **Backup checks** (`:134`): bỏ `--limit` khỏi đường apply hoặc vẫn so đúng count; `_backup_exists()` so thêm `table_schema=current_schema()`; thống nhất constant tên bảng với plan.
4. **Command tests**: thêm test `handle()` với mock — backup DDL đúng `id`+6 cột, từ chối thiếu/sai count, `--rollback-sql`, fail-closed, `bulk_update` có `F('adj_version')+1`.
5. **Integrity test**: test `vnbroker_fallback` + `cafef` trong cùng symbol vẫn bắn `mixed_basis_symbol`.

## AC
- Given có 1 dòng non-cafef `adj_close` xuất hiện giữa pre-check và apply / When lệnh chạy / Then **0 dòng được ghi vĩnh viễn** (1 transaction).
- Given toàn bộ 2.652.748 dòng đã anchor / When `check_price_integrity --min-coverage 0.95` / Then `ok=true`, `coverage`=100%, 0 violation.
- Backup table: schema+count đúng mới được apply; `--limit` chỉ dùng dry-run.

## SCOPE / gates
Chỉ `integrity.py` + command + tests. Không deploy khi apply nền còn chạy. TDD fail-before; `pre-push-gate`; B8 re-audit; PR riêng.
