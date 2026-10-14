# MODULES/user_workspace — User Workspace

> Tin cậy tổng: ✅ (luồng tiền + bất biến đã verify tay ở `06.01`, E2E staging).
> Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Không gian làm việc của user: danh mục (CRUD/KPI/holdings), sổ cái append-only,
môi giới DNSE/SSI/TCBS, watchlist, screener, subaccount, định giá NAV. Mọi bảng
tiền có tenant FK. Bất biến ở `06.01` §2 (append-only, idempotency, không archive).

## 2. Models (19 — chi tiết ở `06.02`)

`Portfolio`, `Transaction`, `LedgerEntry`, `CashFlow`, `PositionSnapshot`,
`ValuationSnapshot`, `DNSECredential`, `UserBrokerConfig`, `IdempotencyRecord`,
`ScreenerRule/Schedule/RunHistory`, `Watchlist(+Item)`, `SubAccount`,
`TrackedSymbol`, `PriceAlert`, `AccountSnapshot`, `QuarantinedRecord`
(14/19 có tenant FK trực tiếp; còn lại qua bảng cha — xem `06.02`).

## 3. API (58 route — chi tiết ở `07.02`)

`workspace/portfolios` (11), `broker/dnse` (7), `screener/*` (10),
`workspace/ai-command-center` (4), `watchlists` (4), `subaccounts` (3)… Luồng đặt
lệnh đầy đủ ở `05.01` WF-02 (`views_dnse.py:621`, kill-switch `:585`).

## 4. Job/signal

Có `user_workspace/tasks.py` + `user_workspace/signals.py` (`user_workspace/signals.py:113` bù trừ sổ cái) + valuation.

## 5. Finding mở

- F-UW-01 (⚠ kế thừa từ E2E staging, chưa đọc lại): `nav_reason_text` tiếng Việt
  hardcode trong BE — dossier xác minh trước khi sửa.
- Đã đóng trong slice trước: 409 khuyên sai (`suggested_action: rename`), cursor
  pagination, E2E CRUD 8 case 0 console error.

## 6. Test khóa + trạng thái

47 test file (nhiều thứ hai). Dossier v1 — app reference của repo.
