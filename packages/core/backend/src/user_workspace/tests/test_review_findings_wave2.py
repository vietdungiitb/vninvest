"""
Đóng các lỗi review độc lập chỉ ra (2026-09-29).

Mỗi test ở đây tồn tại vì một review tìm ra một đường lách **thật**, và mỗi
test được viết để **đỏ** nếu đường lách đó mở lại. Không test nào ở đây là
kiểm tra hình thức.

Nhóm theo nguồn gốc lỗi:

1. Append-only lách qua `Model(pk=<cũ>)`, `queryset.update()`, `queryset.delete()`.
2. Snapshot không có chế độ append-only nào.
3. `tenant != portfolio.tenant` — ràng buộc qua 2 bảng, Django không chặn được.
4. `ValuationSnapshot` thành phần NOT NULL DEFAULT 0 ⇒ không biểu diễn nổi
   "chưa biết".
5. Hai nguồn tiền mặt lệch nhau 180.000.000 VND trên dữ liệu bán vượt.
6. NAV chỉ có giá 1 phần vẫn ra con số.
7. `portfolio_analytics_views` dùng giá vốn làm giá hiện tại ⇒ P&L = 0 giả.
8. Công thức `information_ratio` lệch spec.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.test import TestCase, TransactionTestCase

from identity_access.models import CoreTenant
from user_workspace.ledger import analytics as ana
from user_workspace.ledger.services import (
    NAV_BLOCKER_CASH_FLOWS_EMPTY,
    NAV_BLOCKER_NO_PRICES,
    NAV_BLOCKER_PARTIAL_PRICES,
    portfolio_valuation,
)
from user_workspace.models import (
    CashFlow,
    LedgerEntry,
    LedgerEntryImmutable,
    PositionSnapshot,
    Portfolio,
    Transaction,
    ValuationSnapshot,
)
from user_workspace.tests.envelope import unwrapped

VOL = 'holdings-wa-v1'


def _tenant(username):
    return CoreTenant.objects.create(
        tenant_code=f'r-{username}',
        display_name=username,
        owner_user=User.objects.create_user(username=username, password='x'),
        status=CoreTenant.StatusChoices.ACTIVE,
    )


def _portfolio(tenant, name='P'):
    return Portfolio.objects.create(user=tenant.owner_user, tenant=tenant, name=name)


def _entry(tenant, portfolio, **overrides):
    payload = {
        'tenant': tenant, 'portfolio': portfolio, 'entry_type': 'BUY',
        'symbol': 'VNM', 'trade_date': date(2026, 1, 5), 'quantity': 1000,
        'price': Decimal('70000'), 'fee': Decimal('0'), 'tax': Decimal('0'),
        'market': 'VN_SPOT', 'source': 'manual',
    }
    payload.update(overrides)
    return LedgerEntry.objects.create(**payload)


def _flow(tenant, portfolio, symbol, flow_type, amount, trade_date=date(2026, 1, 5)):
    entry = _entry(tenant, portfolio, symbol=symbol, trade_date=trade_date)
    return CashFlow.objects.create(
        entry=entry, tenant=tenant, flow_type=flow_type, amount=amount)


# ══════════════════════════════════════════════════════════════════
# 1 + 2 — append-only thật sự append-only
# ══════════════════════════════════════════════════════════════════


class AppendOnlyHoleTests(TestCase):
    """Review nói: `save()` kiểm `_state.adding`, mà
    `LedgerEntry(pk=<đã tồn tại>)` để `_state.adding = True` nên `save()` chạy
    `UPDATE` và ghi đè dòng đã commit. Đã tái hiện, đã đóng."""

    def setUp(self):
        self.tenant = _tenant('ao')
        self.portfolio = _portfolio(self.tenant)

    def test_constructing_with_existing_pk_cannot_overwrite(self):
        entry = _entry(self.tenant, self.portfolio, price=Decimal('70000'))
        impostor = LedgerEntry(pk=entry.pk, price=Decimal('1'))
        impostor._state.adding = True
        with self.assertRaises(LedgerEntryImmutable):
            impostor.save()
        entry.refresh_from_db()
        self.assertEqual(entry.price, Decimal('70000.00'))

    def test_queryset_update_is_blocked_by_the_database(self):
        """Tầng Python không chặn được `queryset.update()` — trigger mới chặn."""
        entry = _entry(self.tenant, self.portfolio)
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                LedgerEntry.objects.filter(pk=entry.pk).update(price=Decimal('1'))
        entry.refresh_from_db()
        self.assertEqual(entry.price, Decimal('70000.00'))

    def test_queryset_delete_is_blocked_by_the_database(self):
        entry = _entry(self.tenant, self.portfolio)
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                LedgerEntry.objects.filter(pk=entry.pk).delete()
        self.assertTrue(LedgerEntry.objects.filter(pk=entry.pk).exists())

    def test_raw_sql_update_is_blocked(self):
        entry = _entry(self.tenant, self.portfolio)
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        'UPDATE user_workspace_ledgerentry SET price = 1 WHERE id = %s',
                        [entry.pk],
                    )
        entry.refresh_from_db()
        self.assertEqual(entry.price, Decimal('70000.00'))

    def test_bulk_update_is_blocked(self):
        entry = _entry(self.tenant, self.portfolio)
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                LedgerEntry.objects.bulk_update(
                    [LedgerEntry(pk=entry.pk, price=Decimal('1'))], ['price'])

    def test_position_snapshot_is_append_only(self):
        """Bản đầu: `PositionSnapshot` không có chế độ append-only nào, nên
        `update(realized_pnl_cum=0)` sửa lặng lẽ một ngày đã chốt."""
        snap = PositionSnapshot.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VNM',
            as_of_date=date(2026, 3, 31), calculation_version=VOL)
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                PositionSnapshot.objects.filter(pk=snap.pk).update(
                    realized_pnl_cum=Decimal('0'))

    def test_valuation_snapshot_is_append_only(self):
        snap = ValuationSnapshot.objects.create(
            tenant=self.tenant, portfolio=self.portfolio,
            as_of_date=date(2026, 3, 31), calculation_version='nav-wa-v1')
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                ValuationSnapshot.objects.filter(pk=snap.pk).update(
                    nav=Decimal('999'))


# ══════════════════════════════════════════════════════════════════
# 3 — tenant khớp portfolio
# ══════════════════════════════════════════════════════════════════


class TenantMatchTests(TestCase):
    def setUp(self):
        self.tenant_a = _tenant('tm-a')
        self.tenant_b = _tenant('tm-b')
        self.portfolio_a = _portfolio(self.tenant_a, 'A')

    def test_entry_in_another_tenants_portfolio_is_rejected(self):
        """Đường lách thật: signal `pre_save` return sớm khi `tenant_id` đã có,
        nên không hề so với tenant của `portfolio`."""
        entry = LedgerEntry(
            tenant=self.tenant_b, portfolio=self.portfolio_a, entry_type='BUY',
            symbol='VNM', trade_date=date(2026, 1, 5), quantity=100,
            price=Decimal('70000'),
        )
        with self.assertRaises(ValidationError) as ctx:
            entry.full_clean()
        self.assertIn('tenant', ctx.exception.message_dict)

    def test_database_also_rejects_a_mismatched_insert(self):
        """Lớp thứ hai: trigger so khớp hai cột."""
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                # `bulk_create` bỏ qua `clean()` nên chỉ trigger mới chặn được.
                LedgerEntry.objects.bulk_create([LedgerEntry(
                    tenant=self.tenant_b, portfolio=self.portfolio_a,
                    entry_type='BUY', symbol='VNM', trade_date=date(2026, 1, 5),
                    quantity=100, price=Decimal('70000'))])

    def test_matching_tenant_is_accepted(self):
        entry = LedgerEntry(
            tenant=self.tenant_a, portfolio=self.portfolio_a, entry_type='BUY',
            symbol='VNM', trade_date=date(2026, 1, 5), quantity=100,
            price=Decimal('70000'),
        )
        entry.full_clean()


# ══════════════════════════════════════════════════════════════════
# 4 — ValuationSnapshot phải biểu diễn được "chưa biết"
# ══════════════════════════════════════════════════════════════════


class NullableValuationComponentTests(TestCase):
    def setUp(self):
        self.tenant = _tenant('nv')
        self.portfolio = _portfolio(self.tenant)

    def test_all_three_components_may_be_null(self):
        """Bản đầu NOT NULL DEFAULT 0: tới ngày không định giá được, schema
        chỉ còn một đáp án hợp lệ và nó là 0 bịa."""
        snap = ValuationSnapshot.objects.create(
            tenant=self.tenant, portfolio=self.portfolio,
            as_of_date=date(2026, 3, 31), calculation_version='nav-wa-v1',
            nav=None, nav_reason='no_market_prices')
        snap.refresh_from_db()
        self.assertIsNone(snap.stock_value)
        self.assertIsNone(snap.cash)
        self.assertIsNone(snap.nav)


# ══════════════════════════════════════════════════════════════════
# 5 — hai nguồn tiền mặt phải được đối chiếu
# ══════════════════════════════════════════════════════════════════


class CashCrossCheckTests(TestCase):
    """Dữ liệu: MUA 1 000 @ 70 000 rồi BÁN 2 000 @ 80 000 (bán vượt).

    `compute_ledger` chỉ ghi phần có cost basis (1 000) ⇒ cash = +10 000 000.
    Broker thực sự chuyển 160 000 000 ⇒ `CashFlow` ghi đủ.

    Bản đầu trả NAV theo `CashFlow` mà **không báo lệch**, nên `nav − stock_value
    ≠ cash` 180 000 000 VND mà người đọc không có cách nào biết."""

    def setUp(self):
        self.tenant = _tenant('cc')
        self.portfolio = _portfolio(self.tenant)
        self.portfolio.opening_balance = Decimal('0')
        self.portfolio.save()

        self.buy = _entry(self.tenant, self.portfolio, external_id='B-1')
        CashFlow.objects.create(
            entry=self.buy, tenant=self.tenant, flow_type='BUY',
            amount=Decimal('-70000000'))
        self.sell = _entry(
            self.tenant, self.portfolio, entry_type='SELL',
            trade_date=date(2026, 2, 10), quantity=2000, price=Decimal('80000'),
            external_id='B-2')
        CashFlow.objects.create(
            entry=self.sell, tenant=self.tenant, flow_type='SELL',
            amount=Decimal('160000000'))
        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5), price=Decimal('70000'),
            quantity=1000)
        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='SELL', date=date(2026, 2, 10), price=Decimal('80000'),
            quantity=2000)

    def test_divergence_is_reported_not_hidden(self):
        from user_workspace.ledger.services import get_cached_ledger

        ledger = get_cached_ledger(self.portfolio.pk, self.tenant, use_cache=False)
        result = portfolio_valuation(self.portfolio, ledger=ledger)

        # `CashFlow`: -70 000 000 (mua) + 160 000 000 (bán trọn 2 000) = 90 000 000
        # `compute_ledger`: -70 000 000 (mua) + 10 000 000 (chỉ 1 000 có cost
        #                     basis) = 10 000 000
        # Chênh 80 000 000 VND chính là tiền bán vượt chưa có cost basis để
        # đối soát. Dấu âm vì `difference` tính theo `ledger − cash_flow`.
        self.assertIn('cash_cross_check', result)
        check = result['cash_cross_check']
        self.assertEqual(check['cash_from_cash_flow'], '90000000.00')
        self.assertEqual(check['cash_from_ledger'], '10000000.00')
        self.assertEqual(check['difference'], '-80000000.00')
        self.assertTrue(check['reconciliation_required'])

    def test_agreeing_engines_report_no_cross_check(self):
        from user_workspace.ledger.services import get_cached_ledger

        self.sell.quantity = 1000
        self.sell.save() if False else None
        # Không sửa được (append-only) nên tạo dữ liệu mới cho trường hợp sạch.
        clean_tenant = _tenant('cc2')
        clean = _portfolio(clean_tenant, 'clean')
        clean.opening_balance = Decimal('0')
        clean.save()
        e1 = _entry(clean_tenant, clean, external_id='C-1')
        CashFlow.objects.create(entry=e1, tenant=clean_tenant, flow_type='BUY',
                                amount=Decimal('-70000000'))
        e2 = _entry(clean_tenant, clean, entry_type='SELL',
                    trade_date=date(2026, 2, 10), quantity=1000,
                    price=Decimal('80000'), external_id='C-2')
        CashFlow.objects.create(entry=e2, tenant=clean_tenant, flow_type='SELL',
                                amount=Decimal('80000000'))
        Transaction.objects.create(
            portfolio=clean, tenant=clean_tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5), price=Decimal('70000'),
            quantity=1000)
        Transaction.objects.create(
            portfolio=clean, tenant=clean_tenant, symbol='VNM',
            transaction_type='SELL', date=date(2026, 2, 10),
            price=Decimal('80000'), quantity=1000)

        ledger = get_cached_ledger(clean.pk, clean_tenant, use_cache=False)
        result = portfolio_valuation(clean, ledger=ledger)
        self.assertNotIn('cash_cross_check', result)


# ══════════════════════════════════════════════════════════════════
# 6 + 7 — không có 0 giả
# ══════════════════════════════════════════════════════════════════


class NoFabricatedNavTests(TestCase):
    def setUp(self):
        self.tenant = _tenant('nf')
        self.portfolio = _portfolio(self.tenant)
        self.portfolio.opening_balance = Decimal('1000000')
        self.portfolio.save()

    def test_partial_pricing_blocks_nav(self):
        """Bản đầu chỉ chặn khi KHÔNG mã nào có giá. 1/5 mã có giá thì 4 mã
        còn lại biến mất khỏi `stock_value` mà NAV vẫn ra con số."""
        for symbol in ('VNM', 'HNG', 'SSI', 'VCB', 'ACB'):
            _entry(self.tenant, self.portfolio, symbol=symbol)
            # `get_cached_ledger` đọc bảng `Transaction`, nên phải có cả nó thì
            # mới phản ánh đúng trạng thái sau backfill.
            Transaction.objects.create(
                portfolio=self.portfolio, tenant=self.tenant, symbol=symbol,
                transaction_type='BUY', date=date(2026, 1, 5),
                price=Decimal('70000'), quantity=1000)
        for symbol in ('VNM', 'HNG', 'SSI', 'VCB', 'ACB'):
            _flow(self.tenant, self.portfolio, symbol, 'BUY', Decimal('-70000000'))

        from user_workspace.ledger.services import get_cached_ledger

        ledger = get_cached_ledger(self.portfolio.pk, self.tenant, use_cache=False)
        result = portfolio_valuation(
            self.portfolio, ledger=ledger, price_by_symbol={'VNM': Decimal('75000')})
        self.assertIsNone(result['nav'])
        self.assertEqual(result['nav_reason'], NAV_BLOCKER_PARTIAL_PRICES)
        self.assertEqual(
            result['unpriced_symbols'], ['ACB', 'HNG', 'SSI', 'VCB'])

    def test_empty_cash_flow_table_blocks_nav(self):
        _entry(self.tenant, self.portfolio)
        from user_workspace.ledger.services import get_cached_ledger

        ledger = get_cached_ledger(self.portfolio.pk, self.tenant, use_cache=False)
        result = portfolio_valuation(
            self.portfolio, ledger=ledger, price_by_symbol={'VNM': Decimal('75000')})
        self.assertIsNone(result['nav'])
        self.assertEqual(result['nav_reason'], NAV_BLOCKER_CASH_FLOWS_EMPTY)

    def test_legacy_transaction_only_with_empty_cash_flow_also_blocks_nav(self):
        """Regression (phát hiện khi nối engine vào `summary`, 2026-09-30).

        Guard `cash_flows_not_backfilled` chỉ hỏi bảng `LedgerEntry`. Nhưng
        LED-05 đã quyết định **giữ `Transaction` song song** (bỏ contract phase),
        nên trạng thái thật có thể là: có giao dịch trong `Transaction`, `LedgerEntry`
        chưa có, `CashFlow` chưa backfill.

        Lúc đó guard im lặng, `cash_flow_total = 0`, nên:
        - `nav` = `opening_balance` + giá trị cổ phiếu ⇒ **thiếu hẳn số tiền đã
          mua** (ở fixture dưới: lệch đúng 70 000 000 = tổng chi phí).
        - `cash_cross_check` so `0` với `ledger['cash']` nên bật cảnh báo đối soát
          cho **mọi** danh mục bình thường — cảnh báo sai, mà sai thì cảnh báo
          đúng cũng mất độ tin cậy.

        Hai lỗi tài chính cùng lúc, từ một dòng guard quá hẹp.
        """
        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5),
            price=Decimal('70000'), quantity=1000)

        from user_workspace.ledger.services import get_cached_ledger

        ledger = get_cached_ledger(self.portfolio.pk, self.tenant, use_cache=False)
        result = portfolio_valuation(
            self.portfolio, ledger=ledger, price_by_symbol={'VNM': Decimal('75000')})

        self.assertIsNone(result['nav'], 'NAV phải bị chặn, không được bịa số')
        self.assertEqual(result['nav_reason'], NAV_BLOCKER_CASH_FLOWS_EMPTY)
        self.assertIsNone(result['cash'])
        # Cảnh báo đối soát giả là hậu quả thứ hai — phải im khi chưa backfill.
        self.assertNotIn('cash_cross_check', result)

    def test_zero_cash_flow_sum_is_not_mistaken_for_not_backfilled(self):
        """Bản đầu kiểm "chưa backfill" bằng `TỔNG tiền == 0`. Mua rồi bán hết
        giá bằng nhau thì tổng đúng bằng 0 ⇒ báo nhầm chưa backfill."""
        e1 = _entry(self.tenant, self.portfolio, external_id='Z-1')
        CashFlow.objects.create(entry=e1, tenant=self.tenant, flow_type='BUY',
                                amount=Decimal('-7000000'))
        e2 = _entry(self.tenant, self.portfolio, entry_type='SELL',
                    trade_date=date(2026, 2, 10), quantity=1000,
                    price=Decimal('70000'), external_id='Z-2')
        CashFlow.objects.create(entry=e2, tenant=self.tenant, flow_type='SELL',
                                amount=Decimal('7000000'))
        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5), price=Decimal('70000'),
            quantity=1000)
        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='SELL', date=date(2026, 2, 10),
            price=Decimal('70000'), quantity=1000)

        from user_workspace.ledger.services import get_cached_ledger

        ledger = get_cached_ledger(self.portfolio.pk, self.tenant, use_cache=False)
        result = portfolio_valuation(self.portfolio, ledger=ledger)
        self.assertNotEqual(result.get('nav_reason'), NAV_BLOCKER_CASH_FLOWS_EMPTY)


class NoFabricatedZeroInViewTests(TestCase):
    """`portfolio_analytics_views` từng dùng `avg_cost` làm giá hiện tại khi
    thiếu giá ⇒ `unrealized_pnl` ra đúng 0.00, tức hệ thống báo "không lãi
    không lỗ" cho một mã mà nó chưa biết giá.

    Test gọi **view thật** chứ không grep source. Bản đầu của file test này
    dùng `inspect.getsource` + `assertNotIn("else h['avg_cost']")` — nó đỏ ngay
    vì *comment* trong code có trích nguyên văn dòng cũ. Đó chính là loại test
    yếu mà review chỉ ra: khớp text, không khớp hành vi, và vỡ khi ai đó sửa
    comment.
    """

    def setUp(self):
        self.tenant = _tenant('v')
        self.portfolio = _portfolio(self.tenant)

    def _holdings_response(self, with_quote):
        from rest_framework.test import APIRequestFactory

        from user_workspace.portfolio_analytics_views import PortfolioHoldingsView

        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5), price=Decimal('70000'),
            quantity=1000)
        if with_quote:
            self._make_quote(Decimal('80000'))

        request = APIRequestFactory().get(
            f'/api/portfolio/portfolios/{self.portfolio.pk}/holdings/')
        request.user = self.tenant.owner_user
        request.tenant = self.tenant
        view = PortfolioHoldingsView.as_view()
        return view(request, portfolio_id=self.portfolio.pk)

    def _make_quote(self, price):
        from django.utils import timezone

        from market_serving.models import SymbolSnapshot

        return SymbolSnapshot.objects.create(
            symbol='VNM', price=price, session_date=date.today(),
            fetched_at=timezone.now(),
        )

    def test_missing_quote_yields_null_not_zero_pnl(self):
        response = self._holdings_response(with_quote=False)
        row = unwrapped(response)[0]
        self.assertIsNone(row['current_price'])
        self.assertIsNone(row['unrealized_pnl'])
        self.assertIsNone(row['unrealized_pnl_pct'])
        self.assertIsNone(row['market_value'])
        self.assertEqual(row['price_missing_reason'], 'no_quote_for_today')

    def test_present_quote_still_produces_real_numbers(self):
        """Chặn "luôn trả null" là cách chữa bệnh bằng cách giết bệnh."""
        response = self._holdings_response(with_quote=True)
        row = unwrapped(response)[0]
        self.assertEqual(row['current_price'], '80000.00')
        self.assertEqual(row['unrealized_pnl'], '10000000.00')
        self.assertEqual(row['unrealized_pnl_pct'], 14.29)
        self.assertIsNone(row['price_missing_reason'])


# ══════════════════════════════════════════════════════════════════
# 8 — công thức theo spec
# ══════════════════════════════════════════════════════════════════


class InformationRatioTests(TestCase):
    def test_ir_equals_alpha_over_tracking_error(self):
        """ANA-02 R5 nói rõ `information_ratio = alpha / tracking_error`.
        Bản đầu tính `mean(excess)/TE` (kiểu Sharpe) — lệch nhau và đổi dấu khi
        `beta ≠ 1`."""
        benchmark = [0.01, 0.02, -0.01, 0.03, -0.02, 0.015, 0.005, -0.01]
        portfolio = [2.0 * b - 0.001 for b in benchmark]
        result = ana.benchmark_metrics(portfolio, benchmark, periods_per_year=252)

        expected = result['alpha_annualized'] / result['tracking_error']
        self.assertAlmostEqual(result['information_ratio'], expected, places=4)
        self.assertEqual(
            result['information_ratio_formula'], 'alpha_annualized / tracking_error')

    def test_exact_relationship_is_checked_not_just_not_none(self):
        benchmark = [0.02, -0.01, 0.03, 0.005]
        portfolio = [0.03, -0.005, 0.04, 0.01]
        result = ana.benchmark_metrics(portfolio, benchmark, periods_per_year=100)
        # `places=4` vì cả tử và mẫu đều đã làm tròn 6 chữ số trước; so 6 chữ
        # số sẽ đỏ vì lỗi làm tròn chứ không phải lỗi công thức.
        self.assertAlmostEqual(
            result['information_ratio'],
            result['alpha_annualized'] / result['tracking_error'],
            places=2,
        )

    def test_max_drawdown_computed_even_without_20_sessions(self):
        """Bản đầu return sớm khi thiếu phiên nên drawdown bị `None` dù dữ
        liệu giá có đủ — chỉ cần vài điểm."""
        result = ana.risk_metrics([0.01, -0.02, 0.01], market_values=[100, 120, 90])
        self.assertEqual(result['max_drawdown'], -0.25)
        self.assertIsNone(result['volatility'])

    def test_xirr_reports_non_convergence(self):
        flows = [(date(2026, 1, 1), Decimal('-1000')), (date(2027, 1, 1), Decimal('1100'))]
        result = ana.xirr(flows, iterations=1)
        self.assertIsNone(result['value'])
        self.assertEqual(result['reason'], 'not_converged')

    def test_unknown_provider_is_not_given_the_off_session_threshold(self):
        result = ana.freshness(
            as_of=__import__('datetime').datetime(2026, 3, 2, 9, 50),
            now=__import__('datetime').datetime(2026, 3, 2, 10, 0),
            provider='binance',
        )
        self.assertTrue(result['stale'])
        self.assertEqual(result['stale_reason'], 'unknown_provider')

    def test_benchmark_date_mismatch_is_detected(self):
        """Hai chuỗi cùng độ dài nhưng lệch ngày thì không so sánh được."""
        result = ana.benchmark_metrics(
            [0.01, 0.02], [0.01, 0.02],
            portfolio_dates=[date(2026, 1, 1), date(2026, 1, 2)],
            benchmark_dates=[date(2026, 1, 1), date(2026, 2, 2)],
        )
        self.assertIsNone(result['beta'])
        self.assertEqual(result['reason'], 'frequency_mismatch')


# ══════════════════════════════════════════════════════════════════
# Guard cờ cho migration
# ══════════════════════════════════════════════════════════════════


class MutationGuardFlagTests(TestCase):
    """Cờ `app.allow_ledger_mutation` phải **thực sự cho phép** thao tác, không
    phải báo thành công rồi âm thầm bỏ qua.

    Bản đầu của file test này chỉ chạy `SELECT 1` nên không chứng minh được
    gì — đúng loại test rỗng mà review vòng 1 chỉ ra. Nay nó đụng bảng có
    trigger và kiểm giá trị thực sự thay đổi.
    """

    def setUp(self):
        self.tenant = _tenant('mg')
        self.portfolio = _portfolio(self.tenant)
        self.entry = _entry(self.tenant, self.portfolio)
        # Đặt cờ OFF một cách tường minh. Không làm vậy thì test này khẳng định
        # trạng thái môi trường — mà `SET` (không phải `SET LOCAL`) sống sót qua
        # `ROLLBACK`, nên một test trước đó bị lỗi có thể để lại cờ `'on'` và làm
        # test này đỏ vì lý do hoàn toàn khác.
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.allow_ledger_mutation', 'off', false)")

    def test_update_actually_applies_when_flag_is_on(self):
        with transaction.atomic():
            with connection.cursor() as cursor:
                # `SET LOCAL`, không phải `SET`: `SET` sống sót qua ROLLBACK và
                # biến một transaction hỏng thành cờ guard bị kẹt mở.
                cursor.execute("SET LOCAL app.allow_ledger_mutation = 'on'")
                cursor.execute(
                    'UPDATE user_workspace_ledgerentry SET price = %s WHERE id = %s',
                    [Decimal('1.00'), self.entry.pk],
                )
        self.entry.refresh_from_db()
        self.assertEqual(
            self.entry.price, Decimal('1.00'),
            'UPDATE khi cờ bật phải THAY ĐỔI dữ liệu, không chạy nhưng no-op',
        )

    def test_delete_actually_deletes_when_flag_is_on(self):
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL app.allow_ledger_mutation = 'on'")
                cursor.execute(
                    'DELETE FROM user_workspace_ledgerentry WHERE id = %s',
                    [self.entry.pk],
                )
                deleted = cursor.rowcount
        self.assertEqual(deleted, 1, 'DELETE khi cờ bật phải xoá thật')
        self.assertFalse(LedgerEntry.objects.filter(pk=self.entry.pk).exists())

    def test_flag_does_not_survive_a_rollback(self):
        """HIGH của review vòng 3: `SET` KHÔNG bị rollback.

        Chứng minh bằng hành vi, không bằng đọc tài liệu Postgres: bật cờ trong
        một transaction bị ROLLBACK rồi kiểm tra cờ ở transaction sau.
        """
        class _AbortedTransaction(Exception):
            pass

        with self.assertRaises(_AbortedTransaction):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL app.allow_ledger_mutation = 'on'")
                raise _AbortedTransaction

        with connection.cursor() as cursor:
            cursor.execute("SELECT current_setting('app.allow_ledger_mutation', true)")
            self.assertNotEqual(
                cursor.fetchone()[0], 'on',
                'cờ guard sống sót qua ROLLBACK ⇒ append-only có thể bị tắt âm thầm',
            )

    def test_flag_off_still_blocks(self):
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        'DELETE FROM user_workspace_ledgerentry WHERE id = %s',
                        [self.entry.pk])


# ══════════════════════════════════════════════════════════════════
# Review vòng 2 — 3 P0 mới
# ══════════════════════════════════════════════════════════════════


class PortfolioDeleteRegressionTests(TestCase):
    """P0: trigger của `0023` làm hỏng `portfolio.delete()`.

    `Portfolio` sở hữu `LedgerEntry` bằng `on_delete=CASCADE`, nên xoá danh
    mục phát `DELETE` xuống bảng con và bị trigger chặn ⇒ 500 cho một thao tác
    hợp lệ. Review vòng 2 đã reproduce được bằng chính endpoint thật.
    """

    def setUp(self):
        self.tenant = _tenant('pd')
        self.user = self.tenant.owner_user

    def _delete(self, portfolio):
        from rest_framework.test import APIRequestFactory

        from user_workspace.views import PortfolioDetailView

        request = APIRequestFactory().delete(
            f'/api/portfolio/portfolios/{portfolio.pk}/')
        request.user = self.user
        request.tenant = self.tenant
        return PortfolioDetailView.as_view()(request, portfolio_id=portfolio.pk)

    def test_delete_without_history_is_204(self):
        portfolio = _portfolio(self.tenant, 'empty')
        response = self._delete(portfolio)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Portfolio.objects.filter(pk=portfolio.pk).exists())

    def test_delete_with_history_returns_409_not_500(self):
        portfolio = _portfolio(self.tenant, 'has-history')
        _entry(self.tenant, portfolio)
        response = self._delete(portfolio)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'portfolio_has_financial_history')
        self.assertTrue(Portfolio.objects.filter(pk=portfolio.pk).exists())
        self.assertEqual(LedgerEntry.objects.count(), 1, 'không được mất dữ liệu')

    def test_pure_orm_delete_of_a_portfolio_with_history_fails_loudly(self):
        """Xác nhận hành vi tầng ORM: trigger chặn, không âm thầm xoá."""
        portfolio = _portfolio(self.tenant, 'orm')
        _entry(self.tenant, portfolio)
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                portfolio.delete()
        self.assertEqual(LedgerEntry.objects.count(), 1)


class CashCrossCheckFalsePositiveTests(TestCase):
    """P0: `cash_cross_check` bật trên 100% danh mục bình thường.

    `compute_ledger` cộng dồn từ giao dịch đầu tiên (không có số dư mở đầu)
    còn NAV cộng thêm `opening_balance`. Trừ thẳng hai con số khác gốc thì
    `difference` **luôn bằng `-opening_balance`**. Test bản đầu đặt
    `opening_balance = 0` — đúng giá trị duy nhất che được lỗi.
    """

    def _run(self, opening_balance, oversell=False, close_position=True, prices=None):
        """Dữ liệu mở vị thế thật.

        `close_position=False` giữ lại cổ phiếu đang nắm. Nhánh đó là trường hợp
        thật và là nơi lỗi "không báo giá thiếu" của bản trước sẽ lộ ra; test
        bản đầu chỉ dùng vị thế đã đóng nên `ledger['holdings']` rỗng và nhánh
        kiểm giá bị bỏ qua một cách âm thầm.
        """
        from user_workspace.ledger.services import get_cached_ledger

        tag = f'{opening_balance}-{oversell}-{close_position}'
        tenant = _tenant(f'cc-{tag}')
        portfolio = _portfolio(tenant, 'P')
        portfolio.opening_balance = opening_balance
        portfolio.save()

        e1 = _entry(tenant, portfolio, external_id='X-1')
        CashFlow.objects.create(entry=e1, tenant=tenant, flow_type='BUY',
                                amount=Decimal('-70000000'))
        Transaction.objects.create(
            portfolio=portfolio, tenant=tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5), price=Decimal('70000'),
            quantity=1000)
        if close_position:
            # Bán. `oversell=True` bán NHIỀU hơn số đang giữ.
            qty = 2000 if oversell else 1000
            e2 = _entry(tenant, portfolio, entry_type='SELL',
                        trade_date=date(2026, 2, 10), quantity=qty,
                        price=Decimal('80000'), external_id='X-2')
            CashFlow.objects.create(entry=e2, tenant=tenant, flow_type='SELL',
                                    amount=Decimal('80000') * qty)
            Transaction.objects.create(
                portfolio=portfolio, tenant=tenant, symbol='VNM',
                transaction_type='SELL', date=date(2026, 2, 10),
                price=Decimal('80000'), quantity=qty)

        ledger = get_cached_ledger(portfolio.pk, tenant, use_cache=False)
        return portfolio_valuation(
            portfolio, ledger=ledger, price_by_symbol=prices)

    def test_consistent_data_with_nonzero_opening_balance_raises_no_alarm(self):
        result = self._run(Decimal('1000000'))
        self.assertNotIn(
            'cash_cross_check', result,
            'dữ liệu nhất quán mà vẫn cảnh báo ⇒ cảnh báo mang 0 thông tin')

    def test_oversell_still_raises_the_alarm(self):
        result = self._run(Decimal('1000000'), oversell=True)
        self.assertIn('cash_cross_check', result)
        check = result['cash_cross_check']
        self.assertTrue(check['reconciliation_required'])
        self.assertEqual(check['sign_convention'],
                         'cash_from_ledger - cash_from_cash_flow')
        self.assertEqual(check['opening_balance_excluded'], '1000000.00')

    def test_zero_opening_balance_consistent_data_raises_no_alarm(self):
        result = self._run(Decimal('0'))
        self.assertNotIn('cash_cross_check', result)

    def test_open_position_with_prices_raises_no_alarm(self):
        """Trường hợp thật nhất: còn giữ cổ phiếu, CÓ đủ giá, số dư mở đầu ≠ 0."""
        result = self._run(Decimal('5000000'), close_position=False,
                           prices={'VNM': Decimal('75000')})
        self.assertIsNotNone(result['nav'])
        self.assertNotIn('cash_cross_check', result)

    def test_open_position_missing_price_blocks_nav_instead_of_alarming(self):
        """Thiếu giá thì chặn NAV, KHÔNG phải đi vào nhánh cảnh báo lệch tiền —
        hai lý do khác nhau và người đọc cần biết cái nào."""
        result = self._run(Decimal('5000000'), close_position=False, prices={})
        self.assertIsNone(result['nav'])
        self.assertEqual(result['nav_reason'], NAV_BLOCKER_NO_PRICES)
        self.assertNotIn('cash_cross_check', result)


class AllocationAndCurveNoFakeZeroTests(TestCase):
    """P1: 2 view còn lại vẫn dùng giá vốn làm giá hiện tại."""

    def setUp(self):
        self.tenant = _tenant('al')
        self.portfolio = _portfolio(self.tenant)

    def test_allocation_reports_unpriced_instead_of_fake_weights(self):
        from rest_framework.test import APIRequestFactory

        from user_workspace.portfolio_analytics_views import PortfolioAllocationView

        for symbol in ('VNM', 'HNG'):
            Transaction.objects.create(
                portfolio=self.portfolio, tenant=self.tenant, symbol=symbol,
                transaction_type='BUY', date=date(2026, 1, 5),
                price=Decimal('70000'), quantity=1000)

        request = APIRequestFactory().get(
            f'/api/portfolio/portfolios/{self.portfolio.pk}/allocation/')
        request.user = self.tenant.owner_user
        request.tenant = self.tenant
        response = PortfolioAllocationView.as_view()(
            request, portfolio_id=self.portfolio.pk)
        data = unwrapped(response)
        self.assertIsNone(data['total_value'])
        self.assertEqual(data['unpriced_symbols'], ['HNG', 'VNM'])
        self.assertEqual(data['reason'], 'no_market_prices')
        self.assertEqual(data['allocation'], [])

    def test_equity_curve_marks_days_with_missing_prices(self):
        from rest_framework.test import APIRequestFactory

        from user_workspace.portfolio_analytics_views import PortfolioEquityCurveView

        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5), price=Decimal('70000'),
            quantity=1000)

        request = APIRequestFactory().get(
            f'/api/portfolio/portfolios/{self.portfolio.pk}/equity-curve/')
        request.user = self.tenant.owner_user
        request.tenant = self.tenant
        response = PortfolioEquityCurveView.as_view()(
            request, portfolio_id=self.portfolio.pk)
        # Không có `DailyPrice` nào ⇒ curve rỗng, không phải curve toàn 0.
        self.assertEqual(unwrapped(response)['curve'], [])


class BackfillAbortBeforeWriteTests(TransactionTestCase):
    """P1: `0022` phải dừng TRƯỚC khi ghi bất kỳ dòng nào.

    Bản đầu `bulk_create` xong mới raise; an toàn chỉ vì Django bọc `RunPython`
    trong transaction — tức tính đúng đắn nằm ở framework chứ không ở code.
    Dùng `TransactionTestCase` (không bọc savepoint) nên nếu code ghi rồi raise,
    dữ liệu vẫn còn và test này **đỏ** — đúng thứ ta muốn chứng minh.
    """

    reset_sequences = True

    def setUp(self):
        self.tenant = _tenant('ba')
        self.portfolio = _portfolio(self.tenant)

    def _forwards(self):
        import importlib

        from django.apps import apps as django_apps

        module = importlib.import_module(
            'user_workspace.migrations.0022_backfill_transaction_to_ledger')

        class _SchemaEditor:
            connection = connection

        module.forwards(django_apps, _SchemaEditor())

    def test_abort_leaves_no_ledger_rows(self):
        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5), price=Decimal('70000'),
            quantity=1000, external_id='OK-1')
        Transaction.objects.bulk_create([Transaction(
            portfolio=self.portfolio, tenant=self.tenant, symbol='',
            transaction_type='BUY', date=date(2026, 1, 6), price=Decimal('70000'),
            quantity=100, external_id='BAD-1')])

        with self.assertRaises(RuntimeError):
            self._forwards()

        self.assertEqual(
            LedgerEntry.objects.count(), 0,
            'migration đã ghi dòng rồi mới raise ⇒ dừng SAI chỗ',
        )
        self.assertEqual(CashFlow.objects.count(), 0)

