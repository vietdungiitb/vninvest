from django.test import SimpleTestCase
from unittest.mock import patch

from portfolio.ai_service import generate_whale_text


class AIServicePromptTests(SimpleTestCase):
    @patch('portfolio.ai_service._openai_compatible_completion')
    @patch('portfolio.ai_service.render_context_for_prompt', return_value='\n[DATA CONTEXT]\nmock')
    @patch('portfolio.ai_service.build_symbol_ai_context')
    def test_generate_whale_text_unknown_side_uses_neutral_intro(
        self,
        mock_build_context,
        _mock_render_context,
        mock_completion,
    ):
        captured = {}

        def _fake_completion(**kwargs):
            captured['prompt'] = kwargs.get('prompt', '')
            return {'text': 'ok', 'prompt_tokens': 10, 'completion_tokens': 20}

        mock_completion.side_effect = _fake_completion
        mock_build_context.return_value = {
            'order_flow': {
                'latest_signal_type': 'none',
                'latest_strength': 0,
            },
            'order_stats': {
                'session': {'buy': {'count': 0, 'total_value': 0, 'max_value': 0}, 'sell': {'count': 0, 'total_value': 0, 'max_value': 0}},
                'five_day': {'buy': {'count': 0, 'total_value': 0, 'max_value': 0}, 'sell': {'count': 0, 'total_value': 0, 'max_value': 0}},
            },
        }

        result = generate_whale_text(
            provider='openai',
            model='gpt-4o',
            api_key='test-key',
            symbol='DGW',
            matched_value_vnd=500_000_000,
            side='UNKNOWN',
            deep=False,
        )

        self.assertEqual(result['text'], 'ok')
        self.assertIn('Hiện chưa ghi nhận lệnh mua/bán lớn đủ rõ', captured['prompt'])
        self.assertNotIn('Lệnh UNKNOWN', captured['prompt'])

    @patch('portfolio.ai_service._openai_compatible_completion')
    @patch('portfolio.ai_service.render_context_for_prompt', return_value='\n[DATA CONTEXT]\nmock')
    @patch('portfolio.ai_service.build_symbol_ai_context')
    def test_generate_whale_text_buy_side_keeps_order_intro(
        self,
        mock_build_context,
        _mock_render_context,
        mock_completion,
    ):
        captured = {}

        def _fake_completion(**kwargs):
            captured['prompt'] = kwargs.get('prompt', '')
            return {'text': 'ok', 'prompt_tokens': 10, 'completion_tokens': 20}

        mock_completion.side_effect = _fake_completion
        mock_build_context.return_value = {
            'market': {
                'latest_close': 123450,
                'change_1d_pct': 1.24,
                'change_5d_pct': 3.56,
            },
            'intraday': {
                'buy_value_today': 4_000_000_000,
                'sell_value_today': 2_700_000_000,
            },
            'order_flow': {
                'latest_signal_type': 'iceberg',
                'latest_strength': 72,
                'latest_confidence': 'high',
            },
            'order_stats': {
                'session': {
                    'buy': {'count': 4, 'total_value': 3_200_000_000, 'max_value': 1_400_000_000},
                    'sell': {'count': 2, 'total_value': 900_000_000, 'max_value': 500_000_000},
                },
                'five_day': {
                    'buy': {'count': 19, 'total_value': 12_600_000_000, 'max_value': 2_000_000_000},
                    'sell': {'count': 15, 'total_value': 9_800_000_000, 'max_value': 1_600_000_000},
                },
            },
        }

        generate_whale_text(
            provider='openai',
            model='gpt-4o',
            api_key='test-key',
            symbol='FPT',
            matched_value_vnd=2_000_000_000,
            side='BUY',
            deep=False,
        )

        self.assertIn('Lệnh BUY, giá trị khoảng 2.0 tỷ VNĐ.', captured['prompt'])
        self.assertIn('Thống kê BUY trong phiên: 4 lệnh, tổng 3,200,000,000 VND, lớn nhất 1,400,000,000 VND.', captured['prompt'])
        self.assertIn('Thống kê BUY 5 phiên gần nhất: 19 lệnh, tổng 12,600,000,000 VND, lớn nhất 2,000,000,000 VND.', captured['prompt'])
        self.assertIn('Giá hiện tại khoảng 123,450.00 VND; biến động 1D 1.24% và 5D 3.56%.', captured['prompt'])
        self.assertIn('Dark money/order-flow gần nhất: ICEBERG (strength 72.0, confidence high).', captured['prompt'])
        self.assertIn('Dòng tiền intraday: buy 4,000,000,000 VND, sell 2,700,000,000 VND, net 1,300,000,000 VND.', captured['prompt'])
