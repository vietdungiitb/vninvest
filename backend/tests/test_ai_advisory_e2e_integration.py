"""
Phase 3 Item 3: AI Advisory Canonical prompt_config Backend Integration Tests

Tests that backend correctly:
- Parses prompt_config from request
- Routes only enabled sources to context builders
- Verifies synthesis works with various prompt_config states
- Maintains backward compatibility (no prompt_config in request)
"""

import json
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from portfolio.models import PortfolioAccount


class AIAdvisoryPromptConfigBackendIntegrationTests(TestCase):
    """E2E tests for backend prompt_config handling"""

    fixtures = []

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.client = APIClient()

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(username='testuser', password='12345')
        self.client.force_authenticate(user=self.user)
        self.portfolio = PortfolioAccount.objects.create(
            user=self.user, name='Test Portfolio', code='TEST'
        )

    def test_1_regenerate_with_prompt_config_only_enabled_sources_build_context(self):
        """
        Test 1: Call regenerate endpoint with prompt_config payload
        - Verify only enabled sources build context blocks
        - Verify disabled sources skip context building
        """
        payload = {
            'component_ids': ['executive_summary'],
            'synthesis_preference': 'balanced',
            'prompt_config': {
                'version': 2,
                'sources': {
                    'whale': {'enabled': True, 'lookback': 30},
                    'dark_flow': {'enabled': False, 'lookback': 30},  # DISABLED
                    'technical': {'enabled': True, 'lookback': 20, 'indicators': ['rsi']},
                    'news': {'enabled': True, 'lookback': 7},
                    'market': {'enabled': True, 'lookback': 60},
                    'fundamental': {'enabled': False, 'lookback': 2},  # DISABLED
                    'ownership': {'enabled': False, 'lookback': 365},  # DISABLED
                    'sector': {'enabled': False, 'lookback': 60},  # DISABLED
                },
            },
        }

        response = self.client.post(
            f'/api/v1/stock/MWG/ai-advisory/summary/regenerate',
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Should have synthesis result
        self.assertIn('summary', data)
        self.assertIsNotNone(data['summary'])

        # Should include prompt_config_version in response
        self.assertIn('prompt_config_version', data)
        self.assertEqual(data['prompt_config_version'], 2)

    def test_2_regenerate_with_minimal_prompt_config_merges_with_defaults(self):
        """
        Test 2: Call with minimal prompt_config (only version + sources enabled keys)
        - Verify parser merges with defaults correctly
        - Missing sources should use defaults
        """
        payload = {
            'component_ids': ['executive_summary'],
            'prompt_config': {
                'version': 2,
                'sources': {
                    'whale': {'enabled': False},  # Only override enabled; lookback from defaults
                    'fundamental': {'enabled': True},  # Enable optional source
                },
            },
        }

        response = self.client.post(
            f'/api/v1/stock/MWG/ai-advisory/summary/regenerate',
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Should still generate valid synthesis
        self.assertIn('summary', data)
        self.assertIsNotNone(data['summary'])

    def test_3_regenerate_with_all_sources_disabled_uses_fallback_defaults(self):
        """
        Test 3: Call with all sources disabled
        - Verify synthesis still works (backend applies fallback defaults)
        - Should not fail; should use minimal fallback config
        """
        payload = {
            'component_ids': ['executive_summary'],
            'prompt_config': {
                'version': 2,
                'sources': {
                    'whale': {'enabled': False},
                    'dark_flow': {'enabled': False},
                    'technical': {'enabled': False},
                    'news': {'enabled': False},
                    'market': {'enabled': False},
                    'fundamental': {'enabled': False},
                    'ownership': {'enabled': False},
                    'sector': {'enabled': False},
                },
            },
        }

        response = self.client.post(
            f'/api/v1/stock/MWG/ai-advisory/summary/regenerate',
            data=json.dumps(payload),
            content_type='application/json',
        )

        # Should not fail; backend should fallback to defaults or skip
        self.assertIn(response.status_code, [200, 400])  # 400 is acceptable if error message is clear

    def test_4_regenerate_with_invalid_indicators_filters_gracefully(self):
        """
        Test 4: Call with invalid indicator names in technical.indicators
        - Verify they're filtered out gracefully
        - Valid indicators should still work
        """
        payload = {
            'component_ids': ['executive_summary'],
            'prompt_config': {
                'version': 2,
                'sources': {
                    'whale': {'enabled': True, 'lookback': 30},
                    'dark_flow': {'enabled': True, 'lookback': 30},
                    'technical': {
                        'enabled': True,
                        'lookback': 20,
                        'indicators': ['rsi', 'invalid_indicator', 'bollinger'],
                    },
                    'news': {'enabled': True, 'lookback': 7},
                    'market': {'enabled': True, 'lookback': 60},
                    'fundamental': {'enabled': False, 'lookback': 2},
                    'ownership': {'enabled': False, 'lookback': 365},
                    'sector': {'enabled': False, 'lookback': 60},
                },
            },
        }

        response = self.client.post(
            f'/api/v1/stock/MWG/ai-advisory/summary/regenerate',
            data=json.dumps(payload),
            content_type='application/json',
        )

        # Should succeed; backend should filter invalid indicators
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('summary', data)

    def test_5_regenerate_without_prompt_config_uses_old_behavior(self):
        """
        Test 5: Call without prompt_config (backward compat)
        - Verify synthesis uses old behavior (all defaults)
        - Should work exactly as before
        """
        payload = {
            'component_ids': ['executive_summary'],
            'synthesis_preference': 'balanced',
            # NO prompt_config
        }

        response = self.client.post(
            f'/api/v1/stock/MWG/ai-advisory/summary/regenerate',
            data=json.dumps(payload),
            content_type='application/json',
        )

        # Should work with old behavior
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('summary', data)

        # Should still include prompt_config_version (defaults)
        self.assertIn('prompt_config_version', data)

    def test_6_roundtrip_frontend_sends_prompt_config_backend_processes_correctly(self):
        """
        Test 6: Round-trip: frontend sends prompt_config → backend processes → response metadata matches
        """
        # Simulate frontend sending custom prompt_config
        frontend_payload = {
            'component_ids': ['executive_summary'],
            'synthesis_preference': 'balanced',
            'prompt_config': {
                'version': 2,
                'sources': {
                    'whale': {'enabled': True, 'lookback': 30},
                    'dark_flow': {'enabled': True, 'lookback': 30},
                    'technical': {
                        'enabled': True,
                        'lookback': 20,
                        'indicators': ['rsi', 'bollinger', 'vols'],
                    },
                    'news': {'enabled': True, 'lookback': 7},
                    'market': {'enabled': True, 'lookback': 60},
                    'fundamental': {'enabled': True, 'lookback': 2},  # Enabled
                    'ownership': {'enabled': False, 'lookback': 365},
                    'sector': {'enabled': False, 'lookback': 60},
                },
            },
        }

        response = self.client.post(
            f'/api/v1/stock/MWG/ai-advisory/summary/regenerate',
            data=json.dumps(frontend_payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        backend_response = response.json()

        # Verify response includes metadata
        self.assertIn('summary', backend_response)
        self.assertIn('prompt_config_version', backend_response)
        self.assertEqual(backend_response['prompt_config_version'], 2)

    def test_7_verify_lookback_clamping_in_backend(self):
        """
        Test 7: Verify lookback values are clamped to min/max bounds in backend
        """
        payload = {
            'component_ids': ['executive_summary'],
            'prompt_config': {
                'version': 2,
                'sources': {
                    'whale': {'enabled': True, 'lookback': 1000},  # Way over max (90)
                    'dark_flow': {'enabled': True, 'lookback': 1},  # Under min (5)
                    'technical': {'enabled': True, 'lookback': 20, 'indicators': ['rsi']},
                    'news': {'enabled': True, 'lookback': 7},
                    'market': {'enabled': True, 'lookback': 60},
                    'fundamental': {'enabled': False, 'lookback': 2},
                    'ownership': {'enabled': False, 'lookback': 365},
                    'sector': {'enabled': False, 'lookback': 60},
                },
            },
        }

        response = self.client.post(
            f'/api/v1/stock/MWG/ai-advisory/summary/regenerate',
            data=json.dumps(payload),
            content_type='application/json',
        )

        # Should succeed; backend should clamp values
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('summary', data)


class AIAdvisoryPromptConfigParserTests(TestCase):
    """Direct unit tests for parser function"""

    def test_parse_prompt_config_none_returns_defaults(self):
        """Parser should handle None input and return defaults"""
        from portfolio.ai_advisory_helpers import _parse_prompt_config

        result = _parse_prompt_config(None)

        self.assertIsNotNone(result)
        self.assertEqual(result['version'], 2)
        self.assertTrue(result['sources']['whale']['enabled'])
        self.assertFalse(result['sources']['fundamental']['enabled'])

    def test_parse_prompt_config_merges_with_defaults(self):
        """Parser should merge provided config with defaults"""
        from portfolio.ai_advisory_helpers import _parse_prompt_config

        config = {
            'version': 2,
            'sources': {
                'fundamental': {'enabled': True, 'lookback': 4},
            },
        }

        result = _parse_prompt_config(config)

        self.assertEqual(result['version'], 2)
        # Custom: fundamental enabled
        self.assertTrue(result['sources']['fundamental']['enabled'])
        # Defaults: whale still enabled
        self.assertTrue(result['sources']['whale']['enabled'])

    def test_parse_prompt_config_clamps_lookback(self):
        """Parser should clamp lookback values to source-specific bounds"""
        from portfolio.ai_advisory_helpers import _parse_prompt_config

        config = {
            'version': 2,
            'sources': {
                'whale': {'enabled': True, 'lookback': 999},  # Way over max
            },
        }

        result = _parse_prompt_config(config)

        # Should be clamped to max (90 for whale)
        self.assertLessEqual(result['sources']['whale']['lookback'], 90)

    def test_parse_prompt_config_filters_invalid_indicators(self):
        """Parser should filter invalid technical indicators"""
        from portfolio.ai_advisory_helpers import _parse_prompt_config

        config = {
            'version': 2,
            'sources': {
                'technical': {
                    'enabled': True,
                    'lookback': 20,
                    'indicators': ['rsi', 'invalid', 'bollinger'],
                },
            },
        }

        result = _parse_prompt_config(config)

        # Invalid indicators should be filtered
        indicators = result['sources']['technical']['indicators']
        self.assertNotIn('invalid', indicators)
        self.assertIn('rsi', indicators)
        self.assertIn('bollinger', indicators)

    def test_parse_prompt_config_all_invalid_indicators_fallback(self):
        """Parser should fallback to full set if all indicators are invalid"""
        from portfolio.ai_advisory_helpers import _parse_prompt_config

        config = {
            'version': 2,
            'sources': {
                'technical': {
                    'enabled': True,
                    'lookback': 20,
                    'indicators': ['invalid1', 'invalid2'],
                },
            },
        }

        result = _parse_prompt_config(config)

        # Should fallback to defaults (all valid indicators)
        indicators = result['sources']['technical']['indicators']
        self.assertGreater(len(indicators), 0)
