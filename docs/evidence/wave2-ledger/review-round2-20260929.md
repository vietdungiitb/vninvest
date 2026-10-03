Review vong 2 — 3 P0 moi, da dong bang test

Review doc lap vong 2 tra "Request changes": 3 P0. Ca 3 deu la regression DO CHINH
vong 1 cua toi, va ca 3 deu duoc chung minh bang test chay that.

P0-1. `Portfolio.delete()` HONG VO HINH VIEN - regression cua migration 0023
------------------------------------------------------------------
`Portfolio` so huu `LedgerEntry` bang `on_delete=CASCADE`, nen xoa danh muc phat
`DELETE` xuong bang con va bi trigger chan => 500 cho mot thao tac hoan toan hop
le. Reviewer reproduce duoc bang chinh endpoint that.
Da sua: `PortfolioDetailView.delete()` tra **409 + `portfolio_has_financial_history`**
khi danh muc co lich su tai chinh. Day la hanh vi **co chu dich** - D-17 yeu cau
giu ledger >= 7 nam va `LedgerEntry` la append-only, xoa cung danh muc la xoa
lich su giao dich. Danh muc rong thi xoa binh thuong (204).
3 test: rong -> 204, co lich su -> 409 va data con nguyen, xoa thang qua ORM ->
bi chan va khong mat du lieu.

P0-2. `cash_cross_check` BAT TREN 100% DANH MUC BINH THUONG - tin gia 0
--------------------------------------------------------------------------
Hai nguon tien mat duoc so tren **khac goc**: `compute_ledger` cong don tu
giao dich dau tien (khong co so du mo dau), con NAV cong them `opening_balance`.
Tru thang hai so khac goc thi `difference` **luon bang `-opening_balance`**.
Test ban dau dat `opening_balance = 0` - dung gia tri DUY NHAT che duoc loi.
Da sua: so sanh tren cung goc (`cash_from_cash_flow - opening_balance` vs
`cash_from_ledger`), kem `sign_convention` va `opening_balance_excluded` trong
payload chu khong chi trong comment test.
3 test voi `opening_balance` khac 0: du lieu nhat quan -> KHONG canh bao; ban
vuot -> van canh bao; so du 0 -> khong canh bao.

P0-3. FE BIEN `null` THANH `0` - danh muc day vi the bi hien thi la TRONG
-------------------------------------------------------------------
BE da tra `total_market_value: null` khi co ma chua co gia. FE lam
`Number(null) || 0` nen `marketValue === 0` va hien CTA "danh muc trong".
Backend sua loi "0 gia", FE dua lai dung loi do.
Da sua `SmartStatsHeader.js`: tach `marketValueKnown` / `dayPLKnown` /
`dayPLPctKnown`, hien "—" khi chua biet, va chi co CTA trong khi BE **that su**
tra 0. `unpriced_symbols` / `market_value_reason` tu BE van chua co consumer
nao - ghi vao OPEN_WORK.
5 test FE kiem hanh vi component. **Negative test da chay**: tam bo
`marketValueKnown` khoi dieu kien `isEmptyPortfolio` => 1 test do, khoi phuc
=> xanh.

P1 kem theo
----------
- Trigger `_mutation` tra `RETURN OLD` cho ca UPDATE va DELETE. Voi BEFORE
  UPDATE, `RETURN OLD` nghia la "ap dung gia tri CU" => UPDATE tro thanh no-op.
  Phai reng nhanh theo `TG_OP`. Bai test cua toi chi chay `SELECT 1` nen khong
  bat duoc; da viet lai thanh 3 test that: UPDATE co flag -> gia tri THAY DOI,
  DELETE co flag -> row thuc su bi xoa, flag off -> van bi chan.
- `0022` raise SAU `bulk_create`. An toan chi vi Django boc `RunPython` trong
  transaction - tinh dung dac nam o framework chu khong o code. Da chuyen kiem
  len TRUOC moi ghi. Test dung `TransactionTestCase` de khong co savepoint che,
  nen code sai se do mau.
- Giao dich tay (`external_id=''`) bi nhan ban moi lan chay lai, phong comment
  "idempotent". Da dung `tx-<pk>` lam `external_id` on dinh cho giao dich tay.
- Con 2 view dung gia von lam gia hien tai: `PortfolioEquityCurveView` va
  `PortfolioAllocationView`. Da chuyen sang null + `missing_symbols` /
  `unpriced_symbols` / `weight_covers_all_holdings`.

GATE THAT
---------
- GT1 tsc exit 0 - GT3 eslint 0 error / 3597 warning
- **GT4 vitest 699/699 x 3 lan lien tiep - D-19 DAT** (699 = 694 cua merge base
  + 5 test moi)
- 36 test dong loi review xanh (trong do 5 test moi cua vong 2)
- FULL SUITE 642 test / 13F / 2E. **13 con 11**: 2 test audit-log loc theo
  khoang ngay **cung do tren `dev` sach** (chay lai o main tree, DB `devchk` rieng)
  => phu thuoc thoi gian, khong phai hoi quy.
