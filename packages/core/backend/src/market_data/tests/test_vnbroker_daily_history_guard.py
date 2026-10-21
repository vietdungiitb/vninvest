from types import SimpleNamespace
from unittest.mock import Mock, patch

import pandas as pd
from django.test import TestCase

from market_data.vnbroker_adapter import fetch_daily_history


class VnbrokerDailyHistoryGuardTests(TestCase):
    @patch('market_data.vnbroker_adapter.import_module')
    def test_explicit_dnse_source_is_hard_disabled_and_never_reaches_provider(self, import_module_mock):
        with self.assertLogs('market_data.vnbroker_adapter', level='WARNING') as logs:
            result = fetch_daily_history('acb', days=5, source='DNSE')

        self.assertEqual(result, [])
        import_module_mock.assert_not_called()
        self.assertTrue(any('DNSE_DAILY_OHLCV_DISABLED' in line for line in logs.output))

    @patch('market_data.vnbroker_adapter.import_module')
    @patch('market_data.vnbroker_adapter.get_active_config')
    @patch('market_data.vnbroker_adapter.get_soc_vnbroker_config')
    def test_runtime_dnse_source_falls_back_to_vci_for_daily_history(
        self,
        get_soc_vnbroker_config_mock,
        get_active_config_mock,
        import_module_mock,
    ):
        # Từ 2026-10-19 config SOC (control plane của console VNBroker) là nguồn
        # quyết định provider chính — `VnbrokerRuntimeConfig` chỉ còn là fallback
        # (audit Entry 384 F-26: trước đó config SOC không có hiệu lực runtime).
        # Kịch bản của test vẫn giữ nguyên: provider DNSE KHÔNG BAO GIỜ được dùng
        # cho daily OHLCV và phải log mã disable.
        get_soc_vnbroker_config_mock.return_value = {
            'preferred_provider': 'DNSE',
            'fallback_providers': [],
        }
        get_active_config_mock.return_value = SimpleNamespace(data_source='DNSE')

        quote_client = Mock()
        quote_client.history.return_value = pd.DataFrame([
            {
                'time': '2026-05-14',
                'open': 12.0,
                'high': 12.5,
                'low': 11.8,
                'close': 12.3,
                'volume': 4567,
            }
        ])
        quote_class = Mock(return_value=quote_client)
        import_module_mock.return_value = SimpleNamespace(Quote=quote_class)

        with self.assertLogs('market_data.vnbroker_adapter', level='WARNING') as logs:
            result = fetch_daily_history('acb', days=5)

        import_module_mock.assert_called_once_with('vnbroker.explorer.vci.quote')
        quote_class.assert_called_once_with(symbol='ACB')
        self.assertEqual(result[0]['source'], 'VCI')
        self.assertTrue(any('DNSE_DAILY_OHLCV_DISABLED' in line for line in logs.output))
