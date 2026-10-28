"""
Tests for WebSocket consumer and symbol sanitization (C5 fix).

Validates that symbol parameters are sanitized before use in Redis channel keys.
"""

from django.test import TestCase

from signal_intelligence.consumers import _sanitize_symbol


class SymbolSanitizationTests(TestCase):
    """Tests for symbol sanitization function."""

    def test_sanitize_symbol_valid_uppercase(self):
        """Valid uppercase symbol should return unchanged."""
        result = _sanitize_symbol('VCB')
        self.assertEqual(result, 'VCB')

    def test_sanitize_symbol_valid_lowercase(self):
        """Lowercase symbol should be converted to uppercase."""
        result = _sanitize_symbol('vcb')
        self.assertEqual(result, 'VCB')

    def test_sanitize_symbol_valid_mixed(self):
        """Mixed case symbol should be converted to uppercase."""
        result = _sanitize_symbol('VcB')
        self.assertEqual(result, 'VCB')

    def test_sanitize_symbol_alphanumeric(self):
        """Alphanumeric symbol should be kept (uppercase)."""
        result = _sanitize_symbol('V1CB')
        self.assertEqual(result, 'V1CB')

    def test_sanitize_symbol_special_chars_removed(self):
        """Special characters should be removed."""
        result = _sanitize_symbol('V-C_B')
        self.assertEqual(result, 'VCB')

    def test_sanitize_symbol_spaces_removed(self):
        """Spaces should be removed."""
        result = _sanitize_symbol('V C B')
        self.assertEqual(result, 'VCB')

    def test_sanitize_symbol_dots_removed(self):
        """Dots should be removed (Redis key injection prevention)."""
        result = _sanitize_symbol('V.C.B')
        self.assertEqual(result, 'VCB')

    def test_sanitize_symbol_colons_removed(self):
        """Colons should be removed (Redis key injection prevention)."""
        result = _sanitize_symbol('V:C:B')
        self.assertEqual(result, 'VCB')

    def test_sanitize_symbol_asterisks_removed(self):
        """Asterisks should be removed (Redis wildcard prevention)."""
        result = _sanitize_symbol('V*C*B')
        self.assertEqual(result, 'VCB')

    def test_sanitize_symbol_slashes_removed(self):
        """Slashes should be removed (path traversal prevention)."""
        result = _sanitize_symbol('V/C/B')
        self.assertEqual(result, 'VCB')

    def test_sanitize_symbol_redis_injection_attempt(self):
        """Redis key injection attempt should be sanitized."""
        # Try to inject: 'VCB * redis:key:*'
        result = _sanitize_symbol('VCB * redis:key:*')
        self.assertEqual(result, 'VCBREDISKEY')  # Only alphanumeric kept

    def test_sanitize_symbol_empty_string(self):
        """Empty string should return None."""
        result = _sanitize_symbol('')
        self.assertIsNone(result)

    def test_sanitize_symbol_none(self):
        """None input should return None."""
        result = _sanitize_symbol(None)
        self.assertIsNone(result)

    def test_sanitize_symbol_only_special_chars(self):
        """Only special characters should return None."""
        result = _sanitize_symbol('!!!***---')
        self.assertIsNone(result)

    def test_sanitize_symbol_too_long(self):
        """Symbol longer than 20 chars should return None."""
        result = _sanitize_symbol('A' * 21)
        self.assertIsNone(result)

    def test_sanitize_symbol_max_length(self):
        """Symbol with exactly 20 chars should be valid."""
        result = _sanitize_symbol('A' * 20)
        self.assertEqual(result, 'A' * 20)

    def test_sanitize_symbol_single_char(self):
        """Single character symbol should be valid."""
        result = _sanitize_symbol('A')
        self.assertEqual(result, 'A')

    def test_sanitize_symbol_numbers_only(self):
        """Numeric only symbol should be valid."""
        result = _sanitize_symbol('123')
        self.assertEqual(result, '123')


class MarketTickerConsumerTests(TestCase):
    """Tests for MarketTickerConsumer symbol sanitization."""

    def test_consume_sanitizes_symbol_from_url_kwargs(self):
        """
        Symbol from URL kwargs should be sanitized before use.
        This prevents Redis key injection via specially crafted symbols.
        """
        from signal_intelligence.consumers import _sanitize_symbol

        # Test that symbol is sanitized correctly
        test_cases = [
            ('vcb', 'VCB'),  # lowercase → uppercase
            ('VCB', 'VCB'),  # already uppercase
            ('v:c:b', 'VCB'),  # colons removed (Redis key injection prevention)
            ('v*c*b', 'VCB'),  # asterisks removed (wildcard prevention)
            ('v.c.b', 'VCB'),  # dots removed
            ('v/c/b', 'VCB'),  # slashes removed
            ('VCB!!!', 'VCB'),  # special chars removed
            ('', None),  # empty → None
            ('!!!', None),  # only special chars → None
        ]

        for raw, expected in test_cases:
            with self.subTest(raw=raw):
                result = _sanitize_symbol(raw)
                self.assertEqual(result, expected)

    def test_group_name_construction_uses_sanitized_symbol(self):
        """
        Group name should only use sanitized symbols.
        Format: 'market_{SANITIZED_SYMBOL}'
        This prevents Redis channel key injection.
        """
        test_cases = [
            ('VCB', 'market_VCB'),
            ('v:c:b', 'market_VCB'),  # Redis key injection attempt
            ('V*', 'market_V'),  # Wildcard attempt
        ]

        for symbol_raw, expected_group_name in test_cases:
            with self.subTest(symbol=symbol_raw):
                sanitized = _sanitize_symbol(symbol_raw)
                if sanitized:
                    group_name = f'market_{sanitized}'
                    self.assertEqual(group_name, expected_group_name)

    def test_symbol_validation_rejects_long_symbols(self):
        """Symbols longer than 20 characters should be rejected."""
        long_symbol = 'A' * 21
        result = _sanitize_symbol(long_symbol)
        self.assertIsNone(result)

    def test_symbol_validation_accepts_max_length(self):
        """Symbols with exactly 20 characters should be accepted."""
        max_symbol = 'A' * 20
        result = _sanitize_symbol(max_symbol)
        self.assertEqual(result, max_symbol)

    def test_symbol_sanitization_preserves_alphanumeric(self):
        """Alphanumeric characters should be preserved."""
        test_cases = [
            ('VCB123', 'VCB123'),
            ('123ABC', '123ABC'),
            ('A1B2C3', 'A1B2C3'),
        ]

        for symbol, expected in test_cases:
            with self.subTest(symbol=symbol):
                result = _sanitize_symbol(symbol)
                self.assertEqual(result, expected)
