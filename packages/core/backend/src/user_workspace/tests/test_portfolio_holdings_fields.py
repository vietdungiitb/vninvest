"""S-00c - bo sung `company_name` / `industry` / `weight_pct` / `price_change_pct`.

Tien de bi phan bien (audit doc lap, C4): payload `holdings` truoc do chi co 9
field, KHONG co `sector`/`name`/`weight`/`24h%` - nen 4/13 cot cua trang Holdings
va group-by sector cua trang Allocation khong thi hanh duoc.

Nguon du lieu THAT (khong phai gia dinh):
- `company_name`, `industry` <- `market_data.models.StockProfile`
  (`market_data/models.py:32` va `:40`, verbose_name='Nganh')
- `price_change_pct`       <- `market_serving.models.SymbolSnapshot`

Rang buoc QUAN TRONG: `data` PHAI con la LIST PHANG nhu cu - 3 consumer dang
chay doc shape nay. Test nay khoa lai de loi do khong the lam ngan endpoint.

Fail-truoc/pass-sau: bo 4 field khoi payload => test nay FAIL.
"""

from decimal import Decimal

from django.test import SimpleTestCase

from user_workspace import portfolio_analytics_views as pav

NEW_FIELDS = ('company_name', 'industry', 'industry_reason', 'weight_pct', 'price_change_pct')


class HoldingsPayloadFieldTests(SimpleTestCase):
    """Kiem tra payload builder ghi du 4 field moi - test o muc code, khong can DB."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import datetime as _dt

        from market_serving.models import SymbolSnapshot

        today = _dt.date.today()

        class FakeSnap:
            def __init__(self, symbol, price, change_pct, stale=False):
                self.symbol = symbol
                self.price = Decimal(str(price)) if price is not None else None
                self.price_change_pct = (
                    Decimal(str(change_pct)) if change_pct is not None else None
                )
                self.stale = stale
                self.session_date = today

        cls._snap_cls = FakeSnap
        cls._snapshot_qs = SymbolSnapshot.objects

    def _build(self, symbols, holdings, price_map, profiles):
        """Chay lai phan tao payload cua view voi du lieu gia lap."""
        return pav._build_holdings_payload(
            holdings=holdings,
            price_map=price_map,
            profiles=profiles,
        )

    def test_holdings_payload_has_all_new_fields(self):
        snap = self._snap_cls("VNM", 70, 1.25)
        payload = self._build(
            ["VNM"],
            {"VNM": {"quantity": Decimal("100"), "avg_cost": Decimal("60")}},
            {"VNM": snap},
            {"VNM": ("Vinamilk", "Thuc pham")},
        )
        row = payload[0]
        for f in NEW_FIELDS:
            self.assertIn(f, row, f"thieu field moi: {f}")
        self.assertEqual(row["company_name"], "Vinamilk")
        self.assertEqual(row["industry"], "Thuc pham")
        self.assertEqual(row["price_change_pct"], 1.25)

    def test_weight_pct_is_relative_to_priced_total_only(self):
        snaps = {"VNM": self._snap_cls("VNM", 100, 1),
                 "FPT": self._snap_cls("FPT", 300, -1)}
        payload = self._build(
            ["VNM", "FPT"],
            {
                "VNM": {"quantity": Decimal("1"), "avg_cost": Decimal("90")},
                "FPT": {"quantity": Decimal("1"), "avg_cost": Decimal("300")},
            },
            snaps,
            {},
        )
        by_symbol = {r["symbol"]: r for r in payload}
        # 100 / 400 = 25%, 300 / 400 = 75%
        self.assertEqual(by_symbol["VNM"]["weight_pct"], 25.0)
        self.assertEqual(by_symbol["FPT"]["weight_pct"], 75.0)

    def test_unpriced_row_has_null_weight_not_zero(self):
        snaps = {"VNM": self._snap_cls("VNM", 100, 1), "FPT": self._snap_cls("FPT", None, None)}
        payload = self._build(
            ["VNM", "FPT"],
            {
                "VNM": {"quantity": Decimal("1"), "avg_cost": Decimal("90")},
                "FPT": {"quantity": Decimal("1"), "avg_cost": Decimal("300")},
            },
            snaps,
            {},
        )
        by_symbol = {r["symbol"]: r for r in payload}
        self.assertIsNone(by_symbol["FPT"]["weight_pct"])
        self.assertIsNone(by_symbol["FPT"]["market_value"])
        # VNM van 100% cua phan co gia - khong bi FPT keo ve 25%
        self.assertEqual(by_symbol["VNM"]["weight_pct"], 100.0)

    def test_missing_master_profile_yields_reason_code(self):
        snap = self._snap_cls("VNM", 70, 1)
        payload = self._build(
            ["VNM"],
            {"VNM": {"quantity": Decimal("1"), "avg_cost": Decimal("60")}},
            {"VNM": snap},
            {},  # khong co StockProfile
        )
        row = payload[0]
        self.assertEqual(row["industry"], pav.UNCLASSIFIED_INDUSTRY)
        self.assertEqual(row["industry_reason"], "no_master_profile")
        self.assertEqual(row["company_name"], "")

    def test_missing_snapshot_yields_null_change_pct_not_zero(self):
        payload = self._build(
            ["VNM"],
            {"VNM": {"quantity": Decimal("1"), "avg_cost": Decimal("60")}},
            {},  # khong co snapshot
            {"VNM": ("Vinamilk", "Thuc pham")},
        )
        self.assertIsNone(payload[0]["price_change_pct"])


class AllocationIndustryTests(SimpleTestCase):
    def test_allocation_rows_carry_industry(self):
        rows = pav._allocation_rows(
            {"VNM": Decimal("100"), "FPT": Decimal("300")},
            {"VNM": ("Vinamilk", "Thuc pham"), "FPT": ("FPT", "Cong nghe")},
        )
        by_symbol = {r["symbol"]: r for r in rows}
        self.assertEqual(by_symbol["VNM"]["industry"], "Thuc pham")
        self.assertEqual(by_symbol["FPT"]["industry"], "Cong nghe")
        # sap xep theo weight giam dan - phai giu nguyen
        self.assertEqual([r["symbol"] for r in rows], ["FPT", "VNM"])
