"""
Tests cho Screener CRUD API và cache snapshot evaluator.

Coverage:
  1.  GET /screener/rules/ - unauthenticated → 401
  2.  GET /screener/rules/ - authenticated, danh sách rỗng → 200 []
  3.  POST /screener/rules/ - tạo rule hợp lệ → 201
  4.  POST /screener/rules/ - rules_json rỗng → 400
  5.  POST /screener/rules/ - field không hợp lệ → 400
  6.  POST /screener/rules/ - op không hợp lệ → 400
  7.  POST /screener/rules/ - value không phải số → 400
  8.  GET /screener/rules/{id}/ - xem detail rule của mình → 200
  9.  GET /screener/rules/{id}/ - xem rule của user khác → 404
  10. PUT /screener/rules/{id}/ - cập nhật rule → 200
  11. DELETE /screener/rules/{id}/ - xóa rule → 204
  12. DELETE /screener/rules/{id}/ - xóa rule của user khác → 404
    13. POST /screener/rules/{id}/run/ - cache snapshot rỗng → matched=[], total_scanned=0
    14. POST /screener/rules/{id}/run/ - cache snapshot có row khớp → matched có data
    15. POST /screener/rules/{id}/run/ - cache snapshot có row không khớp → matched=[]
"""

from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import ScreenerRule, UserConfig
from portfolio.services_global_screener import GlobalScreenerService

LIST_URL = '/api/portfolio/screener/rules/'
DETAIL_URL = lambda pk: f'/api/portfolio/screener/rules/{pk}/'
RUN_URL = lambda pk: f'/api/portfolio/screener/rules/{pk}/run/'


def get_token(client, username, password='Test@123456'):
    user = User.objects.get(username=username)
    cfg, _ = UserConfig.objects.get_or_create(user=user)
    if not cfg.email_verified:
        cfg.email_verified = True
        cfg.save(update_fields=['email_verified', 'updated_at'])
    resp = client.post('/api/auth/token/', {'username': username, 'password': password}, format='json')
    return resp.data.get('access')


class ScreenerAuthTests(APITestCase):
    """Tests 1-2: authentication."""

    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='Test@123456')

    def test_unauthenticated_list(self):
        resp = self.client.get(LIST_URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_empty_list(self):
        token = get_token(self.client, 'u1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        resp = self.client.get(LIST_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, [])


class ScreenerCRUDTests(APITestCase):
    """Tests 3-12: CRUD."""

    def setUp(self):
        self.user = User.objects.create_user(username='u2', password='Test@123456')
        self.other = User.objects.create_user(username='u3', password='Test@123456')
        token = get_token(self.client, 'u2')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def _valid_payload(self, name='Test rule'):
        return {
            'name': name,
            'rules_json': [{'field': 'rsi_14', 'op': 'lt', 'value': 30}],
        }

    # --- 3. Tạo rule hợp lệ ---
    def test_create_valid_rule(self):
        resp = self.client.post(LIST_URL, self._valid_payload(), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['name'], 'Test rule')
        self.assertEqual(len(resp.data['rules_json']), 1)

    # --- 3b. Field dòng tiền mới hợp lệ ---
    def test_create_whale_intensity_rule(self):
        resp = self.client.post(LIST_URL, {
            'name': 'Flow',
            'rules_json': [{'field': 'whale_intensity', 'op': 'gte', 'value': 80}],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['rules_json'][0]['field'], 'whale_intensity')

    # --- 4. rules_json rỗng ---
    def test_create_empty_rules_json(self):
        resp = self.client.post(LIST_URL, {'name': 'Bad', 'rules_json': []}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 5. Field không hợp lệ ---
    def test_create_invalid_field(self):
        resp = self.client.post(LIST_URL, {
            'name': 'Bad',
            'rules_json': [{'field': 'nonexistent_field', 'op': 'lt', 'value': 10}]
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 6. Op không hợp lệ ---
    def test_create_invalid_op(self):
        resp = self.client.post(LIST_URL, {
            'name': 'Bad',
            'rules_json': [{'field': 'rsi_14', 'op': 'not_an_op', 'value': 10}]
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 7. Value không phải số ---
    def test_create_non_numeric_value(self):
        resp = self.client.post(LIST_URL, {
            'name': 'Bad',
            'rules_json': [{'field': 'rsi_14', 'op': 'lt', 'value': 'abc'}]
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 8. Detail rule của mình ---
    def test_get_own_rule(self):
        rule = ScreenerRule.objects.create(
            user=self.user, name='MyRule',
            rules_json=[{'field': 'close', 'op': 'gt', 'value': 10000}]
        )
        resp = self.client.get(DETAIL_URL(rule.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['name'], 'MyRule')

    # --- 9. Detail rule của user khác ---
    def test_get_other_user_rule(self):
        other_rule = ScreenerRule.objects.create(
            user=self.other, name='OtherRule',
            rules_json=[{'field': 'close', 'op': 'gt', 'value': 10000}]
        )
        resp = self.client.get(DETAIL_URL(other_rule.id))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    # --- 10. Update rule ---
    def test_update_rule(self):
        rule = ScreenerRule.objects.create(
            user=self.user, name='Old',
            rules_json=[{'field': 'rsi_14', 'op': 'lt', 'value': 30}]
        )
        resp = self.client.put(DETAIL_URL(rule.id), {
            'name': 'Updated',
            'rules_json': [{'field': 'close', 'op': 'gte', 'value': 50000}]
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['name'], 'Updated')

    # --- 11. Xóa rule của mình ---
    def test_delete_own_rule(self):
        rule = ScreenerRule.objects.create(
            user=self.user, name='ToDelete',
            rules_json=[{'field': 'rsi_14', 'op': 'gt', 'value': 70}]
        )
        resp = self.client.delete(DETAIL_URL(rule.id))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ScreenerRule.objects.filter(pk=rule.id).exists())

    # --- 12. Xóa rule của user khác ---
    def test_delete_other_user_rule(self):
        other_rule = ScreenerRule.objects.create(
            user=self.other, name='OtherToDelete',
            rules_json=[{'field': 'rsi_14', 'op': 'gt', 'value': 70}]
        )
        resp = self.client.delete(DETAIL_URL(other_rule.id))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class ScreenerRunTests(APITestCase):
    """Tests 13-15: evaluator."""

    def setUp(self):
        self.user = User.objects.create_user(username='u4', password='Test@123456')
        token = get_token(self.client, 'u4')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        cache.clear()

    def tearDown(self):
        cache.clear()

    def _make_rule(self, rules_json):
        return ScreenerRule.objects.create(
            user=self.user, name='RunTest', rules_json=rules_json
        )

    def _seed_snapshot(self, rows):
        cache.set(GlobalScreenerService.CACHE_KEY, {'rows': rows})

    # --- 13. Cache snapshot rỗng ---
    def test_run_no_data(self):
        rule = self._make_rule([{'field': 'rsi_14', 'op': 'lt', 'value': 30}])
        self._seed_snapshot([])
        resp = self.client.post(RUN_URL(rule.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['matched'], [])
        self.assertEqual(resp.data['total_scanned'], 0)

    # --- 14. Cache snapshot có row khớp ---
    def test_run_with_matching_data(self):
        self._seed_snapshot([
            {
                'symbol': 'VNM',
                'date': '2026-03-31',
                'close': 80000,
                'close_price': 80000,
                'volume': 1_000_000,
            }
        ])
        # Giá đóng cửa > 50000 → nên khớp
        rule = self._make_rule([{'field': 'close', 'op': 'gt', 'value': 50000}])
        resp = self.client.post(RUN_URL(rule.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['total_scanned'], 1)
        self.assertEqual(resp.data['matched_count'], 1)
        self.assertEqual(resp.data['matched'][0]['symbol'], 'VNM')

    # --- 14b. Cache snapshot có row khớp theo field dòng tiền ---
    def test_run_with_flow_matching_data(self):
        self._seed_snapshot([
            {
                'symbol': 'VCB',
                'date': '2026-03-31',
                'close': 120000,
                'close_price': 120000,
                'volume': 1_000_000,
                'whale_intensity': 88,
                'dark_flow_strength': 82,
            }
        ])
        rule = self._make_rule([{'field': 'whale_intensity', 'op': 'gte', 'value': 80}])
        resp = self.client.post(RUN_URL(rule.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['total_scanned'], 1)
        self.assertEqual(resp.data['matched_count'], 1)
        self.assertEqual(resp.data['matched'][0]['symbol'], 'VCB')

    # --- 15. Cache snapshot có row không khớp ---
    def test_run_with_no_match(self):
        self._seed_snapshot([
            {
                'symbol': 'VNM',
                'date': '2026-03-31',
                'close': 80000,
                'close_price': 80000,
                'volume': 1_000_000,
            }
        ])
        # close > 200000 → không khớp
        rule = self._make_rule([{'field': 'close', 'op': 'gt', 'value': 200000}])
        resp = self.client.post(RUN_URL(rule.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['total_scanned'], 1)
        self.assertEqual(resp.data['matched_count'], 0)
        self.assertEqual(resp.data['matched'], [])
