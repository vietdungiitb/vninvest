"""R0.2 / R0.3 — contract của orchestrator và task ghi structured_output.

Bằng chứng gốc: `orchestrator.py` return `recommendation` + `summary` nhưng
không trả `signal`/`confidence_score`; `tasks.py` chỉ copy key **nếu có** nên
`structured_output` chỉ còn `{'summary': ...}` và `serializers.py` trả
`signal=None` vĩnh viễn. Test bên dưới khóa lại đủ key + fail-closed.
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

from advisory.orchestrator import (
    PROVIDER_ERROR_CODES,
    SIGNAL_UNPARSEABLE_CODE,
    AdvisorySynthesisError,
    _coerce_float,
)
from advisory.tasks import REQUIRED_STRUCTURED_KEYS, _build_structured_output
from advisory.signal_norm import SCHEMA_VERSION, SIGNAL_UNKNOWN


class _BuildStructuredOutputTests(SimpleTestCase):

    def test_all_required_keys_always_present(self):
        structured = _build_structured_output({}, '')
        for key in REQUIRED_STRUCTURED_KEYS:
            with self.subTest(key=key):
                self.assertIn(key, structured)
        self.assertEqual(structured['schema_version'], SCHEMA_VERSION)

    def test_signal_from_orchestrator_field(self):
        structured = _build_structured_output(
            {'signal': 'SELL', 'confidence_score': 0.8, 'summary': 'x'}, 'x',
        )
        self.assertEqual(structured['signal'], 'SELL')
        self.assertEqual(structured['confidence_score'], 0.8)

    def test_signal_falls_back_to_recommendation(self):
        """Model cũ chỉ trả `recommendation` — vẫn phải ra signal dùng được."""
        structured = _build_structured_output(
            {'recommendation': 'BÁN LỤC', 'summary': 'x'}, 'x',
        )
        self.assertEqual(structured['signal'], 'SELL')

    def test_vietnamese_recommendation_parsed(self):
        structured = _build_structured_output({'recommendation': 'BÁN'}, '')
        self.assertEqual(structured['signal'], 'SELL')

    def test_advisory_text_json_is_parsed(self):
        structured = _build_structured_output(
            {}, '{"signal": "BUY", "confidence_score": 0.7, "summary": "mua"}',
        )
        self.assertEqual(structured['signal'], 'BUY')
        self.assertEqual(structured['confidence_score'], 0.7)

    def test_plain_text_advisory_text_is_not_crashed(self):
        structured = _build_structured_output({}, 'Đây là một đoạn văn bình thường.')
        self.assertEqual(structured['signal'], SIGNAL_UNKNOWN)
        self.assertEqual(structured['advisory_text'], 'Đây là một đoạn văn bình thường.')

    def test_confidence_never_invented(self):
        structured = _build_structured_output({'signal': 'BUY'}, '')
        self.assertIsNone(structured['confidence_score'])

    def test_confidence_out_of_range_becomes_none(self):
        for raw in (1.5, -0.2, 82, 'abc'):
            with self.subTest(raw=raw):
                structured = _build_structured_output(
                    {'signal': 'BUY', 'confidence_score': raw}, '',
                )
                self.assertIsNone(structured['confidence_score'])

    def test_risk_level_normalized(self):
        self.assertEqual(
            _build_structured_output({'signal': 'BUY', 'risk_level': 'HIGH'})['risk_level'],
            'high',
        )
        self.assertEqual(
            _build_structured_output({'signal': 'BUY', 'risk_level': 'weird'})['risk_level'],
            'unknown',
        )

    def test_target_price_coerced_or_none(self):
        self.assertEqual(
            _build_structured_output({'signal': 'BUY', 'target_price': '15300'})['target_price'],
            15300.0,
        )
        self.assertIsNone(
            _build_structured_output({'signal': 'BUY', 'target_price': 'n/a'})['target_price'],
        )

    def test_normalized_by_marker_present(self):
        self.assertEqual(
            _build_structured_output({'signal': 'BUY'})['normalized_by'],
            'signal_norm.normalize_signal',
        )


class _CoerceFloatTests(SimpleTestCase):

    def test_valid(self):
        self.assertEqual(_coerce_float(1), 1.0)
        self.assertEqual(_coerce_float('1.5'), 1.5)
        self.assertEqual(_coerce_float('1,5'), 1.5)

    def test_invalid_returns_none(self):
        for raw in (None, '', 'abc', [], {}, True, False, float('nan')):
            with self.subTest(raw=raw):
                self.assertIsNone(_coerce_float(raw))


class AdvisorySynthesisErrorTests(SimpleTestCase):
    """R0.10 — lỗi phải có mã + thông điệp hành động, không lộ raw provider."""

    def test_404_maps_to_model_not_found(self):
        error = AdvisorySynthesisError(404, 'upstream body leak')
        self.assertEqual(error.error_code, 'provider_model_not_found')
        self.assertNotIn('upstream body leak', error.user_message)

    def test_401_and_403_map_to_auth(self):
        for status in (401, 403):
            with self.subTest(status=status):
                self.assertEqual(
                    AdvisorySynthesisError(status, 'x').error_code,
                    'provider_auth_failed',
                )

    def test_429_and_5xx_map_to_transient(self):
        self.assertEqual(
            AdvisorySynthesisError(429, 'x').error_code, 'provider_rate_limited',
        )
        for status in (500, 502, 503):
            with self.subTest(status=status):
                self.assertEqual(
                    AdvisorySynthesisError(status, 'x').error_code, 'provider_unavailable',
                )

    def test_unknown_status_falls_back(self):
        self.assertEqual(AdvisorySynthesisError(418, 'x').error_code, 'provider_error')

    def test_public_payload_shape(self):
        payload = AdvisorySynthesisError(404, 'leak').public_payload()
        self.assertEqual(
            set(payload), {'error_code', 'user_message', 'provider_status'},
        )

    def test_str_does_not_contain_raw_snippet(self):
        self.assertNotIn('leak', str(AdvisorySynthesisError(404, 'leak')))

    def test_all_mapped_codes_have_message(self):
        for status, (code, message) in PROVIDER_ERROR_CODES.items():
            with self.subTest(status=status):
                self.assertTrue(code)
                self.assertTrue(message)

    def test_signal_unparseable_code_exists(self):
        self.assertTrue(SIGNAL_UNPARSEABLE_CODE)

    def test_public_payload_is_json_serializable(self):
        """FE đọc `structured_output['error']` rồi đưa vào DOM — phải serialize được."""
        import json
        payload = AdvisorySynthesisError(503, 'leak').public_payload()
        self.assertEqual(json.loads(json.dumps(payload)), payload)


class ProviderRetryTests(SimpleTestCase):
    """R0.11 — retry chỉ lỗi tạm thời, không retry lỗi cấu hình.

    Bằng chứng (2026-09-26, probe endpoint Google OpenAI-compat): một request
    nhỏ tuần tự trả 200, nhưng orchestrator gọi 3 sub-agent song song thì cả 3
    trả 503 và synthesis trả 500 -> advisory fail 100%. Không retry thì tính
    năng không dùng được trên Gemini.
    """

    def test_retryable_statuses(self):
        from advisory.orchestrator import _is_retryable_status
        for status in (408, 429, 500, 502, 503, 504):
            with self.subTest(status=status):
                self.assertTrue(_is_retryable_status(status))

    def test_config_errors_are_not_retryable(self):
        from advisory.orchestrator import _is_retryable_status
        for status in (400, 401, 403, 404, 422):
            with self.subTest(status=status):
                self.assertFalse(_is_retryable_status(status))

    def test_unknown_status_is_not_retryable(self):
        from advisory.orchestrator import _is_retryable_status
        for status in (None, '', 'boom', []):
            with self.subTest(status=status):
                self.assertFalse(_is_retryable_status(status))

    def test_retry_budget_is_bounded(self):
        from advisory.orchestrator import (
            PROVIDER_RETRY_ATTEMPTS,
            PROVIDER_RETRY_BASE_SECONDS,
        )
        self.assertGreaterEqual(PROVIDER_RETRY_ATTEMPTS, 2)
        self.assertLessEqual(PROVIDER_RETRY_ATTEMPTS, 5)
        self.assertGreater(PROVIDER_RETRY_BASE_SECONDS, 0)
