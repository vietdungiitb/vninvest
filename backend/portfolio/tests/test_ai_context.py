from datetime import date, time
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from portfolio.ai_context import build_symbol_ai_context, render_context_for_prompt
from portfolio.models import DailyPrice, IntradayTick, OrderFlowSignal, PriceAlertRule, StockProfile


class AIContextTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='ai-context-user',
            email='ai-context@example.com',
            password='Test@123456',
        )
        StockProfile.objects.create(
            symbol='FPT',
            company_name='FPT Corp',
            industry='Technology',
            exchange='HOSE',
            listed_date=date(2006, 12, 13),
            is_active=True,
        )

        for idx in range(1, 8):
            DailyPrice.objects.create(
                symbol='FPT',
                date=date(2026, 4, idx),
                open_price=Decimal('100000') + idx,
                high_price=Decimal('101000') + idx,
                low_price=Decimal('99000') + idx,
                close_price=Decimal('100500') + idx,
                volume=1_000_000 + idx * 1000,
            )

        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=time(9, 15, 0),
            price=Decimal('101000'),
            volume=12000,
            side='BUY',
            match_type='MATCH',
            stream_id='test-1',
        )

        PriceAlertRule.objects.create(
            user=self.user,
            symbol='FPT',
            condition='ABOVE',
            target_price=Decimal('110000'),
            cooldown_seconds=300,
            is_active=True,
        )

        OrderFlowSignal.objects.create(
            symbol='FPT',
            signal_type='iceberg',
            strength=68.5,
            confidence='high',
            tick_rate=14.2,
            small_order_ratio=0.79,
            cvd_at_signal=1_500_000_000,
            price_at_signal=101000,
            window_seconds=300,
            components_json={'iceberg': {'repeat_count': 9, 'level': 101000}},
        )

    def test_build_context_contains_market_and_intraday(self):
        context = build_symbol_ai_context('FPT')
        self.assertEqual(context['symbol'], 'FPT')
        self.assertIn('market', context)
        self.assertIn('intraday', context)
        self.assertIn('order_flow', context)
        self.assertGreaterEqual(context['market']['daily_points'], 1)
        self.assertEqual(context['order_flow']['latest_signal_type'], 'iceberg')

    def test_render_context_for_prompt_has_expected_sections(self):
        context = build_symbol_ai_context('FPT')
        prompt_context = render_context_for_prompt(context)
        self.assertIn('[DATA CONTEXT]', prompt_context)
        self.assertIn('Symbol: FPT', prompt_context)
        self.assertIn('Active price alerts', prompt_context)
        self.assertIn('Latest order flow', prompt_context)
        self.assertIn('Recent order-flow signals', prompt_context)
