"""D1 tests: retail reference endpoints (validation + auth only).

Chạy: python manage.py test user_workspace.test_broker_retail

Các test gọi upstream đã bị gỡ ở bước 2/9 của đợt dọn dẹp: chúng
``patch('vnbroker.Vnbroker')`` mà package ``vnbroker`` không tồn tại trong repo.
Xem ``docs/CLAIMS.md`` claim ``cleanup-step2-vnbroker``.
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


def _mod():
    return 'user_workspace.views_retail'


class RetailReferenceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='bret', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        from django.core.cache import cache
        cache.clear()

    def test_gold_bad_source_400(self):
        resp = self.client.get('/core/v1/broker/retail/gold/?source=xyz')
        self.assertEqual(resp.status_code, 400)

    def test_requires_auth(self):
        anon = APIClient()
        resp = anon.get('/core/v1/broker/retail/gold/')
        self.assertEqual(resp.status_code, 401)

