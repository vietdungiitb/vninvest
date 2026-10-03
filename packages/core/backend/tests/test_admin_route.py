"""
Core admin route tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.test import TestCase


class CoreAdminRouteTests(TestCase):
    def test_admin_root_redirects_to_login(self):
        response = self.client.get('/admin/', follow=False)

        self.assertEqual(response.status_code, 302)
        self.assertIn('/admin/login/', response['Location'])

    def test_admin_login_page_is_servable(self):
        response = self.client.get('/admin/login/', follow=False)

        self.assertEqual(response.status_code, 200)