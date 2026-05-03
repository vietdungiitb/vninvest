"""
SAAS-13: market_serving model tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

import datetime
from decimal import Decimal

from django.test import TestCase

from market_serving.models import SessionFacts, SymbolSnapshot


class SymbolSnapshotModelTests(TestCase):
    def test_create_snapshot(self):
        snap = SymbolSnapshot.objects.create(
            symbol='VCB',
            session_date=datetime.date(2026, 5, 3),
            price=Decimal('88500.00'),
            price_change=Decimal('500.00'),
            price_change_pct=Decimal('0.5679'),
            volume=1_500_000,
            market_status='open',
            source='live',
        )
        self.assertEqual(snap.symbol, 'VCB')
        self.assertFalse(snap.stale)
        self.assertEqual(str(snap.price), '88500.00')

    def test_unique_together_symbol_session_date(self):
        from django.db import IntegrityError
        SymbolSnapshot.objects.create(
            symbol='HPG',
            session_date=datetime.date(2026, 5, 3),
            price=Decimal('25000.00'),
            volume=2_000_000,
        )
        with self.assertRaises(IntegrityError):
            SymbolSnapshot.objects.create(
                symbol='HPG',
                session_date=datetime.date(2026, 5, 3),
                price=Decimal('25100.00'),
                volume=2_100_000,
            )


class SessionFactsModelTests(TestCase):
    def test_create_session_facts(self):
        facts = SessionFacts.objects.create(
            symbol='VCB',
            session_date=datetime.date(2026, 5, 3),
            cvd_normalized=0.42,
            buy_strength=0.68,
            institutional_strength=0.55,
            whale_net_flow=5_000_000_000,
            dark_flow_score=0.12,
            total_buy_volume=800_000,
            total_sell_volume=700_000,
            source='computed',
        )
        self.assertEqual(facts.symbol, 'VCB')
        self.assertAlmostEqual(facts.cvd_normalized, 0.42)
        self.assertFalse(facts.stale)
