# PLAN TRIỂN KHAI CHI TIẾT — Chuyển đổi dữ liệu giá sang chuẩn CafeF (2026-11-24)

> Plan thiết kế đã **AGREE** sau 3 vòng audit: `docs/PLAN_PRICE_MIGRATION_FULL_20261124.md` (REVISION 2).
> Tài liệu này chỉ **triển khai**: slice, lệnh, claim, tiêu chí nghiệm thu. Chưa code.

## 0. Cấu trúc slice & ngưỡng dừng chung

| Slice | Phạm vi | Branch | Phụ thuộc |
|---|---|---|---|
| M0 | S0 Backup + S1 Bulk 3 sàn × 2011–2026 + coverage report | `feat/price-mig-bulk` | none |
| M1 | S2 Dry-run diff + phân loại DB-only + check chỉ số | `feat/price-mig-diff` | M0 |
| M2 | S3a Schema migration (`price_source`, `adj_factor`, index concurrently) | `feat/price-mig-schema` | M1 |
| M3 | S3b Guard upsert + pause 4 beat + 4 on-demand + anomaly 5m | `feat/price-mig-guard` | M2 |
| M4 | S3c Persist theo lô + lưu `inserted_keys` | `feat/price-mig-persist` | M3 |
| M5 | S4 invalidate + S5 recompute + deploy consumer + resume beat | `feat/price-mig-cutover` | M4 |
| M6 | S6 verify + rollback select + S7 dọn local fetcher | `feat/price-mig-verify` | M5 |

**Ngưỡng dừng chung** (chốt owner §0.5): lệch unit/ngày ⇒ halt; bước nhảy ⇒ warn+báo cáo; drift ≤0,5% ngày thường = REBASE_SHIFT; spike/lệch ngày/nhảy unit = DATA_ERROR halt. Mỗi slice ≤3 vòng sửa; quá ⇒ blocker dừng.

## M0 — Backup + Bulk

1. `agent-sync.ps1` → claim `price-mig-bulk` → branch `feat/price-mig-bulk`.
2. **S0**: trên VPS `pg_dump` riêng `market_data_dailyprice`, `market_data_cafefdailyprice`, `market_serving_symbolsnapshot`; ghi checksum; **gate đĩa trống ≥80 GB** (đã dọn 49 GB ở deploy trước — đo lại).
3. **S1**: đổi `cafef/importer.py:11` dùng `vnbroker.bulk_year` thay local `fetcher.py`; thêm `change_pct` vào `CafefDailyPrice` + `contract.normalize_row` + `importer._UPDATABLE` (trước khi bulk).
4. Chạy `preview_import` cho từng `(exchange, year)` rồi `run_import`; pacing ≥1 s; ghi `coverage` per-symbol. Log tổng dòng/năm.
5. **AC**: 3 sàn × 16 năm = 48 request; `TPB 2011 → coverage='missing'`; báo cáo phủ theo năm × sàn; 0 reject ngày; disk ≥80 GB.

## M1 — Dry-run diff

1. Command `price_migration_diff --dry-run`: so sánh từng `(symbol,date)` mọi field `close/adj_close/open/high/low/volume/value/change_pct`; phân loại DB-only thành 3 nhóm (chỉ số / huỷ niêm yết / rác) + check CafeF có trả chỉ số không.
2. Sinh file `docs/evidence/.../migration-diff.json`: số dòng đổi, phân bố chênh, `inserted_keys` dự kiến, danh sách drift classify.
3. **AC**: `updated_count` dự kiến == số `(symbol,date)` giao; bước nhảy chỉ warn; lệch unit/ngày halt; có danh sách 3 nhóm + kết luận chỉ số.

## M2 — Schema migration

1. Migration + `price_source` (CharField default `vnbroker_legacy`), `adj_factor` (Decimal nullable) trên `DailyPrice`; `CREATE INDEX CONCURRENTLY` riêng (không lock 4,58M dòng).
2. **AC**: migration apply trên DB riêng; index tồn tại; không downtime; rollback migration chạy được.

## M3 — Guard + Pause

1. Sửa **`data_ingest/tasks.py:792-798`**: skip upsert `(symbol,date)` có `price_source='cafef'`; giữ `vnbroker_adapter.py:763` nguyên.
2. Pause: 4 beat đang chạy (`daily-backfill-prices-1700`, `deep-history-bootstrap-weekly`, `pre5y-history-backfill-weekly`, `sync-corporate-actions-nightly`) + 4 on-demand + `detect-market-anomaly-alerts-5m`. KHÔNG pause `ingest-daily-prices-1705` (disabled).
3. Test giả lập nightly → 0 row cafef bị đổi; regression xanh.
4. **AC**: guard test + pause list verify (đọc scheduler config).

## M4 — Persist theo lô

1. Command `price_migration_persist --exchange --year [--apply]`: ghi mọi field từ `CafefDailyPrice` vào `DailyPrice`; **INSERT CafeF-only**; DB-only giữ `close` cũ + **`adj_close=NULL`** + `price_source='unmapped_cafef'`; **lưu `inserted_keys`** vào staging.
2. Chạy trong maintenance window; `VACUUM ANALYZE` giữa lô; gate disk mỗi lô.
3. **AC**: `updated_count == M1.diff.matched`; `inserted == len(inserted_keys)`; chạy lại `updated=0/inserted=0`; checksum mẫu 20 mã khớp CafeF; KHÔNG con số false-green "row count trước=after".

## M5 — Cutover

1. Xoá cache §4.2; đổi `/bars` metadata dùng `price_source=='cafef'` trong nhánh `_corporate_actions_enabled()`.
2. Deploy BE+FE: chart/technicals/screener/backtest/52w dùng adjusted (scale O/H/L qua `adj_factor`); NAV dùng quantity time-series; gắn `price_basis` cho record mới.
3. Recompute `SymbolSnapshot` + pre-open; resume 4 beat + anomaly task.
4. **AC E2E Playwright**: TPB 2022 chart adjusted 17.940 / toggle raw 42.750; NAV không sập giả ngày chia; snapshot `reference_price` khớp; không trộn basis; 0 alert giả.

## M6 — Verify + rollback + dọn

1. Đối chiếu 20 mã × 5 năm với CafeF; drift monitoring VCI/KBS 2 tuần.
2. Script rollback **chọn lọc**: `WHERE date<=cutover` từ bảng old_* + **DELETE `inserted_keys`**; thử rollback trên DB riêng trước khi chấp nhận.
3. Sau parity: dọn `market_data/cafef/{fetcher,parser}` local, giữ `CafefDailyPrice` staging.
4. **AC**: parity report; rollback thử thành công trên DB riêng; ledger Entry riêng mỗi slice; re-audit độc lập M5/M6.

## 1. Gate chung mỗi slice
`agent-sync.ps1` (rebase→gate) · `check-multi-agent.mjs` · `check-experiment-env.mjs` · BE test trên VPS DB riêng · `pre-push-gate` 36 PASS · claim `in-progress`→`done` · Ledger Entry riêng · PR merge-commit. Không commit thẳng `dev`. FE test nếu đụng FE: `tsc`, `build`, `check:shell`, baseline UI.

## 2. Reservation đã hấp thụ từ audit v3
Header REVISION 2 ✓ · `inserted_keys` ở S3c ✓ · job key `sync-corporate-actions-nightly` ✓.
