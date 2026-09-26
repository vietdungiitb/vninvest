"""R0.1 — bằng chứng parser signal Unicode-aware.

Bảng case ở đây là bằng chứng chính thức: 14 case đã kiểm chứng bằng cách
chạy trực tiếp regex cũ (`views.py:696`) cho thấy sai, cộng 6 case biên.
"""

from django.test import SimpleTestCase

from advisory.signal_norm import (
    MAX_TOKENS,
    SIGNAL_BUY,
    SIGNAL_HOLD,
    SIGNAL_SELL,
    SIGNAL_UNKNOWN,
    normalize_confidence,
    normalize_risk_level,
    normalize_signal,
    signal_to_side,
    strip_accents,
    tokenize,
)


class SignalNormRegressionTests(SimpleTestCase):
    """14 case bằng chứng — regex cũ SAI, SSOT mới ĐÚNG."""

    #: (raw, expected)
    REGRESSION_CASES = [
        # 1-4: tiếng Việt có dấu bị regex cũ xoá dấu -> None
        ('BÁN', SIGNAL_SELL),
        ('BÁN LỤC', SIGNAL_SELL),
        ('GIỮ', SIGNAL_HOLD),
        ('BÁN (giảm tỷ trọng)', SIGNAL_SELL),
        # 5: nguy hiểm nhất — "không nên mua" bị regex cũ đọc thành BUY
        ('KHÔNG MUA', SIGNAL_UNKNOWN),
        # các case cũ vốn đúng, phải giữ nguyên
        ('BUY', SIGNAL_BUY),
        ('SELL', SIGNAL_SELL),
        ('MUA', SIGNAL_BUY),
        ('BAN', SIGNAL_SELL),
        ('MUA LÚC', SIGNAL_BUY),
        ('HOLD', SIGNAL_HOLD),
        ('THEO DÕI', SIGNAL_HOLD),
        ('NÊN MUA', SIGNAL_BUY),
        ('recommendation mua nhẹ 5%', SIGNAL_BUY),
    ]

    def test_regression_table(self):
        for raw, expected in self.REGRESSION_CASES:
            with self.subTest(raw=raw):
                self.assertEqual(normalize_signal(raw), expected)

    def test_vietnamese_sell_is_not_dropped(self):
        """Toàn bộ tín hiệu SELL tiếng Việt phải sống, không âm thầm mất."""
        self.assertEqual(normalize_signal('BÁN'), SIGNAL_SELL)
        self.assertNotEqual(normalize_signal('BÁN'), SIGNAL_UNKNOWN)

    def test_negated_buy_never_becomes_buy(self):
        for raw in ('KHÔNG MUA', 'KHÔNG NÊN MUA', 'KHÔNG MUA LÚC', 'DỪNG MUA', 'CHƯA NÊN MUA'):
            with self.subTest(raw=raw):
                self.assertEqual(normalize_signal(raw), SIGNAL_UNKNOWN)

    def test_mixed_direction_is_unknown(self):
        for raw in ('MUA VÀ BÁN', 'MUA, BÁN', 'BUY SELL'):
            with self.subTest(raw=raw):
                self.assertEqual(normalize_signal(raw), SIGNAL_UNKNOWN)

    def test_strip_accents_keeps_vietnamese_base(self):
        self.assertEqual(strip_accents('BÁN'), 'BAN')
        self.assertEqual(strip_accents('GIỮ'), 'GIU')
        self.assertEqual(strip_accents('THEO DÕI'), 'THEO DOI')
        self.assertEqual(strip_accents('MUA LÚC'), 'MUA LUC')

    def test_tokenize(self):
        self.assertEqual(tokenize('BÁN (giảm tỷ trọng)'), ['BAN', 'GIAM', 'TY', 'TRONG'])
        self.assertEqual(tokenize(None), [])
        self.assertEqual(tokenize(123), [])


class SignalNormEdgeCaseTests(SimpleTestCase):
    """6 case biên bắt buộc theo plan §10.4."""

    def test_edge_cases(self):
        cases = [
            ('', SIGNAL_UNKNOWN),
            (None, SIGNAL_UNKNOWN),
            ('   ', SIGNAL_UNKNOWN),
            ('BUY MUA BÁN HOLD WATCH', SIGNAL_UNKNOWN),  # > MAX_TOKENS
            ('MUA/BÁN', SIGNAL_UNKNOWN),
            ('5.0%', SIGNAL_UNKNOWN),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(normalize_signal(raw), expected)

    def test_prose_over_threshold_rejected(self):
        raw = ' '.join(['MUA'] * (MAX_TOKENS + 1))
        self.assertEqual(normalize_signal(raw), SIGNAL_UNKNOWN)

    def test_non_string_input_rejected(self):
        for raw in (1, 1.5, True, [], {}, object()):
            with self.subTest(raw=type(raw).__name__):
                self.assertEqual(normalize_signal(raw), SIGNAL_UNKNOWN)


class NormalizeConfidenceTests(SimpleTestCase):
    def test_valid_range(self):
        self.assertEqual(normalize_confidence(0), 0.0)
        self.assertEqual(normalize_confidence(1), 1.0)
        self.assertEqual(normalize_confidence(0.82), 0.82)
        self.assertEqual(normalize_confidence('0.85'), 0.85)
        self.assertEqual(normalize_confidence('0,85'), 0.85)

    def test_never_invents_value(self):
        for raw in (None, '', 'abc', 1.5, -0.1, True, [], float('nan'), float('inf')):
            with self.subTest(raw=raw):
                self.assertIsNone(normalize_confidence(raw))


class SignalToSideTests(SimpleTestCase):
    def test_mapping(self):
        self.assertEqual(signal_to_side('BUY'), 'BUY')
        self.assertEqual(signal_to_side('SELL'), 'SELL')
        self.assertEqual(signal_to_side('HOLD'), 'HOLD')

    def test_unknown_never_falls_back_to_buy(self):
        """Đảm bảo order ticket fail-closed: UNKNOWN không bao giờ thành BUY."""
        for raw in ('UNKNOWN', None, '', 'garbage', 'MUA VÀ BÁN'):
            with self.subTest(raw=raw):
                self.assertEqual(signal_to_side(raw), 'UNKNOWN')

    def test_risk_level(self):
        self.assertEqual(normalize_risk_level('HIGH'), 'high')
        self.assertEqual(normalize_risk_level('medium'), 'medium')
        self.assertEqual(normalize_risk_level('nonsense'), 'unknown')
        self.assertEqual(normalize_risk_level(None), 'unknown')
