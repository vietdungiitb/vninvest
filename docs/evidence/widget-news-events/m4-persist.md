# M4 — Persist theo lô (2026-11-25) — DRY-RUN ONLY

Branch `feat/price-mig-persist` · base dev `47effe783` (sau PR #528/M3) · Entry 631.
**CHƯA APPLY** — chỉ dry-run + audit thiết kế; ghi 4,58M dòng là quyết định lớn cần duyệt riêng.

## Code
- `market_data/cafef/persist.py` (pure, 4 test OK): `classify_row` 3 nhánh update/keep_unmapped/insert; `adj_factor = adj_close/close` (Q10) là SSOT hệ số; DB-only ⇒ `adj_close=NULL`, `price_source='unmapped_cafef'`; CafeF-only ⇒ insert.
- `management/commands/price_migration_persist.py`: **mặc định dry-run**; `--apply` chỉ chạy khi `PRICE_MIGRATION_PAUSED=1` (maintenance window M3). Pass 1 lưu id+price_source (O(n) nhỏ), pass 2 xử lý **streaming theo lô 2000**, mỗi lô 1 transaction. Lưu `inserted_keys` cho rollback S6. FIX lỗi OOM (exit 137) khi giữ ~360k model instances trong RAM.

## Dry-run thật 2022 (staging, KHÔNG ghi DB)
| Chỉ số | Giá trị |
|---|---|
| matched / update | 360.329 |
| db_only / keep_unmapped | 5.130 (dọn adj_close hỏng) |
| cafef_only / insert | 38.986 |
| assert_updated_equals_matched | **True — NHƯNG LÀ TAUTOLOGY** (`counts['update'] = len(matched)` ngay từ đầu), **không chứng minh write nào**. Audit Res-1: đây chính là tiêu chí false-green bị cấm — phải thay bằng đối chiếu DB SAU apply (số row `price_source='cafef'` + checksum 20 mã) trước khi bật `--apply`. |
| inserted_keys_count | 38.986 |

**Lệnh tái tạo (Res-2)**: trên VPS, `docker exec -w /app/src vninvest-core-api python manage.py price_migration_persist --exchange HOSE --year 2022 --out /tmp/m4_dryrun.json --inserted-keys-out /tmp/m4_keys.txt`; report copy về `docs/evidence/widget-news-events/m4-dryrun-2022.json`. Số trùng M1 vì cùng filter `date__year` — **chưa phải bằng chứng độc lập**, cần fingerprint riêng.

## Bẫy đã sửa
- OOM 137 (giữ cả 2 bảng + model instances) → streaming theo lô.
- `PRICE_MIGRATION_PAUSED` guard (M3) là điều kiện bắt buộc để `--apply` — không chạy ngoài maintenance window.

## Chưa làm / chờ
- Audit thiết kế persist trước khi apply thật.
- R3 từ M3: guard chỉ chặn `price_source='cafef'`; dòng `unmapped_cafef` cần mở rộng guard ở M4 apply (`data_ingest/tasks.py:722-725` → `.get('price_source') in ('cafef','unmapped_cafef')`). **Bắt buộc trước apply.**
- **Res-3 (MAJOR, apply)**: `--exchange` bắt buộc nhưng **không lọc** — `DailyPrice`/`CafefDailyPrice` không có field exchange (`models.py:63-94,110-139`). Chạy `--exchange HOSE` vẫn xử lý cả 3 sàn; chạy 3 exchange ⇒ ghi đè 3 lần. Phải giải nghĩa exchange từ bảng `StockProfile.exchange` (market_data/models.py) hoặc bỏ tham số cho M4/year-based. Chưa làm.
- **Res-4 (apply)**: N+1 ~360k query/năm (`price_migration_persist.py:106-107,131-133`); thiếu `VACUUM ANALYZE` + gate đĩa mỗi lô (plan:49) và checksum 20 mã (plan:50). Chưa làm.
- Backup S0 (`before_20261124.dump`) sẵn; rollback chọn lọc theo `inserted_keys` chưa implement (S6).
- Chưa đổi consumer (M5), chưa bulk 3 sàn các năm sâu.

⇒ **Giữ claim `in-progress`** — chỉ nghiệm thu phần dry-run/thiết kế. Chưa bật `--apply`.
