from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.core.cache import cache

from portfolio.models import UserConfig, WhaleAdvisory
from portfolio.tasks import generate_whale_advisory_task


@override_settings(WHALE_ADVISORY_COOLDOWN_SECONDS=900)
class WhaleAdvisoryTaskTests(TestCase):
    def _create_user_config(self, username: str, provider: str = 'openai', model: str = 'gpt-4o', api_key: str = ''):
        user = User.objects.create_user(username=username, password='Test@123456', is_staff=True)
        cfg = UserConfig.objects.create(
            user=user,
            ai_provider=provider,
            ai_model=model,
        )
        if api_key:
            cfg.set_ai_api_key(api_key)
            cfg.save(update_fields=['ai_api_key'])
        return user

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_whale_text')
    def test_task_persists_threshold_and_broadcast_metadata(
        self,
        mock_generate_text,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        symbol = 'ZZZT'
        staff_user = self._create_user_config('staff-default', api_key='sk-test-default')
        cache.delete(f'whale_advisory_lock:{symbol}')

        mock_generate_text.side_effect = [
            {
                'text': 'Tom tat AI',
                'prompt_tokens': 10,
                'completion_tokens': 20,
            },
            {
                'text': 'Phan tich sau AI',
                'prompt_tokens': 30,
                'completion_tokens': 40,
            },
        ]
        mock_sender = MagicMock()
        mock_async_to_sync.return_value = mock_sender
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol=symbol,
            matched_value_vnd=8_200_000_000,
            side='BUY',
            threshold=5_000_000_000,
            user_id=staff_user.id,
        )

        advisory = WhaleAdvisory.objects.get(symbol=symbol)
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(advisory.user_id, staff_user.id)
        self.assertEqual(advisory.ai_model, 'gpt-4o')
        self.assertEqual(advisory.threshold, 5_000_000_000)
        self.assertEqual(advisory.ai_summary, 'Tom tat AI')
        self.assertEqual(advisory.ai_detail, 'Phan tich sau AI')

        mock_sender.assert_called_once()
        group_name, event = mock_sender.call_args.args
        self.assertEqual(group_name, f'user_{staff_user.id}_alerts')
        self.assertEqual(event['type'], 'whale_advisory')
        self.assertEqual(event['payload']['threshold'], 5_000_000_000)
        self.assertEqual(event['payload']['matched_value'], 8_200_000_000)
        self.assertIn('ai_provider', event['payload'])
        self.assertIn('ai_model', event['payload'])
        self.assertIn('ts', event['payload'])

    @patch('portfolio.ai_service.generate_whale_text')
    def test_auto_generation_skips_if_existing_advisory(self, mock_generate_text):
        symbol = 'AAA'
        WhaleAdvisory.objects.create(
            symbol=symbol,
            matched_value=1_000_000_000,
            side='BUY',
            threshold=500_000_000,
            ai_summary='existing summary',
            ai_detail='existing detail',
            ai_provider='openclaw',
        )

        result = generate_whale_advisory_task(
            symbol=symbol,
            matched_value_vnd=2_000_000_000,
            side='SELL',
            threshold=500_000_000,
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'existing_advisory')
        self.assertEqual(WhaleAdvisory.objects.filter(symbol=symbol).count(), 1)
        mock_generate_text.assert_not_called()

    @patch('portfolio.ai_service.generate_whale_text')
    def test_force_refresh_generates_new_advisory_even_if_existing(self, mock_generate_text):
        symbol = 'BBB'
        staff_user = self._create_user_config('staff-force-refresh', api_key='sk-test-force')
        WhaleAdvisory.objects.create(
            symbol=symbol,
            matched_value=1_000_000_000,
            side='BUY',
            threshold=500_000_000,
            ai_summary='existing summary',
            ai_detail='existing detail',
            ai_provider='openclaw',
        )
        mock_generate_text.side_effect = [
            {'text': 'new summary', 'prompt_tokens': 11, 'completion_tokens': 22},
            {'text': 'new detail', 'prompt_tokens': 33, 'completion_tokens': 44},
        ]

        result = generate_whale_advisory_task(
            symbol=symbol,
            matched_value_vnd=3_000_000_000,
            side='SELL',
            threshold=500_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        self.assertEqual(result['status'], 'ok')
        self.assertTrue(result['force_refresh'])
        self.assertEqual(WhaleAdvisory.objects.filter(symbol=symbol, user_id=staff_user.id).count(), 1)
        latest = WhaleAdvisory.objects.filter(symbol=symbol, user_id=staff_user.id).order_by('-created_at').first()
        self.assertEqual(latest.ai_summary, 'new summary')

    @patch.dict('os.environ', {'COPILOT_API_KEY': 'ghp_test_env_token'}, clear=False)
    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_whale_text')
    def test_task_uses_env_api_key_when_staff_config_has_no_saved_key(
        self,
        mock_generate_text,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        staff_user = self._create_user_config('staff-copilot', provider='copilot', model='openai/gpt-4.1-mini')
        mock_generate_text.side_effect = [
            {'text': 'summary from env', 'prompt_tokens': 12, 'completion_tokens': 23},
            {'text': 'detail from env', 'prompt_tokens': 34, 'completion_tokens': 45},
        ]
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol='FPT',
            matched_value_vnd=4_000_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['ai_provider'], 'copilot')
        first_call = mock_generate_text.call_args_list[0]
        self.assertEqual(first_call.kwargs['provider'], 'copilot')
        self.assertEqual(first_call.kwargs['model'], 'openai/gpt-4.1-mini')
        self.assertEqual(first_call.kwargs['api_key'], 'ghp_test_env_token')

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    def test_task_generates_provider_aware_placeholder_when_staff_key_missing(
        self,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        staff_user = self._create_user_config('staff-openai', provider='openai', model='gpt-4o')
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol='VNM',
            matched_value_vnd=5_000_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'missing_ai_api_key')
        self.assertFalse(WhaleAdvisory.objects.filter(symbol='VNM').exists())

    def test_task_skips_when_user_has_no_ai_model(self):
        staff_user = self._create_user_config('staff-missing-model', provider='openai', model='')

        result = generate_whale_advisory_task(
            symbol='VCB',
            matched_value_vnd=6_000_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'missing_ai_model')
        self.assertFalse(WhaleAdvisory.objects.filter(symbol='VCB').exists())