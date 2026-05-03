import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

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
