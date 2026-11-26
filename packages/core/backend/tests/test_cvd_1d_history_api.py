"""
CVD 1D history contract cho vninvestcharts-widget (BE_REQUEST_CVD_1D_HISTORY_2026-11-26).

T-01..T-11: backward compatible, history, cumulative invariant, parity, zero-day fill,
bad period, trade_date precedence, cache v3, auth, 10Y cap, period ignored outside 1D.

Fail-before: chay tren code cu (chua co param period) => cac test history phai DO.
"""
import datetime as dt
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from market_data.models import DailyPrice
from market_serving.models import SessionFacts, SessionFactsBucket

URL = '/core/v1/session-facts/HPG/cvd/'
SYMBOL = 'HPG'


def _utc_midnight(day):
    """Bucket 1D materialized duoc floor tren UTC midnight, endpoint chieu sang 07:00+07:00."""
    return dt.datetime.combine(day, dt.time.min, tzinfo=dt.timezone.utc)


def _add_1d_session(symbol, day, buy, sell):
    facts = SessionFacts.objects.create(
        symbol=symbol,
        session_date=day,
        cvd_normalized=50.0,
        whale_net_flow=buy - sell,
        total_buy_volume=buy,
        total_sell_volume=sell,
        source='computed',
        stale=False,
    )
    SessionFactsBucket.objects.create(
        session_facts=facts,
        symbol=symbol,
        session_date=day,
        window='1D',
        bucket_minutes=1440,
        bucket_ts=_utc_midnight(day),
        # Nguon materialize reset cumulative ve 0 moi session (session_facts_engine.py:155-158).
        cumulative_cvd=float(buy - sell),
        buy_strength=60.0,
        institutional_strength=50.0,
        buy_volume=buy,
        sell_volume=sell,
    )
    return facts


class Cvd1dHistoryApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(username='cvd1d-history-user', password='pass')
        self.client.force_authenticate(user=self.user)
        self.today = timezone.localdate()
        self.d0 = self.today - dt.timedelta(days=2)
        self.d1 = self.today - dt.timedelta(days=1)
        self.d2 = self.today

        # Session truoc co net != 0 de bug "reset cumulative" bi AC-3 phat hien.
        self.f0 = _add_1d_session(SYMBOL, self.d0, 100_000_000, 400_000_000)  # -300M
        self.f1 = _add_1d_session(SYMBOL, self.d1, 600_000_000, 500_000_000)  # +100M
        self.f2 = _add_1d_session(SYMBOL, self.d2, 900_000_000, 100_000_000)  # +800M
        self.expected_deltas = [-300_000_000, 100_000_000, 800_000_000]
        self.expected_cumulative = [-300_000_000, -200_000_000, 600_000_000]

    def _get(self, query):
        return self.client.get(URL + '?' + query)

    # ── T-01 backward compatible ───────────────────────────────
    def test_t01_no_period_is_byte_for_byte_legacy_shape(self):
        resp = self._get('window=1D')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        payload = resp.data
        self.assertEqual(payload['bucket_count'], 1)
        self.assertEqual(payload['session_date'], self.d2.isoformat())
        self.assertEqual(payload['cvd_series'][0]['cumulative_cvd'], 800_000_000.0)
        for field in ('period', 'history', 'date_from', 'date_to'):
            self.assertNotIn(field, payload)

    # ── T-02 history shape ──────────────────────────────────────
    def test_t02_period_3m_returns_monotonic_history(self):
        resp = self._get('window=1D&period=3M')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        payload = resp.data
        self.assertTrue(payload['history'])
        self.assertEqual(payload['period'], '3M')
        self.assertEqual(payload['date_from'], (self.today - dt.timedelta(days=90)).isoformat())
        self.assertEqual(payload['date_to'], self.today.isoformat())
        self.assertGreaterEqual(payload['bucket_count'], 2)
        stamps = [dt.datetime.fromisoformat(b['bucket_ts']) for b in payload['cvd_series']]
        self.assertEqual(stamps, sorted(stamps))
        self.assertEqual(len(set(stamps)), len(stamps))
        self.assertTrue(all(b['bucket_ts'].endswith('+07:00') for b in payload['cvd_series']))
        self.assertTrue(all('buy_volume' in b and 'sell_volume' in b for b in payload['cvd_series']))

    # ── T-03 cumulative invariant (discriminator that catches reset) ──
    def test_t03_cumulative_is_running_sum_not_per_session_reset(self):
        payload = self._get('window=1D&period=3M').data
        deltas = [b['buy_volume'] - b['sell_volume'] for b in payload['cvd_series']]
        self.assertEqual(deltas, self.expected_deltas)
        cumulative = [b['cumulative_cvd'] for b in payload['cvd_series']]
        self.assertEqual(cumulative, [float(v) for v in self.expected_cumulative])
        running = 0
        for bucket, delta in zip(payload['cvd_series'], deltas):
            running += delta
            self.assertLessEqual(abs(bucket['cumulative_cvd'] - running), 1e-6)

    # ── T-04 parity of non-reset fields ─────────────────────────
    def test_t04_last_history_bucket_matches_legacy_session(self):
        legacy = self._get('window=1D').data['cvd_series'][0]
        history = self._get('window=1D&period=3M').data['cvd_series'][-1]
        for field in ('bucket_ts', 'buy_volume', 'sell_volume', 'delta'):
            self.assertEqual(history[field], legacy[field])

    # ── T-05 bad period ─────────────────────────────────────────
    def test_t05_unsupported_period_returns_400(self):
        resp = self._get('window=1D&period=999M')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['code'], 'UNSUPPORTED_PERIOD')

    # ── T-06 trade_date wins ────────────────────────────────────
    def test_t06_trade_date_overrides_period_even_invalid_period(self):
        resp = self._get('window=1D&period=999M&trade_date=' + self.d0.isoformat())
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['session_date'], self.d0.isoformat())
        self.assertEqual(resp.data['bucket_count'], 1)
        self.assertNotIn('history', resp.data)

    # ── T-07 cache v3 invalidation ──────────────────────────────
    def test_t07_revision_bump_invalidates_v3_cache(self):
        first = self._get('window=1D&period=3M')
        self.assertEqual(first.data['_source'], 'db-read')
        cached = self._get('window=1D&period=3M')
        self.assertEqual(cached.data['_source'], 'cache-hit')
        self.assertEqual(cached.data['revision'], first.data['revision'])

        new_at = timezone.now() + dt.timedelta(days=1)
        SessionFacts.objects.filter(pk=self.f2.pk).update(computed_at=new_at)
        SessionFactsBucket.objects.filter(session_facts=self.f2).update(sell_volume=200_000_000)
        fresh = self._get('window=1D&period=3M')
        self.assertEqual(fresh.data['_source'], 'db-read')
        self.assertEqual(fresh.data['revision'], int(new_at.timestamp()))
        self.assertEqual(fresh.data['cvd_series'][-1]['sell_volume'], 200_000_000)

    # ── T-08 auth ───────────────────────────────────────────────
    def test_t08_auth_is_enforced_before_period_parsing(self):
        anon = APIClient()
        resp = anon.get(URL + '?window=1D&period=3M')
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

        with patch('identity_access.permissions.require_pat_scopes_or_human_session',
                   side_effect=PermissionDenied('missing market:read')) as gate:
            resp = self._get('window=1D&period=3M')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        gate.assert_called_once()

    # ── T-09 zero-day fill từ DailyPrice ────────────────────────
    def test_t09_missing_whale_day_is_zero_filled_from_daily_price(self):
        fill_day = self.today - dt.timedelta(days=3)
        DailyPrice.objects.create(
            symbol=SYMBOL, date=fill_day,
            open=Decimal('10000'), high=Decimal('10100'), low=Decimal('9900'),
            close=Decimal('10000'), volume=1000, value=10_000_000,
        )
        payload = self._get('window=1D&period=3M').data
        first = payload['cvd_series'][0]
        expected_ts = dt.datetime.combine(
            fill_day, dt.time(hour=7), tzinfo=dt.timezone(dt.timedelta(hours=7))
        ).isoformat()
        self.assertEqual(first['bucket_ts'], expected_ts)
        self.assertEqual(first['delta'], 0)
        self.assertEqual(first['cumulative_cvd'], 0.0)
        self.assertEqual(payload['cvd_series'][1]['cumulative_cvd'], -300_000_000.0)

    # ── T-10 bounded 10Y response ───────────────────────────────
    def test_t10_10y_is_bounded_and_still_monotonic(self):
        symbol = 'CVD10Y'
        facts_rows = []
        bucket_rows = []
        for offset in range(2610):
            day = self.today - dt.timedelta(days=offset)
            facts = SessionFacts(symbol=symbol, session_date=day, cvd_normalized=50.0,
                                 whale_net_flow=1, total_buy_volume=1, total_sell_volume=0,
                                 source='computed', stale=False)
            facts_rows.append(facts)
        SessionFacts.objects.bulk_create(facts_rows)
        for facts in facts_rows:
            bucket_rows.append(SessionFactsBucket(
                session_facts=facts, symbol=symbol, session_date=facts.session_date,
                window='1D', bucket_minutes=1440, bucket_ts=_utc_midnight(facts.session_date),
                cumulative_cvd=1.0, buy_strength=50.0, institutional_strength=50.0,
                buy_volume=1, sell_volume=0,
            ))
        SessionFactsBucket.objects.bulk_create(bucket_rows)

        resp = self.client.get('/core/v1/session-facts/CVD10Y/cvd/?window=1D&period=10Y')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        payload = resp.data
        self.assertEqual(payload['bucket_count'], 2600)
        self.assertLessEqual(payload['bucket_count'], 2600)
        # date_from/date_to là khoảng truy vấn (R2), không phải ngày đầu bucket còn giữ sau cap.
        self.assertEqual(payload['date_from'], (self.today - dt.timedelta(days=3650)).isoformat())
        self.assertEqual(payload['date_to'], self.today.isoformat())
        running = 0
        for bucket in payload['cvd_series']:
            running += bucket['buy_volume'] - bucket['sell_volume']
            self.assertLessEqual(abs(bucket['cumulative_cvd'] - running), 1e-6)

    # ── T-11 period chỉ có nghĩa với 1D ─────────────────────────
    def test_t11_period_is_ignored_outside_1d_window(self):
        SessionFactsBucket.objects.create(
            session_facts=self.f2, symbol=SYMBOL, session_date=self.d2,
            window='15m', bucket_minutes=15,
            bucket_ts=timezone.make_aware(dt.datetime.combine(self.d2, dt.time(hour=9))),
            cumulative_cvd=800_000_000.0, buy_strength=60.0, institutional_strength=50.0,
            buy_volume=900_000_000, sell_volume=100_000_000,
        )
        resp = self._get('window=15m&period=999M')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['bucket_count'], 1)
        self.assertNotIn('history', resp.data)
