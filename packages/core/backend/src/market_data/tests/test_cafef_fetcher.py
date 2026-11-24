"""C2 fetcher: URL/date contract (TDD). Không gọi mạng trong test."""
from datetime import date
from unittest.mock import patch

from django.test import SimpleTestCase

from market_data.cafef.fetcher import build_export_url, fetch_xlsx


class CafefFetcherTests(SimpleTestCase):
    def test_export_url_uses_mm_dd_yyyy_and_all_symbol(self):
        url = build_export_url('HOSE', date(2022, 1, 1), date(2022, 12, 31))
        self.assertIn('ExchangeType=HOSE', url)
        self.assertIn('Symbol=ALL', url)
        self.assertIn('StartDate=01%2F01%2F2022', url)
        self.assertIn('EndDate=12%2F31%2F2022', url)

    def test_fetch_xlsx_uses_get_with_timeout(self):
        resp = type('R', (), {'status_code': 200, 'content': b'PK\x03\x04', 'raise_for_status': lambda self: None})()
        with patch('market_data.cafef.fetcher.requests.get', return_value=resp) as get:
            data = fetch_xlsx('HNX', 2022, timeout=12)
        self.assertEqual(data, b'PK\x03\x04')
        self.assertEqual(get.call_count, 1)
        self.assertEqual(get.call_args.kwargs['timeout'], 12)
