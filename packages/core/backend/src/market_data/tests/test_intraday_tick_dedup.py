"""S3 / REQ-BE-M03 + G-2 — idempotency IntradayTick, KHONG nuot lenh trung giay.

Fail-before tren code cu: module `tick_dedup` chua ton tai / khong co UniqueConstraint
⇒ RED. G-2: provider DNSE khong co trade id (probe 2026-11-28), nen dung seq_in_key.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal

import django
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from market_data.models import IntradayTick
from market_data.tick_dedup import assign_dedup_keys, build_dedup_key


def _row(ts: datetime, *, price: str = '100000', volume: int = 100, side: str = 'BUY') -> dict:
    return {
        'symbol': 'VIC',
        'timestamp': ts,
        'price': Decimal(price),
        'volume': volume,
        'side': side,
        'match_type': 'NormalMatch',
        'source': 'vnbroker_intraday',
    }


class IntradayTickDedupTests(TestCase):
    def setUp(self) -> None:
        self.day = datetime(2026, 11, 25).date()
        self.t = timezone.make_aware(datetime.combine(self.day, time(10, 30)), dt_timezone.utc)

    def test_g2_same_second_orders_get_different_keys(self) -> None:
        """Hai lenh lô lẻ cung giay/gia/volume/phai van co dedup_key KHAC nhau."""
        rows = assign_dedup_keys([_row(self.t), _row(self.t)])
        self.assertEqual(rows[0]['dedup_key'] != rows[1]['dedup_key'], True)

    def test_build_dedup_key_is_stable(self) -> None:
        row = _row(self.t)
        key1 = build_dedup_key(**{**row, 'seq_in_key': 0})
        key2 = build_dedup_key(**{**row, 'seq_in_key': 0})
        self.assertEqual(key1, key2)
        self.assertEqual(len(key1), 64)

    def test_duplicate_insert_is_ignored(self) -> None:
        row = assign_dedup_keys([_row(self.t)])[0]
        IntradayTick.objects.create(**row)
        before = IntradayTick.objects.filter(symbol='VIC').count()
        created = IntradayTick.objects.bulk_create([IntradayTick(**row)], ignore_conflicts=True)
        after = IntradayTick.objects.filter(symbol='VIC').count()
        self.assertEqual(after, before, 'backfill x2 khong duoc tang row')
        self.assertEqual(len(created), 0, 'phat hien conflict that, khong chi "khong tang"')

    def test_duplicate_insert_without_ignore_conflicts_raises(self) -> None:
        row = assign_dedup_keys([_row(self.t)])[0]
        IntradayTick.objects.create(**row)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                IntradayTick.objects.create(**row)

    def test_positive_control_distinct_tick_inserted(self) -> None:
        rows = assign_dedup_keys([
            _row(self.t),
            _row(self.t + timedelta(seconds=1)),
        ])
        IntradayTick.objects.bulk_create([IntradayTick(**r) for r in rows])
        self.assertEqual(IntradayTick.objects.filter(symbol='VIC').count(), 2)
