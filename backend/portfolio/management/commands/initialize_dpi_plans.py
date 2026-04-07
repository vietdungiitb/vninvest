"""
Django management command to initialize OpenCore DPI Plans.
Creates the default Free, Pro, and Enterprise tiers.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from portfolio.opencore_dpi import DPIPlan


class Command(BaseCommand):
    help = 'Initialize default DPI Plans (Free, Pro, Enterprise)'

    def handle(self, *args, **options):
        self.stdout.write('Initializing DPI Plans...')
        
        plans_data = [
            {
                'name': 'free',
                'display_name': 'Community',
                'description': 'Miễn phí - Cho cộng đồng nhà đầu tư tự do học hỏi',
                'annual_price_usd': 0,
                'monthly_price_usd': 0,
                'max_watchlist_items': 5,
                'max_portfolio_accounts': 1,
                'max_alerts': 10,
                'max_api_calls_per_month': 5000,
                'features': {
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
            },
            {
                'name': 'pro',
                'display_name': 'Professional',
                'description': 'Chuyên nghiệp - Công cụ nâng cao cho trader chuyên biệt',
                'annual_price_usd': 99,
                'monthly_price_usd': 9.99,
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
                    'predictive_ml': False,
                    'cross_market_alpha': False,
                    'fund_flow_analysis': False,
                    'hedging_strategy': False,
                }
            },
            {
                'name': 'enterprise',
                'display_name': 'Enterprise',
                'description': 'Doanh nghiệp - Giải pháp toàn diện cho quản lý danh mục quy mô lớn',
                'annual_price_usd': 999,
                'monthly_price_usd': 99.99,
                'max_watchlist_items': 500,
                'max_portfolio_accounts': 50,
                'max_alerts': 10000,
                'max_api_calls_per_month': 1000000,
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
                }
            }
        ]
        
        created_count = 0
        updated_count = 0
        
        for plan_data in plans_data:
            plan, created = DPIPlan.objects.update_or_create(
                name=plan_data['name'],
                defaults=plan_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created plan: {plan.display_name}')
                )
            else:
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'↻ Updated plan: {plan.display_name}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Initialization complete: {created_count} created, {updated_count} updated'
            )
        )
