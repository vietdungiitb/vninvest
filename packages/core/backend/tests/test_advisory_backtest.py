import os
import sys
from datetime import timedelta
from decimal import Decimal

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AdvisoryRecord
from advisory.tests.envelope import unwrapped
from market_data.models import DailyPrice


def _make_user(username):
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password='testpass123')


def _make_prices(symbol, start, days, base=100.0, step=1.0):
    rows = []
    for i in range(days):
        price = base + i * step
        rows.append(DailyPrice(
            symbol=symbol, date=start + timedelta(days=i),
            open=Decimal(str(price)), high=Decimal(str(price + 1)),
            low=Decimal(str(price - 1)), close=Decimal(str(price)),
            volume=1000,
        ))
    DailyPrice.objects.bulk_create(rows)


def _make_record(user, symbol, session_date, signal='BUY'):
    return AdvisoryRecord.objects.create(
        user=user, symbol=symbol, session_date=session_date,
        status=AdvisoryRecord.StatusChoices.GENERATED,
        structured_output={'signal': signal},
        generated_at=timezone.now(),
    )


class AdvisoryBacktestApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('backtest-owner')
        self.client.force_authenticate(user=self.user)
        self.today = timezone.localdate()

    def test_backtest_with_enough_samples_returns_hit_rate_and_avgs(self):
        _make_prices('FPT', self.today - timedelta(days=30), 31)
        for i in range(5):
            _make_record(self.user, 'FPT', self.today - timedelta(days=20 - i), signal='BUY')

        response = self.client.get('/core/v1/advisory/backtest/FPT/?window=30')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped(response)
        self.assertEqual(data['symbol'], 'FPT')
        self.assertEqual(data['window_days'], 30)
        self.assertEqual(data['n_samples'], 5)
        self.assertTrue(data['enough_data'])
        self.assertEqual(data['hit_rate'], 1.0)  # rising series + BUY
        self.assertGreater(data['avg_return_t1'], 0)
        self.assertGreater(data['avg_return_t3'], 0)
        self.assertGreater(data['avg_return_t5'], 0)
        self.assertEqual(len(data['samples']), 5)

    def test_backtest_insufficient_samples_returns_honest_empty(self):
        _make_prices('FPT', self.today - timedelta(days=30), 31)
        for i in range(2):
            _make_record(self.user, 'FPT', self.today - timedelta(days=20 - i), signal='BUY')

        response = self.client.get('/core/v1/advisory/backtest/FPT/?window=30')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped(response)
        self.assertEqual(data['n_samples'], 2)
        self.assertFalse(data['enough_data'])
        self.assertIsNone(data['hit_rate'])
        self.assertIsNone(data['avg_return_t1'])

    def test_backtest_window_filters_old_records_and_rejects_bad_window(self):
        _make_prices('FPT', self.today - timedelta(days=70), 71)
        _make_record(self.user, 'FPT', self.today - timedelta(days=60), signal='BUY')

        res30 = self.client.get('/core/v1/advisory/backtest/FPT/?window=30')
        res90 = self.client.get('/core/v1/advisory/backtest/FPT/?window=90')
        res_bad = self.client.get('/core/v1/advisory/backtest/FPT/?window=7')

        self.assertEqual(unwrapped(res30)['n_samples'], 0)
        self.assertEqual(unwrapped(res90)['n_samples'], 1)
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_backtest_excludes_other_users_records(self):
        other = _make_user('backtest-stranger')
        _make_prices('FPT', self.today - timedelta(days=30), 31)
        for i in range(5):
            _make_record(other, 'FPT', self.today - timedelta(days=20 - i), signal='BUY')

        response = self.client.get('/core/v1/advisory/backtest/FPT/?window=30')

        self.assertEqual(unwrapped(response)['n_samples'], 0)
        self.assertFalse(unwrapped(response)['enough_data'])

    def test_ambiguous_or_negated_signals_are_unscorable(self):
        from advisory.views import _extract_backtest_side

        cases = {
            'BUY': 'BUY',
            'MUA': 'BUY',
            'SELL': 'SELL',
            'BAN': 'SELL',
            'HOLD': None,
            'nên tránh mua': None,
            'chưa nên SELL': None,
            'should NOT buy': None,
            'BUY/SELL cân bằng': None,
            'Tín hiệu mua nhẹ với thanh khoản thấp, dữ liệu phiên chưa hoàn tất': None,
        }
        for raw, expected in cases.items():
            with self.subTest(signal=raw):
                record = _make_record(self.user, 'FPT', self.today, signal=raw)
                self.assertEqual(_extract_backtest_side(record), expected)
                record.delete()

    def test_duplicate_signals_same_session_are_deduped(self):
        _make_prices('FPT', self.today - timedelta(days=30), 31)
        session_date = self.today - timedelta(days=20)
        for _ in range(3):
            _make_record(self.user, 'FPT', session_date, signal='BUY')
        for i in range(4):
            _make_record(self.user, 'FPT', self.today - timedelta(days=15 - i), signal='BUY')

        response = self.client.get('/core/v1/advisory/backtest/FPT/?window=30')

        self.assertEqual(unwrapped(response)['records_considered'], 7)
        self.assertEqual(unwrapped(response)['duplicate_signals_skipped'], 2)
        self.assertEqual(unwrapped(response)['n_samples'], 5)

    def test_reliable_flag_requires_30_samples(self):
        _make_prices('FPT', self.today - timedelta(days=30), 31)
        for i in range(5):
            _make_record(self.user, 'FPT', self.today - timedelta(days=20 - i), signal='BUY')

        response = self.client.get('/core/v1/advisory/backtest/FPT/?window=30')

        self.assertTrue(unwrapped(response)['enough_data'])
        self.assertFalse(unwrapped(response)['reliable'])
