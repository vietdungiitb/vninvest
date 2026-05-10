from unittest.mock import MagicMock, patch
from decimal import Decimal
import base64
import json
import os

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test.utils import override_settings
from django.utils import timezone
import pandas as pd
from portfolio.exceptions import ExternalSystemException
from portfolio import auth_views
from portfolio.models import AdvisoryAggregateAuditLog, AdvisoryAggregateSnapshot, DailyPrice, IntradayTick, OnboardingPlanPolicy, OrderFlowSignal, PlanAssignmentLog, Portfolio, SecuritiesGroup, SecuritiesItem, StockProfile, SubAccount, TrackedSymbol, UserConfig, WatchlistGroup, WatchlistItem, WhaleAdvisory, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, SystemAISettings
from portfolio.starter_portfolio_service import STARTER_PORTFOLIO_TEMPLATES, STARTER_SUBACCOUNT_TEMPLATES
from datetime import date, datetime, timedelta
from rest_framework import status
from rest_framework.test import APITestCase


class ApiRouteSmokeTests(APITestCase):
    def setUp(self):
        cache.delete('admin_ops:holistic_governance_delta_thresholds')
        from portfolio.opencore_dpi import DPIPlan

        DPIPlan.objects.update_or_create(
            name='free',
            defaults={
                'description': 'free test plan',
                'display_name': 'Community',
                'annual_price_usd': 0,
                'monthly_price_usd': 0,
                'max_watchlist_items': 50,
                'max_portfolio_accounts': 5,
                'max_alerts': 100,
                'max_api_calls_per_month': 100000,
                'features': {
                    'sma': True,
                    'rsi': True,
                    'volume_profile': True,
                    'whale_momentum': True,
                    'dark_pool_flow': True,
                    'correlation_matrix': True,
                    'volatility_surface': True,
                    'sentiment_score': True,
                    'predictive_ml': True,
                    'cross_market_alpha': True,
                    'fund_flow_analysis': True,
                    'hedging_strategy': True,
                },
                'is_active': True,
            },
        )
        self.username = 'route-smoke-user'
        self.password = 'Test@123456'
        self.user = User.objects.create_user(
            username=self.username,
            email='route-smoke@example.com',
            password=self.password,
        )
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'email_verified': True},
        )
        user_cfg = UserConfig.objects.get(user=self.user)
        user_cfg.ai_provider = 'openai'
        user_cfg.ai_model = 'gpt-4o'
        user_cfg.set_ai_api_key('sk-route-smoke')
        user_cfg.save(update_fields=['ai_provider', 'ai_model', 'ai_api_key'])

    def authenticate(self):
        response = self.client.post(
            '/api/auth/token/',
            {'username': self.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def authenticate_direct(self):
        self.client.force_authenticate(user=self.user)

    def _attach_dpi_license(self, plan_name, feature_flags=None, status='active', grace_days=7):
        from portfolio.opencore_dpi import DPIPlan, DPILicense

        base_features = {
            'sma': True,
            'rsi': True,
            'volume_profile': True,
            'whale_momentum': False,
            'dark_pool_flow': False,
            'correlation_matrix': False,
            'volatility_surface': False,
            'sentiment_score': False,
            'predictive_ml': False,
            'cross_market_alpha': False,
            'fund_flow_analysis': False,
            'hedging_strategy': False,
        }
        if feature_flags:
            base_features.update(feature_flags)

        defaults_by_plan = {
            'free': {'display_name': 'Community', 'annual_price_usd': 0, 'monthly_price_usd': 0},
            'pro': {'display_name': 'Professional', 'annual_price_usd': 99, 'monthly_price_usd': 9.99},
            'enterprise': {'display_name': 'Enterprise', 'annual_price_usd': 999, 'monthly_price_usd': 99.99},
        }
        plan_defaults = defaults_by_plan.get(plan_name, defaults_by_plan['free'])

        plan, _ = DPIPlan.objects.update_or_create(
            name=plan_name,
            defaults={
                'description': f'{plan_name} test plan',
                'display_name': plan_defaults['display_name'],
                'annual_price_usd': plan_defaults['annual_price_usd'],
                'monthly_price_usd': plan_defaults['monthly_price_usd'],
                'max_watchlist_items': 50,
                'max_portfolio_accounts': 5,
                'max_alerts': 100,
                'max_api_calls_per_month': 100000,
                'features': base_features,
                'is_active': True,
            },
        )

        defaults = {
            'plan': plan,
            'status': status,
            'billing_cycle': 'annual',
            'start_date': timezone.now(),
            'expiry_date': timezone.now() + timedelta(days=30),
            'grace_until': None,
        }
        if status == 'expired':
            defaults['expiry_date'] = timezone.now() - timedelta(days=1)
        if status == 'grace':
            defaults['grace_until'] = timezone.now() + timedelta(days=max(int(grace_days), 1))

        DPILicense.objects.update_or_create(
            user=self.user,
            defaults=defaults,
        )

    def _detach_dpi_license(self):
        from portfolio.opencore_dpi import DPILicense

        DPILicense.objects.filter(user=self.user).delete()

    def _create_stock_workspace_advisory(self, symbol='BCM'):
        return WhaleAdvisory.objects.create(
            user=self.user,
            symbol=symbol,
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

