from unittest.mock import patch

from django.test import SimpleTestCase
import pandas as pd

from portfolio import services


class ServicesVnstockRefactorTests(SimpleTestCase):
    @patch('portfolio.adapters.vnstock_adapter.fetch_symbols_by_group_series')
    @patch('portfolio.adapters.vnstock_adapter.fetch_symbols_by_industries_dataframe')
    def test_fetch_market_sectors_and_groups_uses_adapter_listing_wrappers(
        self,
        mock_fetch_industries,
        mock_fetch_group,
    ):
        mock_fetch_industries.return_value = pd.DataFrame(
            [
                {'symbol': 'VCB', 'industry_code': 101, 'industry_name': 'Ngan hang'},
                {'symbol': 'BID', 'industry_code': 101, 'industry_name': 'Ngan hang'},
                {'symbol': 'FPT', 'industry_code': 202, 'industry_name': 'Cong nghe'},
            ]
        )
        # _CAP_GROUP_DEFS has exactly 3 entries: VN30, VN100, HNX30
        mock_fetch_group.side_effect = [
            pd.Series(['VCB', 'BID']),
            pd.Series(['FPT']),
            pd.Series(['VCB', 'FPT']),
        ]

        result = services.fetch_market_sectors_and_groups()

        self.assertIsNone(result['error'])
        self.assertEqual(result['sectors'][0]['industry_code'], 101)
        self.assertEqual(result['sectors'][0]['symbols'], ['BID', 'VCB'])
        self.assertEqual(len(result['cap_groups']), 3)
        mock_fetch_industries.assert_called_once_with(anchor_symbol='ACB')

    @patch('portfolio.adapters.vnstock_adapter.fetch_symbols_by_exchange_dataframe')
    def test_fetch_exchange_lookup_uses_adapter_exchange_wrapper(self, mock_fetch_exchange):
        mock_fetch_exchange.return_value = pd.DataFrame(
            [
                {'symbol': 'VCB', 'organ_name': 'Vietcombank', 'exchange': 'HOSE'},
                {'symbol': 'BID', 'organ_name': 'BIDV', 'exchange': 'HOSE'},
            ]
        )

        result = services._fetch_exchange_lookup(timeout=1)

        mock_fetch_exchange.assert_called_once_with(anchor_symbol='ACB')
        self.assertEqual(result['VCB']['company_name'], 'Vietcombank')
        self.assertEqual(result['BID']['exchange'], 'HOSE')