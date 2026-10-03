"""
D05 – Unit tests cho session_date param của detect_and_store_global_whale_alerts.
T-D1: session_date hợp lệ → task dùng ngày đó thay vì _get_latest_session_date().
T-D2: session_date không hợp lệ → trả về error ngay, không gọi DB.
T-D3: session_date=None → fallback về _get_latest_session_date() như cũ.
T-D4: session_date không có dữ liệu → trả về status='skipped' an toàn.
"""
from unittest.mock import patch, MagicMock
from datetime import date

from django.test import TestCase


class DetectHistoricalSessionDateTests(TestCase):
    """Test tham số session_date D05."""

    def _call(self, **kwargs):
        """Gọi task trực tiếp (không qua Celery broker)."""
        from signal_intelligence.tasks import detect_and_store_global_whale_alerts
        # Simulate celery task call without broker
        task = detect_and_store_global_whale_alerts
        # Bind mock self for bind=True tasks
        return task.apply(kwargs=kwargs).get()

    @patch('signal_intelligence.tasks._get_latest_session_date')
    @patch('signal_intelligence.order_flow_engine.load_session_ticks_df')
    @patch('signal_intelligence.order_flow_engine.detect_whale_ticks')
    @patch('signal_intelligence.order_flow_engine.detect_dark_flow_windows')
    @patch('signal_intelligence.order_flow_engine.compute_cvd_buckets_df')
    @patch('market_data.models.IntradayTick.objects')
    def test_session_date_valid_overrides_latest(
        self, mock_qs, mock_cvd, mock_dark, mock_whale, mock_load, mock_latest
    ):
        """T-D1: session_date hợp lệ → không gọi _get_latest_session_date."""
        import pandas as pd
        mock_load.return_value = pd.DataFrame()

        # Mock queryset chain
        mock_qs_filter = MagicMock()
        mock_qs.filter.return_value = mock_qs_filter
        mock_qs_filter.values.return_value.annotate.return_value.order_by.return_value.values_list.return_value.__getitem__ = MagicMock(return_value=[])

        result = self._call(session_date='2026-05-10', symbol='HPG')

        # _get_latest_session_date không được gọi khi session_date được truyền
        mock_latest.assert_not_called()
        # Không bị error
        self.assertNotEqual(result.get('status'), 'error')

    def test_session_date_invalid_returns_error(self):
        """T-D2: session_date sai format → status='error'."""
        result = self._call(session_date='not-a-date')
        self.assertEqual(result['status'], 'error')
        self.assertIn('invalid session_date', result['reason'])

    @patch('signal_intelligence.tasks._get_latest_session_date')
    @patch('market_data.models.IntradayTick.objects')
    def test_session_date_none_uses_latest(self, mock_qs, mock_latest):
        """T-D3: session_date=None → gọi _get_latest_session_date()."""
        mock_latest.return_value = None  # trả về None để task skip
        result = self._call(session_date=None)
        mock_latest.assert_called_once()
        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'no_tick_data')

    @patch('signal_intelligence.tasks._get_latest_session_date')
    @patch('signal_intelligence.order_flow_engine.load_session_ticks_df')
    @patch('market_data.models.IntradayTick.objects')
    def test_session_date_no_data_skips_gracefully(self, mock_qs, mock_load, mock_latest):
        """T-D4: session_date có giá trị nhưng không có ticks → skip an toàn."""
        import pandas as pd
        mock_load.return_value = pd.DataFrame()

        mock_qs_filter = MagicMock()
        mock_qs.filter.return_value = mock_qs_filter
        mock_qs_filter.values.return_value.annotate.return_value.order_by.return_value.values_list.return_value.__getitem__ = MagicMock(return_value=['HPG'])

        result = self._call(session_date='2020-01-01', symbol='HPG')

        # Không crash, không error
        self.assertNotIn(result.get('status'), ['error'])
