"""Reference price phải lấy phiên giao dịch gần nhất, không phải calendar yesterday."""
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from market_serving.vnbroker_materializer import fetch_realtime_tickers_from_vnbroker


def test_reference_uses_last_trading_day_not_calendar_yesterday():
    live = {'close': 100, 'volume': 10, 'fetched_at': 'now'}
    with patch('market_data.vnbroker_adapter.fetch_realtime_price', return_value=live), \
         patch('market_data.models.DailyPrice.objects') as mgr:
        row = SimpleNamespace(close=Decimal('95'))
        mgr.filter.return_value.first.return_value = row  # code cũ
        mgr.filter.return_value.order_by.return_value.first.return_value = row  # code mới
        out = fetch_realtime_tickers_from_vnbroker(['TPB'])
    assert out[0]['reference_price'] == 95.0
    assert 'date__lt' in mgr.filter.call_args.kwargs
    mgr.filter.return_value.order_by.assert_called_with('-date')
