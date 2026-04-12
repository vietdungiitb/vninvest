from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

class ApiRouteAdminSyncGroupsTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def test_stock_management_groups_endpoint(self):
        self.authenticate()

        response = self.client.get('/api/stock-management/groups/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    @patch('portfolio.views.sync_stock_profiles')
    def test_admin_sync_stockprofile_endpoint(self, mock_sync_stock_profiles):
        self.authenticate()
        mock_sync_stock_profiles.return_value = {
            'success': True,
            'message': 'Đã đồng bộ mã chứng khoán từ thị trường.',
            'warning': None,
            'source': 'vnstock',
            'total_symbols': 10,
            'created_symbols': 3,
            'updated_symbols': 7,
        }

        response = self.client.post('/api/admin-sync/stockprofile/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['success'])
        mock_sync_stock_profiles.assert_called_once()