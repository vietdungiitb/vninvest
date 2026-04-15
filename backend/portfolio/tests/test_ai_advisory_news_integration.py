"""
Test suite for AI Advisory News Integration (Sprint 35)

Tests the integration of AI-generated news summary into the executive synthesis prompt.
Ensures news context is properly fetched from cache and injected into LLM prompts.
"""

from django.test import TestCase, RequestFactory
from django.contrib.auth.models import User
from rest_framework.test import force_authenticate
from unittest.mock import patch, MagicMock
import json

from portfolio.models import (
    WhaleAdvisory,
    AIAdvisoryComponentRecord,
    AIAdvisoryExecutiveSummary,
)
from portfolio.ai_advisory_helpers import (
    _fetch_news_context_for_advisory,
    _sprint17_generate_executive_synthesis_with_ai,
    _sprint17_compute_summary_from_components,
)


class TestFetchNewsContextForAdvisory(TestCase):
    """Test _fetch_news_context_for_advisory() helper function"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='test123')
        self.symbol = 'MWG'

    @patch('portfolio.adapters.cache_adapter.get_cache')
    def test_fetch_news_context_success(self, mock_get_cache):
        """Test successful news context fetch from cache"""
        # Mock cache with news summary
        mock_get_cache.return_value = {
            'summary': 'MWG dang phat trien chuoi ban le, loi nhuan Q1 tang 15% so voi cung ky',
            'full': 'Detailed analysis here...',
            'item_count': 5,
            'ai_provider': 'copilot',
            'ai_model': 'gpt-4o-mini',
            'generated_at': '2026-04-14T10:00:00',
            'news_fetched_at': '2026-04-14T09:30:00',
            'cached': False,
        }

        result = _fetch_news_context_for_advisory(self.symbol, self.user)

        # Assert result contains formatted news block
        self.assertIn('Tin tuc gan day ve MWG', result)
        self.assertIn('MWG dang phat trien chuoi ban le', result)
        self.assertIn('(Tong hop tu 5 tin tuc gan day)', result)
        mock_get_cache.assert_called_once_with(f'stock:news:ai-summary:{self.symbol}')

    @patch('portfolio.adapters.cache_adapter.get_cache')
    def test_fetch_news_context_cache_miss(self, mock_get_cache):
        """Test graceful degradation when news cache miss"""
        mock_get_cache.return_value = None

        result = _fetch_news_context_for_advisory(self.symbol, self.user)

        # Assert returns empty string (graceful degradation)
        self.assertEqual(result, '')
        mock_get_cache.assert_called_once()

    @patch('portfolio.adapters.cache_adapter.get_cache')
    def test_fetch_news_context_empty_news(self, mock_get_cache):
        """Test graceful degradation when news summary is empty"""
        mock_get_cache.return_value = {
            'summary': '',
            'item_count': 0,
        }

        result = _fetch_news_context_for_advisory(self.symbol, self.user)

        # Assert returns empty string
        self.assertEqual(result, '')

    def test_fetch_news_context_invalid_symbol(self):
        """Test with invalid (empty) symbol"""
        result = _fetch_news_context_for_advisory('', self.user)
        self.assertEqual(result, '')

    @patch('portfolio.adapters.cache_adapter.get_cache')
    def test_fetch_news_context_exception_handling(self, mock_get_cache):
        """Test exception handling during news fetch"""
        # Mock cache to raise exception
        mock_get_cache.side_effect = Exception('Cache connection error')

        result = _fetch_news_context_for_advisory(self.symbol, self.user)

        # Assert graceful fallback to empty string
        self.assertEqual(result, '')

    @patch('portfolio.adapters.cache_adapter.get_cache')
    def test_fetch_news_context_formatting(self, mock_get_cache):
        """Test news context formatting is correct"""
        mock_get_cache.return_value = {
            'summary': 'Tin tuc ve gia ca tang, khoi luong giao dich cao',
            'item_count': 3,
        }

        result = _fetch_news_context_for_advisory('VCB', self.user)

        # Assert format is correct
        expected_lines = [
            'Tin tuc gan day ve VCB:',
            '- Tin tuc ve gia ca tang, khoi luong giao dich cao',
            '(Tong hop tu 3 tin tuc gan day)',
        ]
        for line in expected_lines:
            self.assertIn(line, result)


class TestGenerateExecutiveSynthesisWithNews(TestCase):
    """Test _sprint17_generate_executive_synthesis_with_ai() with news context"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='test123')
        self.symbol = 'MWG'

        # Create mock advisory and components
        self.advisory = WhaleAdvisory.objects.create(
            user=self.user,
            symbol=self.symbol,
            side='BUY',
            matched_value=500000000,
        )

        # Create mock components
        self.component1 = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol=self.symbol,
            indicator_name='RSI(14)',
            component_type='indicator',
            status='BULLISH',
            confidence_score=8,
            suggested_action='BUY',
            rationale_text='RSI < 30 indicates oversold condition with recovery setup',
            include_in_summary=True,
        )

        self.component2 = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol=self.symbol,
            indicator_name='Volume Profile',
            component_type='volume_orderflow',
            status='STRONG',
            confidence_score=7,
            suggested_action='HOLD',
            rationale_text='High volume at key support level confirms buying interest',
            include_in_summary=True,
        )

    def _get_mock_config(self):
        """Helper to get mock AI runtime config"""
        return {
            'ready': True,
            'provider': 'openclaw',
            'model': 'openclaw',
            'api_key': 'test-key',
        }

    @patch('portfolio.ai_advisory_helpers.resolve_ai_runtime_config')
    @patch('portfolio.ai_advisory_helpers._openclaw_call')
    def test_generate_synthesis_with_news_context(self, mock_openclaw, mock_config):
        """Test synthesis generation with news context included"""
        mock_config.return_value = self._get_mock_config()
        
        # Mock LLM response
        mock_openclaw.return_value = {
            'text': (
                '- Tin tuc gan day cho thay MWG dang mo rong chuoi ban le, tao tin ton mua them.\n'
                '- RSI va Volume deu cho tin hieu tich cuc, phoi hop voi khoi luong mua lon.\n'
                '- Gia dang gan vung ho tro manh, con duong len hien ra ro rang.\n'
                '- Neu doc quanh khang cu 35k se tao diem vao moi khong chi chi.\n'
            )
        }

        summary_payload = _sprint17_compute_summary_from_components([self.component1, self.component2])
        
        news_context = (
            'Tin tuc gan day ve MWG:\n'
            '- MWG dang phat trien chuoi ban le moi\n'
            '(Tong hop tu 4 tin tuc gan day)'
        )

        result = _sprint17_generate_executive_synthesis_with_ai(
            user=self.user,
            symbol=self.symbol,
            components=[self.component1, self.component2],
            summary_payload=summary_payload,
            synthesis_preference='balanced',
            news_context=news_context,  # NEW: Include news
        )

        # Assert result mentions news-related topics
        self.assertIsNotNone(result)
        self.assertIn('- Tin tuc gan day', result)
        self.assertIn('- RSI va Volume', result)

    @patch('portfolio.ai_advisory_helpers.resolve_ai_runtime_config')
    @patch('portfolio.ai_advisory_helpers._openclaw_call')
    def test_generate_synthesis_without_news_context(self, mock_openclaw, mock_config):
        """Test synthesis generation without news context (fallback)"""
        mock_config.return_value = self._get_mock_config()
        
        mock_openclaw.return_value = {
            'text': (
                '- RSI va Volume deu cho tin hieu tich cuc.\n'
                '- Gia dang gan vung ho tro manh, con duong len hien ra ro rang.\n'
                '- Neu doc quanh khang cu 35k se tao diem vao moi khong chi chi.\n'
            )
        }

        summary_payload = _sprint17_compute_summary_from_components([self.component1, self.component2])
        
        # Call WITHOUT news context (empty string)
        result = _sprint17_generate_executive_synthesis_with_ai(
            user=self.user,
            symbol=self.symbol,
            components=[self.component1, self.component2],
            summary_payload=summary_payload,
            synthesis_preference='balanced',
            news_context='',  # Empty = no news
        )

        # Assert result is still generated
        self.assertIsNotNone(result)
        self.assertIn('- RSI va Volume', result)

    @patch('portfolio.ai_advisory_helpers.resolve_ai_runtime_config')
    @patch('portfolio.ai_advisory_helpers._openclaw_call')
    def test_news_context_injected_into_prompt(self, mock_openclaw, mock_config):
        """Test that news context is actually injected into LLM prompt"""
        mock_config.return_value = self._get_mock_config()
        mock_openclaw.return_value = {'text': '- Test response.\n'}

        summary_payload = _sprint17_compute_summary_from_components([self.component1])
        news_context = 'Tin tuc gan day ve MWG: Test news summary'

        _sprint17_generate_executive_synthesis_with_ai(
            user=self.user,
            symbol=self.symbol,
            components=[self.component1],
            summary_payload=summary_payload,
            synthesis_preference='balanced',
            news_context=news_context,
        )

        # Assert the prompt passed to LLM includes news context
        prompt_arg = mock_openclaw.call_args[0][0]
        self.assertIn('Thong tin tin tuc:', prompt_arg)
        self.assertIn('Test news summary', prompt_arg)
        self.assertIn('CAC TUAN NHAN TIN TUC', prompt_arg)  # Instruction updated

    @patch('portfolio.ai_advisory_helpers.resolve_ai_runtime_config')
    @patch('portfolio.ai_advisory_helpers._openclaw_call')
    def test_prompt_includes_news_instruction(self, mock_openclaw, mock_config):
        """Test that prompt includes news consideration in instructions"""
        mock_config.return_value = self._get_mock_config()
        mock_openclaw.return_value = {'text': '- Test.\n'}

        summary_payload = _sprint17_compute_summary_from_components([self.component1])

        _sprint17_generate_executive_synthesis_with_ai(
            user=self.user,
            symbol=self.symbol,
            components=[self.component1],
            summary_payload=summary_payload,
            synthesis_preference='balanced',
            news_context='Sample news',
        )

        prompt_arg = mock_openclaw.call_args[0][0]
        
        # Assert prompt instructs AI to consider news
        self.assertIn('CAC TUAN NHAN TIN TUC', prompt_arg)
        self.assertIn('18-20 dong', prompt_arg)  # Updated target (was 20-22)


class TestIntegrationNewsIntoSynthesis(TestCase):
    """Integration tests for end-to-end news synthesis"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='test123')
        self.factory = RequestFactory()

    @patch('portfolio.ai_advisory_helpers._fetch_news_context_for_advisory')
    @patch('portfolio.ai_advisory_helpers.resolve_ai_runtime_config')
    @patch('portfolio.ai_advisory_helpers._openclaw_call')
    def test_full_synthesis_pipeline_with_news(self, mock_openclaw, mock_config, mock_fetch_news):
        """Test full pipeline: components → summary_payload → synthesis with news"""
        mock_config.return_value = {
            'ready': True,
            'provider': 'openclaw',
            'model': 'openclaw',
            'api_key': 'test-key',
        }
        
        # Mock news fetch
        mock_fetch_news.return_value = (
            'Tin tuc gan day ve TEST:\n'
            '- Breaking news about stock movement\n'
            '(Tong hop tu 2 tin tuc gan day)'
        )
        
        # Mock LLM
        mock_openclaw.return_value = {
            'text': (
                '- Tin tuc gan day hien thi tin hieu tich cuc.\n'
                '- Dieu chinh gia phu hop voi khoi luong mua.\n'
            )
        }

        # Create minimal setup
        advisory = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='TEST',
            side='BUY',
            matched_value=1000000,
        )

        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='TEST',
            indicator_name='MACD',
            component_type='indicator',
            status='BULLISH',
            confidence_score=7,
            suggested_action='BUY',
            rationale_text='MACD crossover',
            include_in_summary=True,
        )

        # Run synthesis
        summary_payload = _sprint17_compute_summary_from_components([component])
        news_ctx = mock_fetch_news('TEST', self.user)
        
        result = _sprint17_generate_executive_synthesis_with_ai(
            user=self.user,
            symbol='TEST',
            components=[component],
            summary_payload=summary_payload,
            synthesis_preference='balanced',
            news_context=news_ctx,
        )

        # Verify news was fetched and used
        mock_fetch_news.assert_called_once_with(symbol='TEST', user=self.user, max_headlines=4)
        
        # Verify synthesis includes news mention
        self.assertIn('Tin tuc', result)


class TestEdgeCases(TestCase):
    """Test edge cases and error conditions"""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='test123')

    @patch('portfolio.adapters.cache_adapter.get_cache')
    def test_news_context_with_special_characters(self, mock_get_cache):
        """Test news context with Vietnamese special characters"""
        mock_get_cache.return_value = {
            'summary': 'Cơ hội đầu tư tốt - Tích lũy nhà đầu tư lớn tại vùng hỗ trợ',
            'item_count': 3,
        }

        result = _fetch_news_context_for_advisory('VCB', self.user)
        
        self.assertIn('Cơ hội đầu tư', result)
        self.assertIn('Tích lũy nhà đầu tư', result)

    @patch('portfolio.adapters.cache_adapter.get_cache')
    def test_news_context_with_maximum_headlines(self, mock_get_cache):
        """Test formatting with max headline count"""
        mock_get_cache.return_value = {
            'summary': 'Long news summary text here',
            'item_count': 100,  # Very high count
        }

        result = _fetch_news_context_for_advisory('FPT', self.user)
        
        # Should still format correctly even with high count
        self.assertIn('(Tong hop tu 100 tin tuc gan day)', result)

    @patch('portfolio.ai_advisory_helpers.resolve_ai_runtime_config')
    def test_synthesis_with_ai_not_ready(self, mock_config):
        """Test graceful handling when AI is not configured"""
        mock_config.return_value = {'ready': False}

        result = _sprint17_generate_executive_synthesis_with_ai(
            user=self.user,
            symbol='TEST',
            components=[],
            summary_payload={},
            synthesis_preference='balanced',
            news_context='Some news',
        )

        # Should return None when AI not ready
        self.assertIsNone(result)
