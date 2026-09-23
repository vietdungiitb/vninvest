"""Phase B tests: SSI provider opt-in (gate credential + alias + fallback).

Chạy: python manage.py test market_data.tests.test_vnbroker_ssi_optin
"""
import os
from unittest.mock import patch

import pandas as pd
from django.test import TestCase

from market_data.vnbroker_adapter import (
    _build_intraday_source_candidates,
    _load_quote_class,
    _provider_available,
    _resolve_realtime_source,
    _ssi_keys_available,
)


class SsiGateTests(TestCase):
    """Gate credential + alias (cần DB vì fallback đọc VnbrokerRuntimeConfig)."""
    def test_keys_absent_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            for key in ('VNBROKER_BROKER_SSI_API_KEY', 'VNBROKER_BROKER_SSI_API_SECRET'):
                os.environ.pop(key, None)
            self.assertFalse(_ssi_keys_available())
            self.assertFalse(_provider_available('SSI'))
            self.assertTrue(_provider_available('VCI'))
            self.assertTrue(_provider_available('KBS'))

    def test_keys_present(self):
        with patch.dict(os.environ, {'VNBROKER_BROKER_SSI_API_KEY': 'k',
                                     'VNBROKER_BROKER_SSI_API_SECRET': 's'}):
            self.assertTrue(_ssi_keys_available())
            self.assertTrue(_provider_available('SSI'))

    def test_candidates_skip_ssi_without_keys(self):
        with patch.dict(os.environ, {}, clear=False):
            for key in ('VNBROKER_BROKER_SSI_API_KEY', 'VNBROKER_BROKER_SSI_API_SECRET'):
                os.environ.pop(key, None)
            candidates = _build_intraday_source_candidates(None)
            self.assertNotIn('SSI', candidates)
            self.assertIn('VCI', candidates)

    def test_candidates_include_ssi_with_keys(self):
        with patch.dict(os.environ, {'VNBROKER_BROKER_SSI_API_KEY': 'k',
                                     'VNBROKER_BROKER_SSI_API_SECRET': 's'}):
            candidates = _build_intraday_source_candidates('SSI')
            self.assertIn('SSI', candidates)

    def test_explicit_ssi_falls_back_without_keys(self):
        with patch.dict(os.environ, {}, clear=False):
            for key in ('VNBROKER_BROKER_SSI_API_KEY', 'VNBROKER_BROKER_SSI_API_SECRET'):
                os.environ.pop(key, None)
            resolved = _resolve_realtime_source('SSI')
            self.assertNotEqual(resolved, 'SSI')
            self.assertIn(resolved, ('VCI', 'KBS', 'DNSE'))

    def test_quote_class_alias_ssi(self):
        cls = _load_quote_class('SSI')
        self.assertEqual(cls.__name__, 'SSIQuote')

    def test_quote_class_default_still_quote(self):
        cls = _load_quote_class('KBS')
        self.assertEqual(cls.__name__, 'Quote')


class SsiFetchFlowTests(TestCase):
    def test_realtime_ssi_with_keys_uses_ssi_class(self):
        from market_data import vnbroker_adapter as adapter

        seen = {}

        class FakeSSIQuote:
            def __init__(self, symbol=None, **kwargs):
                seen['symbol'] = symbol
                seen['kwargs'] = kwargs

            def history(self, **kwargs):
                seen['history_kwargs'] = kwargs
                import pandas as pd
                return pd.DataFrame([{
                    'time': '2026-09-22 09:15:00', 'open': 20.0, 'high': 21.0,
                    'low': 19.5, 'close': 20.5, 'volume': 1000,
                }])

        with patch.dict(os.environ, {'VNBROKER_BROKER_SSI_API_KEY': 'k',
                                     'VNBROKER_BROKER_SSI_API_SECRET': 's'}):
            with patch.object(adapter, '_load_quote_class', return_value=FakeSSIQuote):
                result = adapter.fetch_realtime_price('SSI', source='SSI')
        self.assertIsNotNone(result)
        self.assertEqual(result['symbol'], 'SSI')
        self.assertAlmostEqual(result['close'], 20.5)
        self.assertEqual(result['source'], 'SSI')
        self.assertEqual(seen['history_kwargs'].get('interval'), '1D')
