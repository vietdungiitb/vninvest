from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from portfolio import openclaw_client


class OpenClawClientTests(SimpleTestCase):
    @override_settings(OPENCLAW_API_KEY='')
    def test_generate_summary_returns_placeholder_without_httpx_import(self):
        real_import = __import__

        def fake_import(name, *args, **kwargs):
            if name == 'httpx':
                raise AssertionError('httpx should not be imported when API key is missing')
            return real_import(name, *args, **kwargs)

        with patch('builtins.__import__', side_effect=fake_import):
            result = openclaw_client.generate_whale_summary('FPT', 2_500_000_000, 'BUY')

        self.assertEqual(result['prompt_tokens'], 0)
        self.assertEqual(result['completion_tokens'], 0)
        self.assertIn('OPENCLAW_API_KEY', result['text'])

    @override_settings(OPENCLAW_API_KEY='demo-key')
    def test_call_raises_clear_error_when_httpx_missing(self):
        real_import = __import__

        def fake_import(name, *args, **kwargs):
            if name == 'httpx':
                raise ImportError('No module named httpx')
            return real_import(name, *args, **kwargs)

        with patch('builtins.__import__', side_effect=fake_import):
            with self.assertRaises(RuntimeError) as ctx:
                openclaw_client._call('test prompt', max_tokens=32)

        self.assertIn('httpx', str(ctx.exception))
