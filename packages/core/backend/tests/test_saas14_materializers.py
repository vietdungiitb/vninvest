"""
Tests for market_serving materializers (SAAS-14).

Covers:
- materialize_symbol_snapshot: no legacy DB URL → skipped
- materialize_symbol_snapshot: degraded mode (OperationalError → marks stale + schedules retry)
- materialize_session_facts: native empty-result + series materialization
- Pagination classes instantiation
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.db import IntegrityError

import django
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vninvest_core.settings")
os.environ.setdefault("LEGACY_DATABASE_URL", "")

django.setup()

from django.test import TestCase

from market_serving.materializers import (
    materialize_pre_open_snapshots,
    materialize_session_facts,
    materialize_symbol_snapshot,
)
from vninvest_core.pagination import AlertCursorPagination, AuditCursorPagination, CoreCursorPagination


class TestMaterializeSymbolSnapshotNoLegacyUrl(TestCase):
    """When LEGACY_DATABASE_URL is absent, materializer returns skipped."""

    def test_no_legacy_url_returns_skipped(self):
        result = materialize_symbol_snapshot.run()
        self.assertEqual(result["status"], "skipped")
        self.assertEqual(result["reason"], "no_legacy_db_url")


class TestMaterializeSessionFactsNative(TestCase):
    def test_no_whale_data_returns_native_empty_result(self):
        result = materialize_session_facts.run()
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['upserted'], 0)
        self.assertEqual(result['symbols_total'], 0)
        self.assertIsNone(result['requested_symbol'])

    def test_materializer_persists_bucket_strengths_for_requested_symbol(self):
        from market_serving.models import SessionFacts, SessionFactsBucket
        from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical
        from django.utils.timezone import now

        SessionFacts.objects.all().delete()
        SessionFactsBucket.objects.all().delete()
        WhaleAlertCanonical.objects.all().delete()
        UnifiedAlert.objects.all().delete()

        session_date = now().date()

        buy_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='VCI whale buy',
            body='native materializer test',
            value=250_000_000,
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=session_date,
            triggered_at=datetime(2026, 5, 13, 9, 5, tzinfo=timezone.utc),
            source_ref='sf-native-buy',
        )
        sell_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            title='VCI whale sell',
            body='native materializer test',
            value=100_000_000,
            direction=UnifiedAlert.DirectionChoices.SELL,
            session_date=session_date,
            triggered_at=datetime(2026, 5, 13, 9, 22, tzinfo=timezone.utc),
            source_ref='sf-native-sell',
        )
        WhaleAlertCanonical.objects.create(
            alert=buy_alert,
            symbol='VCI',
            session_date=session_date,
            side=WhaleAlertCanonical.SideChoices.BUY,
            price=Decimal('25000.00'),
            volume=10_000,
            matched_value=250_000_000,
            executed_at=datetime(2026, 5, 13, 9, 5, tzinfo=timezone.utc),
        )
        WhaleAlertCanonical.objects.create(
            alert=sell_alert,
            symbol='VCI',
            session_date=session_date,
            side=WhaleAlertCanonical.SideChoices.SELL,
            price=Decimal('25000.00'),
            volume=4_000,
            matched_value=100_000_000,
            executed_at=datetime(2026, 5, 13, 9, 22, tzinfo=timezone.utc),
        )

        result = materialize_session_facts.run(symbol='VCI')

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['upserted'], 1)
        self.assertEqual(result['requested_symbol'], 'VCI')

        facts = SessionFacts.objects.get(symbol='VCI', session_date=session_date)
        fifteen_minute_buckets = list(
            SessionFactsBucket.objects.filter(session_facts=facts, window='15m').order_by('bucket_ts')
        )
        five_minute_buckets = list(
            SessionFactsBucket.objects.filter(session_facts=facts, window='5m').order_by('bucket_ts')
        )

        self.assertTrue(fifteen_minute_buckets)
        self.assertTrue(five_minute_buckets)
        self.assertEqual(fifteen_minute_buckets[0].bucket_minutes, 15)
        self.assertGreaterEqual(fifteen_minute_buckets[0].buy_strength, 0.0)
        self.assertGreaterEqual(fifteen_minute_buckets[0].institutional_strength, 0.0)
        self.assertGreaterEqual(len(fifteen_minute_buckets), 1)
        self.assertGreaterEqual(len(five_minute_buckets), 1)


class TestMaterializePreOpenSnapshots(TestCase):
    def setUp(self):
        from market_data.models import DailyPrice, StockProfile

        StockProfile.objects.create(
            symbol='VCB',
            company_name='Vietcombank',
            exchange='HOSE',
            industry='Banking',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        DailyPrice.objects.create(
            symbol='VCB',
            date=date(2026, 5, 11),
            open=Decimal('88000.00'),
            high=Decimal('90000.00'),
            low=Decimal('87500.00'),
            close=Decimal('89000.00'),
            volume=1_250_000,
            value=111250000000,
            change_pct=Decimal('1.1364'),
            source='vnbroker',
            is_adjusted=False,
        )
        DailyPrice.objects.create(
            symbol='VCB',
            date=date(2026, 5, 8),
            open=Decimal('87000.00'),
            high=Decimal('88500.00'),
            low=Decimal('86500.00'),
            close=Decimal('88000.00'),
            volume=1_100_000,
            value=96800000000,
            change_pct=Decimal('0.0000'),
            source='vnbroker',
            is_adjusted=False,
        )

    def test_pre_open_snapshot_materializer_populates_core_snapshot(self):
        from datetime import date
        from market_serving.models import SymbolSnapshot

        result = materialize_pre_open_snapshots.run(as_of_date=date(2026, 5, 12))

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['upserted'], 1)
        self.assertEqual(result['symbols_total'], 1)
        self.assertEqual(result['completeness_pct'], 100.0)
        self.assertTrue(result['meets_target'])
        self.assertEqual(result['market_status'], 'pre-open')

        snapshot = SymbolSnapshot.objects.get(symbol='VCB', session_date=date(2026, 5, 12))
        self.assertEqual(snapshot.market_status, SymbolSnapshot.MarketStatusChoices.PRE_OPEN)
        self.assertEqual(snapshot.source, SymbolSnapshot.SourceChoices.CORE)
        self.assertEqual(float(snapshot.price), 89000.0)
        self.assertEqual(float(snapshot.price_change), 1000.0)
        self.assertAlmostEqual(float(snapshot.price_change_pct), 1.1364, places=4)


class TestMaterializeUnifiedAlertsDedup(TestCase):
    def test_duplicate_event_rows_are_deduped_before_upsert(self):
        from django.utils import timezone
        from market_serving.materializers import materialize_unified_alerts
        from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical

        event_id = uuid.uuid4()
        occurred_at = timezone.now()
        legacy_rows = [
            (
                event_id,
                'FPT',
                'BUY',
                5_000_000_000,
                'high',
                'whale_flow',
                occurred_at.date(),
                occurred_at,
                {'price': 123000, 'volume': 1000},
            ),
            (
                event_id,
                'FPT',
                'BUY',
                5_000_000_000,
                'high',
                'whale_flow',
                occurred_at.date(),
                occurred_at,
                {'price': 123000, 'volume': 1000},
            ),
        ]

        with patch('market_serving.materializers._get_legacy_db_url', return_value='postgres://legacy-sync'), \
                patch('market_serving.materializers._fetch_from_legacy', return_value=legacy_rows):
            result = materialize_unified_alerts.run()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['upserted'], 1)
        self.assertEqual(result['duplicates_skipped'], 1)

        self.assertEqual(UnifiedAlert.objects.filter(source_ref=str(event_id)).count(), 1)
        self.assertEqual(WhaleAlertCanonical.objects.filter(alert__source_ref=str(event_id)).count(), 1)

        with self.assertRaises(IntegrityError):
            UnifiedAlert.objects.create(
                alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
                symbol='FPT',
                severity=UnifiedAlert.SeverityChoices.HIGH,
                title='Duplicate whale event',
                body='Duplicate source_ref should be rejected.',
                value=5_000_000_000,
                direction=UnifiedAlert.DirectionChoices.BUY,
                session_date=occurred_at.date(),
                triggered_at=occurred_at,
                source_ref=str(event_id),
            )


class TestCursorPaginationClasses(TestCase):
    """Pagination classes have correct defaults."""

    def test_core_cursor_pagination_defaults(self):
        p = CoreCursorPagination()
        self.assertEqual(p.page_size, 50)
        self.assertEqual(p.max_page_size, 200)

    def test_alert_cursor_pagination_ordering(self):
        p = AlertCursorPagination()
        self.assertEqual(p.ordering, "-triggered_at")

    def test_audit_cursor_pagination_page_size(self):
        p = AuditCursorPagination()
        self.assertEqual(p.page_size, 100)
        self.assertEqual(p.ordering, "-occurred_at")
