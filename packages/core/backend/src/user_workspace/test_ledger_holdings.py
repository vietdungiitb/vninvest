"""
PA-2 / P0-DATA-03 — kiểm thử sổ cái.

Hai tầng:
1. `LedgerGoldenFixtureTest` — chạy `ledger.holdings.compute_ledger` thuần với
   fixture JSON (`test_golden/holdings.json`), không cần DB. Khoá semantics
   D-06 (weighted average, cổ tức là cash flow, phí/thuế vốn vào cost basis).
2. `LedgerDatabaseTest` — kiểm chứng cùng semantics trên `Transaction` thật
   + kiểm tra cache/provenance của `ledger.services`.
"""

import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from user_workspace.ledger import (
    CALCULATION_VERSION,
    LEDGER_CACHE_TTL_SECONDS,
    build_meta,
    compute_ledger,
    get_cached_ledger,
    get_holdings_for_portfolio,
    invalidate_ledger_cache,
    money,
)
from user_workspace.tests.envelope import unwrapped_json
from user_workspace.models import Portfolio, Transaction

User = get_user_model()

GOLDEN_PATH = Path(__file__).resolve().parent / 'test_golden' / 'holdings.json'

BUY = Transaction.TransactionType.BUY
SELL = Transaction.TransactionType.SELL
DIVIDEND = Transaction.TransactionType.DIVIDEND


def load_golden():
    return json.loads(GOLDEN_PATH.read_text(encoding='utf-8'))


def rows_from_fixture(transactions):
    """Biến dict fixture thành object có attribute — không cần model, không cần DB."""
    rows = []
    for raw in transactions:
        row = SimpleNamespace(**raw)
        row.date = date.fromisoformat(raw['date'])
        rows.append(row)
    return rows


class LedgerGoldenFixtureTest(TestCase):
    """Golden fixtures: số liệu sổ cái phải khớp tuyệt đối (tolerance 0.01 VND)."""

    def test_fixture_file_matches_current_algorithm_contract(self):
        golden = load_golden()
        self.assertEqual(golden['calculation_version'], CALCULATION_VERSION)
        self.assertEqual(golden['cost_method'], 'weighted_average')
        self.assertTrue(golden['cases'], 'fixture phải có ít nhất một case')

    def test_all_golden_cases(self):
        for case in load_golden()['cases']:
            with self.subTest(case=case['name']):
                ledger = compute_ledger(
                    rows_from_fixture(case['transactions']),
                    today=date(2026, 9, 26),
                    tenant_public_id='tenant-fixture',
                    portfolio_id=1,
                )
                expect = case['expect']

                self.assertEqual(
                    sorted(ledger['holdings'].keys()),
                    sorted(expect['holdings'].keys()),
                    msg=f"{case['name']}: danh sách mã đang giữ",
                )
                for symbol, want in expect['holdings'].items():
                    got = ledger['holdings'][symbol]
                    self.assertEqual(int(got['quantity']), want['quantity'], case['name'])
                    self.assertEqual(
                        money(got['avg_cost']), Decimal(want['avg_cost']),
                        f"{case['name']}/{symbol}: avg_cost",
                    )
                    self.assertEqual(
                        money(got['total_cost']), Decimal(want['total_cost']),
                        f"{case['name']}/{symbol}: total_cost",
                    )

                self.assertEqual(money(ledger['cash']), Decimal(expect['cash']), case['name'])
                self.assertEqual(
                    money(ledger['realized_pnl']), Decimal(expect['realized_pnl']),
                    f"{case['name']}: realized_pnl",
                )
                self.assertEqual(
                    money(ledger['dividend_income']), Decimal(expect['dividend_income']),
                    f"{case['name']}: dividend_income",
                )
                self.assertEqual(
                    money(ledger['fees_paid']), Decimal(expect['fees_paid']), case['name'],
                )
                self.assertEqual(
                    money(ledger['taxes_paid']), Decimal(expect['taxes_paid']), case['name'],
                )
                self.assertEqual(
                    [w['code'] for w in ledger['warnings']],
                    expect['warning_codes'],
                    f"{case['name']}: warning codes",
                )
                self.assertEqual(
                    ledger['reconciliation_required'],
                    expect['reconciliation_required'],
                    case['name'],
                )

                for symbol, want in expect.get('realized_by_symbol', {}).items():
                    self.assertEqual(
                        money(ledger['realized_by_symbol'][symbol]), Decimal(want),
                        f"{case['name']}/{symbol}: realized_by_symbol",
                    )

                for key in ('as_of', 'as_of_reason', 'source', 'stale', 'stale_reason'):
                    if key in expect:
                        meta_value = ledger['meta'][key]
                        if isinstance(meta_value, date):
                            meta_value = meta_value.isoformat()
                        self.assertEqual(meta_value, expect[key], f"{case['name']}: meta.{key}")

    def test_oversell_warning_is_structured(self):
        case = next(c for c in load_golden()['cases'] if c['name'] == 'oversell')
        ledger = compute_ledger(
            rows_from_fixture(case['transactions']), today=date(2026, 9, 26),
        )
        warning = next(w for w in ledger['warnings'] if w['code'] == 'oversell')
        for key, want in case['expect']['warning_detail'].items():
            self.assertEqual(warning['detail'][key], want, f'oversell detail.{key}')
    def test_missing_data_is_null_with_reason_not_zero(self):
        """AC-10: `unrealized_pnl`/`nav` phải null + lý do, không phải 0."""
        ledger = compute_ledger([], today=date(2026, 9, 26))
        self.assertIsNone(ledger['unrealized_pnl'])
        self.assertTrue(ledger['unrealized_pnl_reason'])
        self.assertIsNone(ledger['nav'])
        self.assertTrue(ledger['nav_reason'])
        self.assertFalse(ledger['cash_complete'])
        self.assertTrue(ledger['cash_note'])


class LedgerSemanticTest(TestCase):
    """Đọc lại từng lỗi đã xác minh trong `_compute_holdings` cũ."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='pa2-ledger-user', email='pa2-ledger@test.local', password='x',
        )
        self.portfolio = Portfolio.objects.create(user=self.user, name='PA2 ledger')

    def _txn(self, kind, symbol, price, quantity, fee='0', tax='0', day=1, external_id=''):
        return Transaction.objects.create(
            portfolio=self.portfolio,
            symbol=symbol,
            transaction_type=kind,
            date=date(2026, 9, day),
            price=Decimal(price),
            quantity=quantity,
            fee=Decimal(fee),
            tax=Decimal(tax),
            external_id=external_id,
        )

    def test_ac5_buy_fee_and_tax_both_capitalised(self):
        """AC-5: fee VÀ tax của BUY đều vốn vào cost basis (lỗi cũ chỉ cộng fee)."""
        self._txn(BUY, 'VCB', '10.00', 100, fee='1.00', tax='0.50')
        ledger = get_cached_ledger(self.portfolio.id, use_cache=False)
        position = ledger['holdings']['VCB']
        self.assertEqual(money(position['total_cost']), Decimal('1001.50'))
        self.assertEqual(position['quantity'], 100)

    def test_ac5_sell_realized_pnl_minus_fee_and_tax(self):
        """AC-5: (giá bán − avg_cost)×50 − fee − tax."""
        self._txn(BUY, 'VCB', '10.00', 100, fee='1.00', tax='0.50')
        self._txn(SELL, 'VCB', '12.00', 50, fee='2.00', tax='1.00', day=5)
        ledger = get_cached_ledger(self.portfolio.id, use_cache=False)
        avg = ledger['holdings']['VCB']['avg_cost']
        expected = (Decimal('12.00') - avg) * 50 - Decimal('2.00') - Decimal('1.00')
        self.assertEqual(money(ledger['realized_pnl']), money(expected))
        self.assertEqual(money(ledger['realized_pnl']), Decimal('96.25'))

    def test_ac5_cash_flow_matches_ledger(self):
        self._txn(BUY, 'VCB', '10.00', 100, fee='1.00', tax='0.50')
        self._txn(SELL, 'VCB', '12.00', 50, fee='2.00', tax='1.00', day=5)
        ledger = get_cached_ledger(self.portfolio.id, use_cache=False)
        # -1001.50 (mua) + 600.00 (bán) - 3.00 (phí + thuế lệnh bán)
        self.assertEqual(money(ledger['cash']), Decimal('-404.50'))

    def test_ac6_dividend_is_cash_flow_only(self):
        """AC-6: cổ tức tăng cash, KHÔNG đụng avg_cost / quantity."""
        self._txn(BUY, 'VCB', '10.00', 100)
        before = get_cached_ledger(self.portfolio.id, use_cache=False)['holdings']['VCB']
        self._txn(DIVIDEND, 'VCB', '1.50', 100, day=10, external_id='brk-div-1')
        after_ledger = get_cached_ledger(self.portfolio.id, use_cache=False)
        after = after_ledger['holdings']['VCB']

        self.assertEqual(after['quantity'], before['quantity'])
        self.assertEqual(after['avg_cost'], before['avg_cost'])
        self.assertEqual(after['total_cost'], before['total_cost'])
        self.assertEqual(money(after_ledger['cash']), Decimal('-850.00'))
        self.assertEqual(money(after_ledger['dividend_income']), Decimal('150.00'))

    def test_ac7_oversell_is_reported_not_clamped_silently(self):
        """AC-7: oversell phải phát hiện được, không clamp im lặng."""
        self._txn(BUY, 'VCB', '10.00', 100)
        self._txn(SELL, 'VCB', '12.00', 150, day=5)
        ledger = get_cached_ledger(self.portfolio.id, use_cache=False)
        codes = [w['code'] for w in ledger['warnings']]
        self.assertIn('oversell', codes)
        self.assertTrue(ledger['reconciliation_required'])
        detail = next(w for w in ledger['warnings'] if w['code'] == 'oversell')['detail']
        self.assertEqual(detail['excess_quantity'], '50')

    def test_ac8_non_positive_quantity_does_not_corrupt_cost_basis(self):
        """AC-8: quantity 0 / âm không được làm hỏng cost basis."""
        self._txn(BUY, 'VCB', '10.00', 100)
        self._txn(BUY, 'VCB', '11.00', 0, day=2)
        self._txn(SELL, 'VCB', '12.00', -5, day=3)
        ledger = get_cached_ledger(self.portfolio.id, use_cache=False)
        position = ledger['holdings']['VCB']
        self.assertEqual(position['quantity'], 100)
        self.assertEqual(money(position['total_cost']), Decimal('1000.00'))
        self.assertEqual(
            [w['code'] for w in ledger['warnings']],
            ['non_positive_quantity', 'non_positive_quantity'],
        )

    def test_realized_pnl_survives_position_close(self):
        """Lỗi cũ `:58-59` xoá cứng cost basis và làm mất realized P&L."""
        self._txn(BUY, 'VCB', '10.00', 100)
        self._txn(SELL, 'VCB', '12.00', 100, day=5)
        ledger = get_cached_ledger(self.portfolio.id, use_cache=False)
        self.assertEqual(ledger['holdings'], {})
        self.assertEqual(money(ledger['realized_pnl']), Decimal('200.00'))
        self.assertEqual(money(ledger['realized_by_symbol']['VCB']), Decimal('200.00'))


class LedgerCacheAndProvenanceTest(TestCase):
    """AC-10 + P1-DATA-03: cache không trả số sai, `meta` đầy đủ."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='pa2-cache-user', email='pa2-cache@test.local', password='x',
        )
        self.portfolio = Portfolio.objects.create(user=self.user, name='PA2 cache')
        # TEN-06: get_cached_ledger fail-closed khi thieu tenant, nen cac
        # test duoi day goi bang self.portfolio.tenant (co san tu signal) chu
        # khong phai None — trung y het voi production, noi moi request
        # luon co tenant tu middleware.
        self.tenant = self.portfolio.tenant
        Transaction.objects.create(
            portfolio=self.portfolio,
            symbol='VCB',
            transaction_type=BUY,
            date=date(2026, 9, 20),
            price=Decimal('50000'),
            quantity=120,
            fee=Decimal('1000'),
            external_id='brk-1',
        )
        Transaction.objects.create(
            portfolio=self.portfolio,
            symbol='VCB',
            transaction_type=Transaction.TransactionType.SELL,
            date=date(2026, 9, 22),
            price=Decimal('52000'),
            quantity=20,
            fee=Decimal('500'),
            external_id='brk-2',
        )

    def test_meta_has_as_of_source_and_calculation_version(self):
        meta = build_meta(get_cached_ledger(self.portfolio.id, use_cache=False))
        self.assertEqual(meta['as_of'], '2026-09-22')
        self.assertIsNone(meta['as_of_reason'])
        self.assertEqual(meta['source'], 'broker_sync')
        self.assertEqual(meta['calculation_version'], CALCULATION_VERSION)
        self.assertEqual(meta['cost_method'], 'weighted_average')
        self.assertEqual(meta['transaction_count'], 2)
        self.assertIsInstance(meta['stale'], bool)

    def test_manual_transactions_report_manual_source(self):
        portfolio = Portfolio.objects.create(user=self.user, name='PA2 manual')
        Transaction.objects.create(
            portfolio=portfolio, symbol='VCB', transaction_type=BUY,
            date=date(2026, 9, 21), price=Decimal('100'), quantity=1,
        )
        meta = build_meta(get_cached_ledger(portfolio.id, use_cache=False))
        self.assertEqual(meta['source'], 'manual')

    def test_cache_hit_then_invalidated_by_new_transaction(self):
        first = get_cached_ledger(self.portfolio.id, self.tenant)
        second = get_cached_ledger(self.portfolio.id, self.tenant)
        self.assertFalse(first['meta']['from_cache'])
        self.assertTrue(second['meta']['from_cache'])
        self.assertEqual(first['cash'], second['cash'])

        Transaction.objects.create(
            portfolio=self.portfolio, symbol='VCB', transaction_type=BUY,
            date=date(2026, 9, 23), price=Decimal('51000'), quantity=10,
        )
        third = get_cached_ledger(self.portfolio.id, self.tenant)
        self.assertNotEqual(third['cash'], second['cash'], msg='giao dịch mới phải thấy ngay')

    def test_editing_old_transaction_invalidates_cache(self):
        """Lý do phải có fingerprint, không chỉ `as_of` (xem CACHE_KEY_NOTE)."""
        first = get_cached_ledger(self.portfolio.id, self.tenant)
        self.assertTrue(get_cached_ledger(self.portfolio.id, self.tenant)['meta']['from_cache'])

        old = Transaction.objects.filter(
            portfolio=self.portfolio, transaction_type=BUY,
        ).first()
        old.quantity = 999
        old.save(update_fields=['quantity', 'updated_at'])

        after = get_cached_ledger(self.portfolio.id, self.tenant)
        self.assertNotEqual(
            after['holdings']['VCB']['quantity'],
            first['holdings']['VCB']['quantity'],
            msg='sửa giao dịch cũ (không đổi as_of) vẫn phải invalidate cache',
        )

    def test_invalidate_ledger_cache_is_only_a_bump_counter(self):
        """`invalidate_ledger_cache` KHÔNG phải cơ chế vô hiệu hoá cache.

        Docstring tại `user_workspace/ledger/services.py:76-87` ghi rõ: bộ đếm
        bump không nằm trong `_cache_key`; cache tự đúng nhờ fingerprint
        `(count, max updated_at, max pk)`. Test cũ assert ngược lại
        (`from_cache` phải False sau invalidate) nên chỉ pass được khi key cache
        tình cờ khác — nó đòi một bảo đảm mà code không hứa.

        Cơ chế thật đã được test kế bên (`sửa giao dịch cũ vẫn invalidate`).
        Ở đây chỉ khoá lại hành vi đã tài liệu hoá: bump là no-op với cache.
        """
        get_cached_ledger(self.portfolio.id, self.tenant)
        self.assertTrue(get_cached_ledger(self.portfolio.id, self.tenant)['meta']['from_cache'])

        invalidate_ledger_cache(self.portfolio.id)

        # Gọi lại vẫn trúng cache — đúng như docstring, vì bump không nằm trong key.
        self.assertTrue(get_cached_ledger(self.portfolio.id, self.tenant)['meta']['from_cache'])

    def test_fingerprint_key_changes_when_history_changes(self):
        """Cơ chế vô hiệu hoá thật: đổi lịch sử => fingerprint đổi => key khác."""
        first = get_cached_ledger(self.portfolio.id, self.tenant)
        self.assertTrue(get_cached_ledger(self.portfolio.id, self.tenant)['meta']['from_cache'])

        Transaction.objects.filter(
            portfolio=self.portfolio, transaction_type=BUY,
        ).first().delete()

        after = get_cached_ledger(self.portfolio.id, self.tenant)
        self.assertFalse(
            after['meta']['from_cache'],
            msg='xóa giao dịch phải làm đổi fingerprint nên phải tính lại',
        )

    def test_cache_ttl_is_bounded(self):
        self.assertGreater(LEDGER_CACHE_TTL_SECONDS, 0)
        self.assertLessEqual(LEDGER_CACHE_TTL_SECONDS, 300)

    def test_get_holdings_for_portfolio_keeps_legacy_shape(self):
        """8 view analytics đọc đúng 3 key này — không được thêm/bớt key."""
        holdings = get_holdings_for_portfolio(self.portfolio.id, use_cache=False)
        self.assertEqual(sorted(holdings.keys()), ['VCB'])
        self.assertEqual(sorted(holdings['VCB'].keys()), ['avg_cost', 'quantity', 'total_cost'])
        # BUY 120 - SELL 20
        self.assertEqual(holdings['VCB']['quantity'], 100)


class LedgerSummaryResponseTest(TestCase):
    """AC-10 ở tầng HTTP: `summary` phải mang provenance + số 0 giả bị loại."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='pa2-summary-user', email='pa2-summary@test.local', password='x',
        )
        self.portfolio = Portfolio.objects.create(user=self.user, name='PA2 summary')
        Transaction.objects.create(
            portfolio=self.portfolio, symbol='VCB', transaction_type=BUY,
            date=date(2026, 9, 20), price=Decimal('50000'), quantity=100,
            fee=Decimal('1000'), tax=Decimal('500'), external_id='brk-1',
        )
        Transaction.objects.create(
            portfolio=self.portfolio, symbol='VCB', transaction_type=SELL,
            date=date(2026, 9, 21), price=Decimal('55000'), quantity=40,
            fee=Decimal('500'), tax=Decimal('250'), external_id='brk-2',
        )
        self.client = APIClient()
        self.client.force_login(self.user)

    def test_summary_carries_meta_and_ledger_fields(self):
        response = self.client.get(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/summary/',
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        payload = unwrapped_json(response)

        # key cũ còn nguyên
        for legacy_key in (
            'portfolio_id', 'portfolio_name', 'total_market_value', 'total_cost',
            'total_unrealized_pnl', 'total_unrealized_pnl_pct', 'num_holdings', 'as_of',
        ):
            self.assertIn(legacy_key, payload, legacy_key)

        # B5: `meta` provenance da bi chuyen len top-level cua envelope
        # (trung noi dung cu, khong phai gia tri moi).
        meta = body['meta']
        self.assertEqual(meta['as_of'], '2026-09-21')
        self.assertEqual(meta['source'], 'broker_sync')
        self.assertEqual(meta['calculation_version'], CALCULATION_VERSION)
        self.assertEqual(meta['cost_method'], 'weighted_average')
        self.assertEqual(meta['tenant_id'], str(self.portfolio.tenant.public_id))
        self.assertEqual(meta['transaction_count'], 2)

        # BUY 100 @50000 + fee 1000 + tax 500 => cost basis 5001500, avg 50015.
        # SELL 40 @55000: (55000 - 50015)*40 - 500 - 250 = 198650.
        self.assertEqual(payload['realized_pnl'], '198650.00')
        # cash = -5001500 + 2200000 - 750
        self.assertEqual(payload['cash'], '-2802250.00')
        self.assertFalse(payload['cash_complete'])
        self.assertTrue(payload['cash_note'])

        # 0 giả bị loại: `nav` null + lý do, không phải "0.00"
        self.assertIsNone(payload['nav'])
        self.assertTrue(payload['nav_reason'])

    def test_summary_surfaces_ledger_warnings(self):
        Transaction.objects.create(
            portfolio=self.portfolio, symbol='VCB', transaction_type=SELL,
            date=date(2026, 9, 22), price=Decimal('55000'), quantity=999,
            external_id='brk-3',
        )
        response = self.client.get(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/summary/',
        )
        payload = unwrapped_json(response)
        self.assertTrue(payload['reconciliation_required'])
        self.assertIn('oversell', [w['code'] for w in payload['ledger_warnings']])

    def test_analytics_endpoint_inherits_summary_meta(self):
        response = self.client.get(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/analytics/',
        )
        self.assertEqual(response.status_code, 200)
        # B5: `summary` được mở envelope (không lồng envelope), còn provenance
        # của summary nằm ở `meta` top-level của chính endpoint này — đúng ý
        # "kế thừa meta của summary", chỉ đổi chỗ để có **một** `meta` duy nhất.
        self.assertIn('summary', unwrapped_json(response))
        self.assertEqual(
            response.json()['meta']['calculation_version'], CALCULATION_VERSION)


# ══════════════════════════════════════════════════════════════════
# LED-05 cutover — `summary` gọi `portfolio_valuation` thật
# ══════════════════════════════════════════════════════════════════
#
# Trước cutover, `PortfolioSummaryView` **hardcode** `'nav': None` với comment
# "cần số dư mở đầu từ broker (model `Portfolio` không có trường đó ⇒ cần
# migration, ngoài PA-2)". Wave 2 đã thêm đúng trường đó (`opening_balance`,
# migration `0021`) và viết `portfolio_valuation()` — nhưng không ai gọi nó.
# Nghĩa là toàn bộ NAV engine đã merge chưa từng chạy ngoài test.
#
# Nhóm test dưới khóa hành vi ở tầng HTTP, vì đó là nơi dead code trở thành
# lỗi người dùng nhìn thấy.


class PortfolioSummaryNavWiringTest(TestCase):
    """`summary` phải lấy NAV từ engine, không còn trả `null` vĩnh viễn."""

    def setUp(self):
        cache.clear()
        from identity_access.models import CoreTenant
        from user_workspace.models import CashFlow, LedgerEntry

        self.user = User.objects.create_user(
            username='navwire-user', email='navwire@test.local', password='x',
        )
        self.tenant = CoreTenant.objects.create(
            tenant_code='r-navwire', display_name='navwire',
            owner_user=self.user, status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='NAV wire',
            opening_balance=Decimal('10000000'),
        )
        # Fixture **sau backfill**: `Transaction` (app vẫn ghi) + `LedgerEntry`
        # (migration LED-05) + `CashFlow` (migration 0022). Thiếu `CashFlow` thì
        # `portfolio_valuation` chặn NAV đúng theo thiết kế — đó là một test
        # riêng ở `test_review_findings_wave2.py`, không phải trạng thái mà
        # endpoint này phải phục vụ.
        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VCB',
            transaction_type=BUY, date=date(2026, 9, 20),
            price=Decimal('50000'), quantity=100,
            fee=Decimal('1000'), tax=Decimal('500'), external_id='navwire-1',
        )
        buy = LedgerEntry.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, entry_type='BUY',
            symbol='VCB', trade_date=date(2026, 9, 20), quantity=100,
            price=Decimal('50000'), fee=Decimal('1000'), tax=Decimal('500'),
            market='VN_SPOT', source='manual', external_id='navwire-1',
        )
        CashFlow.objects.create(
            entry=buy, tenant=self.tenant, flow_type='BUY',
            # 100 × 50.000 + phí 1.000 + thuế 500 = 5.001.500. Phải **khớp**
            # `compute_ledger` nếu không `cash_cross_check` sẽ bật cảnh báo
            # đối soát giả cho một danh mục hoàn toàn bình thường.
            amount=Decimal('-5001500'),
        )
        self.client = APIClient()
        self.client.force_login(self.user)

    def _summary(self):
        response = self.client.get(
            f'/core/v1/workspace/portfolios/{self.portfolio.id}/summary/',
        )
        self.assertEqual(response.status_code, 200)
        return unwrapped_json(response)

    def _set_prices(self, **by_symbol):
        from datetime import date as _date
        from market_serving.models import SymbolSnapshot

        for symbol, price in by_symbol.items():
            SymbolSnapshot.objects.create(
                symbol=symbol, session_date=_date.today(), price=Decimal(price),
            )

    def _clear_opening_balance(self):
        Portfolio.objects.filter(pk=self.portfolio.pk).update(opening_balance=None)

    def test_nav_is_still_null_with_a_machine_readable_reason(self):
        """Không có `opening_balance` ⇒ `nav = null` **kèm mã lý do**.

        Không phải `0` — `0` ở đây là lời nói dối người dùng (LED-03 R5).
        """
        self._clear_opening_balance()
        self._set_prices(VCB='55000')
        payload = self._summary()
        self.assertIsNone(payload['nav'])
        self.assertEqual(payload['nav_reason'], 'no_opening_balance')
        self.assertTrue(payload['nav_reason_text'])

    def test_nav_is_computed_once_opening_balance_is_known(self):
        """Đây là test chứng minh cutover **có tác dụng**."""
        self._set_prices(VCB='55000')
        payload = self._summary()
        # 100 cp × 55.000            =  5.500.000
        # cash = 10.000.000 − 5.001.500 =  4.998.500
        # nav  = 5.500.000 + 4.998.500 = 10.498.500
        self.assertEqual(payload['nav'], '10498500.00')
        self.assertEqual(payload['nav_reason'], '')
        self.assertEqual(payload['opening_balance'], '10000000.00')
        self.assertEqual(payload['stock_value'], '5500000.00')
        self.assertEqual(payload['debt'], '0.00')
        self.assertEqual(payload['currency'], 'VND')

    def test_partial_prices_block_nav_instead_of_undercounting(self):
        """2 mã, chỉ 1 mã có giá ⇒ NAV = null, **không** tính trên 1 mã.

        Nếu cộng `avg_cost × quantity` cho mã thiếu giá thì số tổng vẫn khớp
        `total_cost` và `unrealized_pnl = 0` — tức báo "không lãi không lỗ" cho
        cả danh mục. Đó là loại 0 giả mà cả wave này sinh ra để diệt.
        """
        from user_workspace.models import CashFlow, LedgerEntry

        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='ACB',
            transaction_type=BUY, date=date(2026, 9, 20),
            price=Decimal('30000'), quantity=10, external_id='navwire-2',
        )
        acb = LedgerEntry.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, entry_type='BUY',
            symbol='ACB', trade_date=date(2026, 9, 20), quantity=10,
            price=Decimal('30000'), market='VN_SPOT', source='manual',
            external_id='navwire-2',
        )
        CashFlow.objects.create(
            entry=acb, tenant=self.tenant, flow_type='BUY', amount=Decimal('-300000'),
        )
        self._set_prices(VCB='55000')  # ACB cố tình không có giá

        payload = self._summary()
        self.assertIsNone(payload['nav'])
        self.assertEqual(payload['nav_reason'], 'partial_market_prices')
        self.assertIn('ACB', payload['nav_unpriced_symbols'])
        # `total_market_value` cũng phải null — cùng lý do, cùng dữ liệu.
        self.assertIsNone(payload['total_market_value'])

    def test_cash_cross_check_appears_when_the_two_cash_sources_disagree(self):
        """Bán vượt số lượng đang giữ ⇒ hai nguồn tiền lệch ⇒ phải **cảnh báo**.

        `CashFlow` ghi tiền bán **đủ 150 cp** (broker thật sự chuyển), còn
        `compute_ledger` chỉ ghi phần có cost basis ⇒ lệch 2 750 000.
        """
        from user_workspace.models import CashFlow, LedgerEntry

        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VCB',
            transaction_type=SELL, date=date(2026, 9, 21),
            price=Decimal('55000'), quantity=150, external_id='navwire-3',
        )
        sell = LedgerEntry.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, entry_type='SELL',
            symbol='VCB', trade_date=date(2026, 9, 21), quantity=150,
            price=Decimal('55000'), market='VN_SPOT', source='manual',
            external_id='navwire-3',
        )
        CashFlow.objects.create(
            entry=sell, tenant=self.tenant, flow_type='SELL',
            amount=Decimal('8250000'),
        )
        self._set_prices(VCB='55000')

        payload = self._summary()
        cross = payload['cash_cross_check']
        self.assertTrue(cross['reconciliation_required'])
        self.assertNotEqual(cross['difference'], '0')
        self.assertTrue(payload['reconciliation_required'])

    def test_no_cash_cross_check_key_when_sources_agree(self):
        """Không lệch thì **không** phải key rỗng — client không phải dò."""
        self._set_prices(VCB='55000')
        payload = self._summary()
        self.assertNotIn('cash_cross_check', payload)
        self.assertFalse(payload['reconciliation_required'])

    def test_unbackfilled_cash_flow_blocks_nav_at_http_layer(self):
        """Guard `cash_flows_not_backfilled` phải chạy cả ở tầng HTTP.

        Đây là lỗi tiền thật tìm ra khi nối engine: chỉ hỏi `LedgerEntry` thì
        danh mục có `Transaction` mà chưa backfill lọt qua, `nav` ra lệch đúng
        bằng tổng chi phí. Xem hồi quy ở `test_review_findings_wave2.py`.
        """
        from user_workspace.models import CashFlow

        CashFlow.objects.all().delete()
        self._set_prices(VCB='55000')

        payload = self._summary()
        self.assertIsNone(payload['nav'])
        self.assertEqual(payload['nav_reason'], 'cash_flows_not_backfilled')
        self.assertNotIn('cash_cross_check', payload)

    def test_nav_reason_code_matches_the_engine_blockers(self):
        """`nav_reason` phải là **mã máy** đọc được, không phải câu văn.

        Cùng nguyên tắc với `price_missing_reason: 'no_quote_for_today'` ngay
        trong view này — FE cần nhánh theo mã, không theo chuỗi tiếng Việt.
        """
        from market_serving.models import SymbolSnapshot

        SymbolSnapshot.objects.all().delete()  # bỏ giá ⇒ chặn vì thiếu giá
        payload = self._summary()
        self.assertEqual(payload['nav_reason'], 'no_market_prices')
        self.assertIsNone(payload['nav'])
