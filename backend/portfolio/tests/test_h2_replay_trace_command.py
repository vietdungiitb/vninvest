import json
from io import StringIO
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.test import TestCase

from portfolio.models import AdvisoryAggregateSnapshot, WhaleAdvisory
from portfolio.tasks import generate_whale_advisory_task


class H2ReplayTraceCommandTests(TestCase):
    def _create_user_with_config(self, username: str):
        from django.contrib.auth.models import User
        from portfolio.models import UserConfig

        user = User.objects.create_user(username=username, password='Test@123456', is_staff=True)
        cfg = UserConfig.objects.create(user=user, ai_provider='openai', ai_model='gpt-4o')
        cfg.set_ai_api_key('sk-test-h2-replay')
        cfg.save(update_fields=['ai_api_key'])
        return user

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_whale_text')
    @patch('portfolio.tasks_whale_preflight_ai.resolve_ai_runtime_config')
    def test_replay_command_outputs_snapshot_and_audit_trace(
        self,
        mock_resolve_ai_runtime_config,
        mock_generate_text,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        user = self._create_user_with_config('h2-replay-user')
        mock_resolve_ai_runtime_config.return_value = {
            'ready': True,
            'source': 'command_center',
            'provider': 'openai',
            'model': 'gpt-4o',
            'api_key': 'sk-test-h2-replay',
            'reason': None,
            'message': '',
        }
        mock_generate_text.side_effect = [
            {'text': 'summary replay', 'prompt_tokens': 10, 'completion_tokens': 20},
            {'text': 'detail replay', 'prompt_tokens': 30, 'completion_tokens': 40},
        ]
        mock_get_channel_layer.return_value = MagicMock()
        mock_async_to_sync.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol='REE',
            matched_value_vnd=3_300_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=user.id,
        )

        advisory = WhaleAdvisory.objects.get(pk=result['advisory_id'])
        self.assertIsNotNone(advisory.aggregate_snapshot_id)
        self.assertTrue(
            AdvisoryAggregateSnapshot.objects.filter(pk=advisory.aggregate_snapshot_id, user=user, symbol='REE').exists()
        )

        stdout = StringIO()
        call_command('replay_advisory_trace', advisory_id=advisory.id, max_logs=10, stdout=stdout)
        payload = json.loads(stdout.getvalue())

        self.assertEqual(payload['trace']['advisory_id'], advisory.id)
        self.assertEqual(payload['trace']['snapshot_id'], advisory.aggregate_snapshot_id)
        self.assertTrue(payload['trace']['replay_ready'])
        self.assertEqual(payload['advisory']['aggregate_snapshot_id'], advisory.aggregate_snapshot_id)
        self.assertGreaterEqual(payload['counts']['matched_audit_logs'], 1)
