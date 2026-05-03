import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Ensure src/ is on sys.path for both stub and Django imports
_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from vninvest_core.api_stub import _capability_bootstrap_payload, _health_payload
from vninvest_core.app_manifest import get_core_manifest
from vninvest_core.stub_heartbeat import run_healthcheck, write_heartbeat


class CoreRuntimeBaselineTests(unittest.TestCase):
    def test_manifest_exposes_core_topology(self):
        manifest = get_core_manifest()

        self.assertEqual(manifest['package'], 'vninvest-core')
        self.assertEqual(manifest['service_names'], ['core-api', 'core-worker', 'core-beat'])
        self.assertEqual(manifest['topology']['api'], 'core-api')
        self.assertEqual(manifest['topology']['worker'], 'core-worker')
        self.assertEqual(manifest['topology']['beat'], 'core-beat')

    def test_capability_bootstrap_exposes_saas_routes_and_snapshot_version(self):
        with patch.dict(
            os.environ,
            {
                'CORE_STUB_BUILD_TARGET': 'saas',
                'CORE_STUB_IS_STAFF': 'true',
                'CORE_STUB_IS_SUPERUSER': 'true',
            },
            clear=False,
        ):
            payload = _capability_bootstrap_payload()

        self.assertEqual(payload['snapshot_version'], '2026-05-03')
        self.assertIn('ai-advisory', payload['navigation']['visible_routes'])
        self.assertIn('whale-alerts', payload['navigation']['visible_routes'])
        self.assertIn('admin-ops', payload['navigation']['visible_routes'])
        self.assertTrue(payload['surfaces']['show_admin_ops'])
        self.assertTrue(payload['surfaces']['show_ai_command_center'])

    def test_healthcheck_accepts_fresh_written_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            health_file = Path(tmpdir) / 'health.json'
            heartbeat_path = write_heartbeat('core-api', 30.0, 'started', str(health_file))

            self.assertTrue(heartbeat_path.exists())

            with patch.dict(
                os.environ,
                {
                    'CORE_STUB_HEALTH_FILE': str(health_file),
                    'CORE_STUB_HEALTH_MAX_AGE_SECONDS': '60',
                },
                clear=False,
            ):
                with self.assertRaises(SystemExit) as exit_context:
                    run_healthcheck(str(health_file))

            self.assertEqual(exit_context.exception.code, 0)

        self.assertEqual(_health_payload()['version'], get_core_manifest()['version'])


class DjangoHealthViewTests(unittest.TestCase):
    """SAAS-13: Verify Django health/capability-bootstrap views and middleware."""

    def setUp(self):
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
        import django
        try:
            django.setup()
        except RuntimeError:
            pass  # already set up

    def test_health_view_returns_ok(self):
        from django.test import RequestFactory
        from vninvest_core.views_health import health

        factory = RequestFactory()
        request = factory.get('/core/v1/health')
        request.META['X_REQUEST_ID'] = 'test-req-id'
        response = health(request)
        import json
        data = json.loads(response.content)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['package'], 'vninvest-core')
        self.assertIn('timestamp', data)

    def test_capability_bootstrap_returns_navigation(self):
        from django.test import RequestFactory
        from vninvest_core.views_health import capability_bootstrap

        factory = RequestFactory()
        request = factory.get('/core/v1/capability-bootstrap')
        response = capability_bootstrap(request)
        import json
        data = json.loads(response.content)
        self.assertEqual(response.status_code, 200)
        self.assertIn('whale-alerts', data['navigation']['visible_routes'])
        self.assertIn('ai-advisory', data['navigation']['visible_routes'])
        self.assertIn('admin-ops', data['navigation']['visible_routes'])

    def test_x_request_id_propagated(self):
        from django.test import RequestFactory
        from ops_audit.middleware import RequestTraceMiddleware

        factory = RequestFactory()
        request = factory.get('/test', HTTP_X_REQUEST_ID='my-custom-id')
        captured = {}

        def get_response(req):
            from django.http import HttpResponse
            captured['request_id_in_meta'] = req.META.get('X_REQUEST_ID')
            return HttpResponse('ok')

        middleware = RequestTraceMiddleware(get_response)
        response = middleware(request)
        self.assertEqual(captured['request_id_in_meta'], 'my-custom-id')
        self.assertEqual(response['X-Request-ID'], 'my-custom-id')

    def test_x_request_id_generated_when_absent(self):
        from django.test import RequestFactory
        from ops_audit.middleware import RequestTraceMiddleware

        factory = RequestFactory()
        request = factory.get('/test')

        def get_response(req):
            from django.http import HttpResponse
            return HttpResponse('ok')

        middleware = RequestTraceMiddleware(get_response)
        response = middleware(request)
        request_id = response['X-Request-ID']
        # UUID4 is 36 characters
        self.assertEqual(len(request_id), 36, f'Expected UUID4 length 36, got: {len(request_id)}')
