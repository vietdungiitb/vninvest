Review vong 3 — 1 HIGH + 2 MEDIUM, da dong; con 2 ticket de lai

Ba vong review, tung vong chan merge. Vong 3 tim 1 HIGH, 2 MEDIUM, 1 LOW, 1 INFO.

HIGH — `SET` khong bi ROLLBACK, co guard co the ket o 'on'
-------------------------------------------------------------
`0022_backwards` va 4 test dung `SET app.allow_ledger_mutation`, khong phai
`SET LOCAL`. `SET` dat co cho SESSION va Postgres **khong hoan tac khi ROLLBACK**
(da kiem chung: `BEGIN; SET ...; ROLLBACK;` van de lai `'on'`; `SET LOCAL` thi
khong).

Hau qua: neu `marked.delete()` nem loi, nhanh `finally` chay tren transaction
da hong, lenh `SET ... = 'off'` bi tu choi (`InFailedSqlTransaction`) va **co
ket o 'on'**. Voi `CONN_MAX_AGE=60` (settings.py:191) connection do duoc tai
dung cho cac request sau => trigger append-only va trigger tenant-match **tat
trong mot phut**, khong ai biet.

Da sua: `SET LOCAL` trong migration; `set_config(..., is_local=true)` o nhanh
`finally` de lenh nay khong fail tren transaction da hong. 4 test moi, trong do
`test_flag_does_not_survive_a_rollback` chung minh bang HANH VI bang cach bat co
trong transaction bi rollback roi doc lai o transaction sau.

MEDIUM — `tx-<pk>` co the dung ma broker
---------------------------------------
Broker gui `order_id`/`orderId`/`deal_id` la chuoi tuy y ben thu ba
(`tasks.py:332`). `UNIQUE (tenant, external_id)` chi loai truong hop rong, nen
mot ma broker tinh co trung `tx-123` se lam migration abort bang
`IntegrityError` mu — bien su co chat luong du lieu thanh loi khong truy vet
duoc. Da doi thanh namespace rieng `MANUAL_REF_PREFIX = 'manual:tx:'` va them
test kiem ca tinh on dinh (chay lai khong nhan ban) va tinh khac `tx-`.
**Bai test ban dau dung `external_id='B-1'` nen nhanh nay CHUA BAO GI chay** —
da them test moi voi `external_id=''` thu.

MEDIUM — snapshot vua ghi-mot-lan vua co UNIQUE => khong tinh lai duoc
-------------------------------------------------------------------
`PositionSnapshot` va `ValuationSnapshot` vua bi chan UPDATE/DELETE boi trigger,
vua bi `AppendOnlyMixin` chan, lai co UNIQUE `(portfolio, symbol, as_of_date)`
=> mot ngay da chot thi khong co cach nao sua hay tinh lai. Lat sau job snapshot
 dau tien se gap bai toan nay. **CHUA sua trong dot nay** (lam mon ke hoach
 snapshot) — ghi vao OPEN_WORK.

LOW — FE chua phan biet 409
---------------------------
`PortfoliosPage.tsx:94` va `PortfolioContext.js:561-570` hien thong bao chung,
khong nhan biet 409 `portfolio_has_financial_history`; noi dung FE van hua
"xoa day du" thoi gian. Da ghi vao OPEN_WORK.

INFO (pre-existing, khong phai branch nay)
-----------------------------------------
`invalidate_ledger_cache` bump mot key ma khong ai doc; `test_ledger_holdings.py`
do `from_cache` bang True. Da kiem chung byte-identical tren base `582445f6`.

TEST YEU TRONG FILE CUA CHINH TOI — da sua
-----------------------------------------
- `test_flag_off_still_blocks` khang dinh trang thai moi truong ma khong dat co
  OFF truoc ⇒ phu thuoc thu tu va, do loi #1, co the lan sang cac test khac.
  Da dat `set_config(..., false)` trong `setUp`.
- `CashCrossCheckFalsePositiveTests` chi dung vi the DA DONG nen
  `ledger['holdings']` rong va nhanh kiem gia bi bo qua mot cach am tham. Da
  them `close_position=False` va 2 test: vi the mo + du gia (khong canh bao),
  vi the mo + thieu gia (chan NAV, khong phai canh bao lech tien).
- Fixture cu cua `_run` tao ca SELL trong khi `close_position=False` ⇒ lech tien
  that, khong phai false positive. Da sua.

GATE THAT
---------
- GT6 check 0 issue - GT7 'No changes detected' - GT8 1 leaf duy nhat (0023)
- 52 test dong loi review + backfill xanh
- FULL SUITE 642 test / 13F / 2E (13F gom 2 test audit-log phu thuoc thoi gian,
  da kiem chung cung do tren `dev` sach)
- GT1 tsc exit 0 - GT3 eslint 0 error / 3597 warning
- GT4 vitest 699/699 x 3 lan lien tiep (D-19 DAT)
