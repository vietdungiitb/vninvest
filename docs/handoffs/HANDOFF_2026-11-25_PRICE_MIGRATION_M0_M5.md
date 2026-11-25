# HANDOFF — Price normalization M0–M5 (2026-11-25)

- **Phạm vi**: chuẩn hóa OHLC về giá thật CafeF; sửa VCI/KBS trả giá đã điều chỉnh + `adj_close` double-adjust.
- **Branch**: `feat/price-mig-cutover` (worktree `D:\Mujoco Projects\wt\price-mig-cutover`). Dev head sau merge M5c: `f43e71e2c`.
- **Trạng thái**: `done` cho M0–M5 (code + dry-run + apply pilot). **Runtime cutover CHƯA bật** — flag `PRICE_ADJUSTED_DISPLAY` vẫn off.

## Kết quả + evidence
| Slice | PR | Evidence |
|---|---|---|
| M0 backup + bulk CafeF | #524 | `docs/evidence/widget-news-events/m0-bulk-coverage.md` — backup 99 MB sha256 `6c5a7e05…c19691`, bulk 2.308.756 dòng |
| M1 diff dry-run | #526 | `m1-diff.md` — 2022 matched 360.329 / db_only 5.130 / cafef_only 38.986, fingerprint `96f4ba51309dd038` |
| M2 schema | #527 | `m2-schema.md` — `price_source`/`adj_factor`, index CONCURRENTLY, rollback OK |
| M3 guard + pause | #528 | `m3-guard.md` — skip upsert cafef, `PRICE_MIGRATION_PAUSED`, 7/7 test |
| M4 apply HOSE 2022 | #529 | `m4-apply-20261125.md` + `m4-verify-db-2022.json` — **91.808 dòng cafef**, 298 unmapped, 91.808 adj_factor; SQL verify + sha256(sample20) `4aeb6182…b54d`, Res-1 đóng |
| M5a BE read contract | #530 | `m5a-read-contracts.md` — serializer/points/bars trả 3 field; 7/7; golden TPB `42750/17940/0.4196491228` |
| M5b domain consumers | #531 | `m5b-domain-consumers.md` — NAV 85500→35880, advisory/screener adjusted; 8/8; 826 test có 7 fail+15 error pre-existing (đối chứng HEAD) |
| M5c FE chart | #532 | `m5c-fe-cutover.md` + `m5c-gate-logs.txt` — scale O/H/L/C, lọc unmapped, skip realtime, R-A đóng; FE 3/3, tsc/build exit 0, BE 15 test OK |
| M6a guard unmapped | #535 | `m6a-guard-unmapped.md` — ingest skip `price_source in ('cafef','unmapped_cafef')`; RED→GREEN 5/5, regression 52 test OK |
| Apply HOSE 2021 | #538 | `m4-apply-2021-hose.md` — dry-run 87.947/3.002/0 → apply exit 0, DB `cafef=87.947`, `adj_factor=87.947`. Tổng HOSE 2021+2022 **179.755 dòng** |

Ledger: `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 627–637. Claims: `price-mig-*`, `price-mig-cutover`, `price-mig-guard-unmapped` đều `done`.

## Gate CHƯA đóng — KHÔNG bật flag khi chưa xong
1. **R1** (`pricing.py` fallback raw cho `unmapped_cafef` thay vì loại khỏi cửa sổ adjusted — plan `PLAN_PRICE_MIGRATION_CUTOVER_20261125.md:45`).
2. **R2** `price_basis` trên `AdvisoryRecord`/`ScreenerRunHistory` chưa gắn.
3. **R3** NAV quantity time-series (Transaction/LedgerEntry) chưa dùng — đã dùng `adj_close` nên nhất quán basis.
4. **R-B** `getPriceBasis()` chưa reactive (stale ~5s); chưa test component nhánh skip realtime.
5. ~~Guard ingest cho `unmapped_cafef`~~ — **đã đóng M6a** (#535).
6. Apply M4 cho HNX/UPCOM + các năm khác (đã xong HOSE 2021+2022 = 179.755 dòng; phần còn lại chưa apply).
7. Ops window: invalidate cache bulk-technicals/SOC inventory, recompute `SymbolSnapshot` + coverage, resume 5 beat job, E2E Playwright chụp ảnh mở xem. Backup S0 + rollback chọn lọc theo `inserted_keys` sẵn.

## Next steps / owner
- Owner chốt R1 định nghĩa xử lý `unmapped_cafef` → implement + test → re-audit.
- Owner quyết thời điểm mở ops window cutover (sau khi đóng R1–R3, R-B và apply M4 toàn 3 sàn).
- Không tự bật `PRICE_ADJUSTED_DISPLAY` / không tự resume beat.
