"""S2 / REQ-BE-M04 + Q6 — bo side la khoi total & whale; nguong whale 500M.

Fail-before tren code cu: `buy_strength` khong doi (1 bucket) / gia tri cu; assert 500M that.
Fixture BAT BUOC 2 bucket (auditor R-O1): bucket 1 sach lam baseline, bucket 2 co 50B unknown.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from django.test import SimpleTestCase

from market_serving import session_facts_engine as engine


def _rows() -> list[dict]:
    # bucket 1 (10:00) sach 1B buy + 1B sell → baseline.
    # bucket 2 (11:00) = 1B buy + 1B sell + 50B unknown → old code pha total & whale.
    base = datetime(2026, 11, 25, 10, 0, tzinfo=timezone.utc)
    second = base + timedelta(hours=1)
    return [
        {'side': 'buy', 'matched_value': 1_000_000_000, 'executed_at': base},
        {'side': 'sell', 'matched_value': 1_000_000_000, 'executed_at': base},
        {'side': 'buy', 'matched_value': 1_000_000_000, 'executed_at': second},
        {'side': 'sell', 'matched_value': 1_000_000_000, 'executed_at': second},
        # 50B unknown — khong phai aggressor evidence, phai bo qua hoan toan.
        {'side': 'unknown', 'matched_value': 50_000_000_000, 'executed_at': second},
    ]


class SessionFactsTotalDenominatorTests(SimpleTestCase):
    def test_unknown_side_does_not_pollute_buy_strength(self) -> None:
        clean = engine._compute_session_facts_from_rows(_rows()[:4])
        polluted = engine._compute_session_facts_from_rows(_rows())
        self.assertIsNotNone(clean)
        self.assertIsNotNone(polluted)
        # Gia tri tham chieu co control (auditor v3): old 62.727 → fixed 50.0.
        self.assertNotEqual(
            round(polluted['buy_strength'], 3),
            round(clean['buy_strength'], 3),
            'unknown phai lam doi buy_strength (bucket total bi pha)',
        )
        self.assertEqual(round(polluted['buy_strength'], 3), 50.0)

    def test_delta_strength_control_unchanged(self) -> None:
        """delta_strength dung mau so buy+sell (`:216`) — KHONG duoc doi."""
        clean = engine._compute_session_facts_from_rows(_rows()[:4])
        polluted = engine._compute_session_facts_from_rows(_rows())
        self.assertEqual(clean['delta_strength_pct'], polluted['delta_strength_pct'])

    def test_whale_threshold_is_500m(self) -> None:
        self.assertEqual(engine._WHALE_THRESHOLD_VND, 500_000_000)
