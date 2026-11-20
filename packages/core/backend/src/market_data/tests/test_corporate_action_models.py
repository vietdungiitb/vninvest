"""Task 1 — models cho Corporate Actions Pipeline (fail-before)."""
from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase

from market_data.models import CorporateAction, DailyPrice


class CorporateActionModelTests(TestCase):
    def _event(self, **overrides):
        data = dict(
            symbol='VNM',
            action_type='DIV',
            ex_date=date(2024, 9, 24),
            cash_amount_per_share=Decimal('950.00'),
            currency='VND',
            source='VCI',
            source_event_id='evt-001',
            raw_title='Trả cổ tức bằng tiền mặt - Đợt 4 2023 - 950 VND',
            parse_status='parsed_from_text',
            fetched_at='2026-11-20T00:00:00Z',
        )
        data.update(overrides)
        return CorporateAction.objects.create(**data)

    def test_two_events_same_ex_date_different_source_event_id(self):
        self._event(source_event_id='evt-001', cash_amount_per_share=Decimal('950.00'))
        self._event(source_event_id='evt-002', cash_amount_per_share=Decimal('1500.00'))
        self.assertEqual(
            CorporateAction.objects.filter(symbol='VNM', ex_date=date(2024, 9, 24)).count(),
            2,
        )

    def test_duplicate_source_event_id_raises_integrity_error(self):
        self._event(source_event_id='evt-001')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._event(source_event_id='evt-001', raw_title='title changed')

    def test_daily_price_adj_close_defaults_null(self):
        row = DailyPrice.objects.create(
            symbol='VNM',
            date=date(2024, 9, 23),
            open=Decimal('100000.00'),
            high=Decimal('100000.00'),
            low=Decimal('100000.00'),
            close=Decimal('100000.00'),
            volume=1000,
        )
        self.assertIsNone(row.adj_close)
