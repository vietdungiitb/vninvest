from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import override_settings

from portfolio.models import Portfolio, SubAccount, UserConfig
from portfolio.starter_portfolio_service import (
    STARTER_PORTFOLIO_TEMPLATES,
    STARTER_SUBACCOUNT_TEMPLATES,
    provision_starter_portfolios_for_user,
    should_provision_starter_portfolios_for_user,
)

User = get_user_model()


class StarterPortfolioServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='starter-seed-user',
            email='starter-seed-user@example.com',
            password='Test@123456',
        )

    def test_provision_creates_default_portfolios_and_subaccounts(self):
        result = provision_starter_portfolios_for_user(self.user)

        self.assertEqual(result.created_portfolios, len(STARTER_PORTFOLIO_TEMPLATES))
        self.assertEqual(
            result.created_subaccounts,
            len(STARTER_PORTFOLIO_TEMPLATES) * len(STARTER_SUBACCOUNT_TEMPLATES),
        )
        self.assertEqual(result.ensured_portfolios, len(STARTER_PORTFOLIO_TEMPLATES))
        self.assertEqual(
            result.ensured_subaccounts,
            len(STARTER_PORTFOLIO_TEMPLATES) * len(STARTER_SUBACCOUNT_TEMPLATES),
        )
        self.assertEqual(result.reason, 'seeded')
        self.assertTrue(result.applied)

        cfg = UserConfig.objects.get(user=self.user)
        self.assertTrue(cfg.starter_portfolios_seeded)
        self.assertIsNotNone(cfg.starter_portfolios_seeded_at)
        self.assertEqual(cfg.starter_portfolios_template_version, 'v1')

        expected_portfolio_names = {item['name'] for item in STARTER_PORTFOLIO_TEMPLATES}
        actual_portfolio_names = set(
            Portfolio.objects.filter(user=self.user).values_list('name', flat=True)
        )
        self.assertSetEqual(actual_portfolio_names, expected_portfolio_names)

        expected_subaccounts = {
            item['name']: {
                'type': item['type'],
                'margin_ratio': item['margin_ratio'],
            }
            for item in STARTER_SUBACCOUNT_TEMPLATES
        }

        for portfolio in Portfolio.objects.filter(user=self.user):
            subaccounts = portfolio.sub_accounts.all()
            self.assertEqual(subaccounts.count(), len(STARTER_SUBACCOUNT_TEMPLATES))

            for subaccount in subaccounts:
                self.assertIn(subaccount.name, expected_subaccounts)
                self.assertEqual(subaccount.type, expected_subaccounts[subaccount.name]['type'])
                self.assertEqual(
                    subaccount.margin_ratio,
                    expected_subaccounts[subaccount.name]['margin_ratio'],
                )

    def test_provision_is_idempotent(self):
        first = provision_starter_portfolios_for_user(self.user)
        second = provision_starter_portfolios_for_user(self.user)

        self.assertEqual(first.created_portfolios, len(STARTER_PORTFOLIO_TEMPLATES))
        self.assertEqual(
            first.created_subaccounts,
            len(STARTER_PORTFOLIO_TEMPLATES) * len(STARTER_SUBACCOUNT_TEMPLATES),
        )
        self.assertEqual(second.created_portfolios, 0)
        self.assertEqual(second.created_subaccounts, 0)
        self.assertEqual(second.reason, 'already_seeded')
        self.assertFalse(second.applied)

        self.assertEqual(Portfolio.objects.filter(user=self.user).count(), len(STARTER_PORTFOLIO_TEMPLATES))
        self.assertEqual(
            SubAccount.objects.filter(portfolio__user=self.user).count(),
            len(STARTER_PORTFOLIO_TEMPLATES) * len(STARTER_SUBACCOUNT_TEMPLATES),
        )

    def test_existing_subaccount_is_not_overwritten(self):
        portfolio = Portfolio.objects.create(
            user=self.user,
            name=STARTER_PORTFOLIO_TEMPLATES[0]['name'],
            description='Custom portfolio description',
        )
        existing = SubAccount.objects.create(
            portfolio=portfolio,
            name='Margin',
            type=SubAccount.TypeChoices.CASH,
            margin_ratio=Decimal('1.000'),
        )

        result = provision_starter_portfolios_for_user(self.user)
        existing.refresh_from_db()

        self.assertEqual(existing.type, SubAccount.TypeChoices.CASH)
        self.assertEqual(existing.margin_ratio, Decimal('1.000'))
        self.assertGreaterEqual(result.created_portfolios, 2)
        self.assertGreaterEqual(result.created_subaccounts, 8)

    @override_settings(STARTER_PORTFOLIOS_ENABLED=True, STARTER_PORTFOLIOS_CANARY_PERCENT=100)
    def test_should_provision_respects_global_enabled_flag_and_canary(self):
        self.assertTrue(should_provision_starter_portfolios_for_user(self.user))

    @override_settings(STARTER_PORTFOLIOS_ENABLED=False, STARTER_PORTFOLIOS_CANARY_PERCENT=100)
    def test_should_provision_disabled_flag_returns_false(self):
        self.assertFalse(should_provision_starter_portfolios_for_user(self.user))

    @override_settings(STARTER_PORTFOLIOS_ENABLED=True, STARTER_PORTFOLIOS_CANARY_PERCENT=0)
    def test_should_provision_zero_canary_returns_false(self):
        self.assertFalse(should_provision_starter_portfolios_for_user(self.user))
