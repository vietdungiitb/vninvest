from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

from portfolio.models import WhaleAdvisory
from portfolio.tasks import generate_whale_advisory_task


@override_settings(WHALE_ADVISORY_COOLDOWN_SECONDS=900)
class WhaleAdvisoryTaskTests(TestCase):
    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.openclaw_client.generate_whale_deep')
    @patch('portfolio.openclaw_client.generate_whale_summary')
    def test_task_persists_threshold_and_broadcast_metadata(
        self,
        mock_generate_summary,
        mock_generate_deep,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        mock_generate_summary.return_value = {
            'text': 'Tom tat AI',
            'prompt_tokens': 10,
            'completion_tokens': 20,
        }
        mock_generate_deep.return_value = {
            'text': 'Phan tich sau AI',
            'prompt_tokens': 30,
            'completion_tokens': 40,
        }
        mock_sender = MagicMock()
        mock_async_to_sync.return_value = mock_sender
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol='FPT',
            matched_value_vnd=8_200_000_000,
            side='BUY',
            threshold=5_000_000_000,
        )

        advisory = WhaleAdvisory.objects.get(symbol='FPT')
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(advisory.threshold, 5_000_000_000)
        self.assertEqual(advisory.ai_summary, 'Tom tat AI')
        self.assertEqual(advisory.ai_detail, 'Phan tich sau AI')

        mock_sender.assert_called_once()
        group_name, event = mock_sender.call_args.args
        self.assertEqual(group_name, 'whale_FPT')
        self.assertEqual(event['type'], 'whale_advisory')
        self.assertEqual(event['payload']['threshold'], 5_000_000_000)
        self.assertEqual(event['payload']['matched_value'], 8_200_000_000)
        self.assertIn('ts', event['payload'])