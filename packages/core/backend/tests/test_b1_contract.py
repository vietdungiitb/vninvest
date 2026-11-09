"""B1 (W1.1) — RED contract: BE chỉ trả posture + levels.

TDD: các test dưới đây được viết trước khi code GREEN và sẽ FAIL trên code
cũ (thiếu helper `_assemble_advisory_result` / thiếu contract mới).
Sau GREEN, toàn bộ file này phải PASS.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.test import SimpleTestCase

from advisory.tasks import _build_structured_output


class B1TasksStructuredContractTests(SimpleTestCase):
    """B1 RED-b: tasks structured output posture + levels, không signal."""

    def test_b1_posture_only_contract(self):
        structured = _build_structured_output(
            {'posture': 'BULLISH', 'levels': {'support': 10, 'resistance': 20}},
            '',
        )
        self.assertEqual(structured['posture'], 'BULLISH')
        self.assertEqual(
            structured['levels'], {'support': 10.0, 'resistance': 20.0},
        )
        for legacy in ('signal', 'recommendation', 'target_price'):
            with self.subTest(legacy=legacy):
                self.assertNotIn(legacy, structured)

    def test_levels_coerced_or_none(self):
        structured = _build_structured_output(
            {'posture': 'NEUTRAL', 'levels': {'support': '10,5', 'resistance': 'n/a'}},
            '',
        )
        self.assertEqual(
            structured['levels'], {'support': 10.5, 'resistance': None},
        )

    def test_posture_derived_from_legacy_signal_fallback(self):
        """Legacy result chỉ có signal → posture vẫn suy đúng (backfill đọc SSOT)."""
        structured = _build_structured_output(
            {'signal': 'SELL', 'confidence_score': 0.7}, '',
        )
        self.assertEqual(structured['posture'], 'BEARISH')


class B1OrchestratorResultContractTests(SimpleTestCase):
    """B1 RED-a: orchestrator return schema chỉ posture + levels.

    Return là literal inline trong run_async nên test qua helper pure
    `_assemble_advisory_result` (sẽ được extract ở GREEN) — FAIL trước GREEN
    vì helper chưa tồn tại.
    """

    def test_b1_orchestrator_return_no_legacy_keys(self):
        from advisory.orchestrator import _assemble_advisory_result

        result = _assemble_advisory_result(
            {
                'posture': 'BEARISH',
                'levels': {'support': '14000', 'resistance': 16000},
                'summary': 'Tóm tắt.',
                'confidence_score': 0.82,
                'rationale': 'Lý do.',
                'risk_level': 'high',
                'target_price': 99999,
                'recommendation': 'BÁN',
                'signal': 'SELL',
            },
            ai_model='m',
            tokens_used=10,
            usage=(1, 2, False),
            metrics={}, input_snapshot={}, feature_attribution={},
            is_stale=False, tech_res='t', flow_res='f', sent_res='s',
        )
        for legacy in ('signal', 'signal_raw', 'recommendation', 'target_price'):
            with self.subTest(legacy=legacy):
                self.assertNotIn(legacy, result)
        self.assertEqual(result['posture'], 'BEARISH')
        self.assertEqual(
            result['levels'], {'support': 14000.0, 'resistance': 16000.0},
        )
