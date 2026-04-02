from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from portfolio.models import (
    AccountSnapshot,
    DailyPrice,
    Portfolio,
    ScreenerRule,
    SecuritiesGroup,
    SecuritiesItem,
    StockProfile,
    SubAccount,
    TrackedSymbol,
    Transaction,
    UserConfig,
    WatchlistGroup,
    WatchlistItem,
)


class Command(BaseCommand):
    help = 'Seed comprehensive demo data for all current visual features.'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='testuser', help='Main demo username.')
        parser.add_argument('--password', default='Test@123456', help='Main demo password.')
        parser.add_argument('--reset', action='store_true', help='Reset existing domain demo data for the user first.')

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        reset = options['reset']

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': f'{username}@vninvest.vn',
                'is_staff': True,
                'is_superuser': True,
            },
        )
        user.set_password(password)
        if created:
            user.is_staff = True
            user.is_superuser = True
        user.save()

        if reset:
            AccountSnapshot.objects.filter(sub_account__portfolio__user=user).delete()
            Transaction.objects.filter(sub_account__portfolio__user=user).delete()
            SubAccount.objects.filter(portfolio__user=user).delete()
            Portfolio.objects.filter(user=user).delete()
            TrackedSymbol.objects.filter(user=user).delete()
            WatchlistItem.objects.filter(group__user=user).delete()
            WatchlistGroup.objects.filter(user=user).delete()
            ScreenerRule.objects.filter(user=user).delete()
            UserConfig.objects.filter(user=user).delete()

        UserConfig.objects.update_or_create(
            user=user,
            defaults={
                'whale_alert_threshold': Decimal('750'),
                'theme': 'dark',
            },
        )

        symbols = {
            'FPT': {'company_name': 'CTCP FPT', 'industry': 'Công nghệ', 'exchange': 'HOSE', 'base': Decimal('116000')},
            'HPG': {'company_name': 'CTCP Tập đoàn Hòa Phát', 'industry': 'Thép', 'exchange': 'HOSE', 'base': Decimal('28500')},
            'VNM': {'company_name': 'CTCP Sữa Việt Nam', 'industry': 'Tiêu dùng', 'exchange': 'HOSE', 'base': Decimal('70100')},
            'VCB': {'company_name': 'Ngân hàng TMCP Ngoại thương Việt Nam', 'industry': 'Ngân hàng', 'exchange': 'HOSE', 'base': Decimal('88500')},
            'MWG': {'company_name': 'CTCP Đầu tư Thế Giới Di Động', 'industry': 'Bán lẻ', 'exchange': 'HOSE', 'base': Decimal('61000')},
        }

        for symbol, info in symbols.items():
            StockProfile.objects.update_or_create(
                symbol=symbol,
                defaults={
                    'company_name': info['company_name'],
                    'industry': info['industry'],
                    'exchange': info['exchange'],
                    'is_active': True,
                },
            )
            for idx in range(40):
                close_price = info['base'] + Decimal((idx % 5) * 150 - 300)
                price_date = date.today() - timedelta(days=idx + 1)
                DailyPrice.objects.update_or_create(
                    symbol=symbol,
                    date=price_date,
                    defaults={
                        'open_price': close_price - Decimal('400'),
                        'high_price': close_price + Decimal('700'),
                        'low_price': close_price - Decimal('950'),
                        'close_price': close_price,
                        'volume': 900000 + idx * 15000,
                    },
                )

        portfolio_long, _ = Portfolio.objects.get_or_create(
            user=user,
            name='Danh mục Dài hạn',
            defaults={'description': 'Danh mục demo cho vị thế dài hạn.'},
        )
        portfolio_trade, _ = Portfolio.objects.get_or_create(
            user=user,
            name='Danh mục Giao dịch',
            defaults={'description': 'Danh mục demo cho vị thế ngắn hạn và margin.'},
        )

        cash_subaccount, _ = SubAccount.objects.get_or_create(
            portfolio=portfolio_long,
            name='Tiền mặt',
            defaults={'type': SubAccount.TypeChoices.CASH, 'margin_ratio': Decimal('1.000')},
        )
        special_subaccount, _ = SubAccount.objects.get_or_create(
            portfolio=portfolio_long,
            name='Chuyên biệt',
            defaults={'type': SubAccount.TypeChoices.SPECIAL, 'margin_ratio': Decimal('1.000')},
        )
        margin_subaccount, _ = SubAccount.objects.get_or_create(
            portfolio=portfolio_trade,
            name='Margin linh hoạt',
            defaults={'type': SubAccount.TypeChoices.MARGIN, 'margin_ratio': Decimal('0.500')},
        )

        transactions = [
            {'sub_account': cash_subaccount, 'symbol': 'FPT', 'transaction_type': Transaction.TransactionType.BUY, 'date': date.today() - timedelta(days=28), 'price': Decimal('108000'), 'quantity': Decimal('50'), 'fee': Decimal('15000')},
            {'sub_account': cash_subaccount, 'symbol': 'VNM', 'transaction_type': Transaction.TransactionType.BUY, 'date': date.today() - timedelta(days=18), 'price': Decimal('67500'), 'quantity': Decimal('30'), 'fee': Decimal('10000')},
            {'sub_account': cash_subaccount, 'symbol': 'VNM', 'transaction_type': Transaction.TransactionType.DIVIDEND, 'date': date.today() - timedelta(days=7), 'price': Decimal('1800'), 'quantity': Decimal('30'), 'fee': Decimal('0')},
            {'sub_account': special_subaccount, 'symbol': 'VCB', 'transaction_type': Transaction.TransactionType.BUY, 'date': date.today() - timedelta(days=20), 'price': Decimal('86000'), 'quantity': Decimal('35'), 'fee': Decimal('12000')},
            {'sub_account': margin_subaccount, 'symbol': 'HPG', 'transaction_type': Transaction.TransactionType.BUY, 'date': date.today() - timedelta(days=23), 'price': Decimal('27000'), 'quantity': Decimal('120'), 'fee': Decimal('12000')},
            {'sub_account': margin_subaccount, 'symbol': 'MWG', 'transaction_type': Transaction.TransactionType.BUY, 'date': date.today() - timedelta(days=15), 'price': Decimal('57500'), 'quantity': Decimal('70'), 'fee': Decimal('12000')},
            {'sub_account': margin_subaccount, 'symbol': 'HPG', 'transaction_type': Transaction.TransactionType.SELL, 'date': date.today() - timedelta(days=4), 'price': Decimal('28200'), 'quantity': Decimal('20'), 'fee': Decimal('10000')},
        ]

        for tx in transactions:
            Transaction.objects.get_or_create(
                sub_account=tx['sub_account'],
                symbol=tx['symbol'],
                transaction_type=tx['transaction_type'],
                date=tx['date'],
                price=tx['price'],
                quantity=tx['quantity'],
                fee=tx['fee'],
                defaults={'notes': 'Demo data'},
            )

        snapshot_specs = [
            (cash_subaccount, Decimal('18800000'), Decimal('120000')),
            (special_subaccount, Decimal('6150000'), Decimal('45000')),
            (margin_subaccount, Decimal('10300000'), Decimal('-25000')),
        ]
        for sub_account, base_nav, base_profit in snapshot_specs:
            for offset in range(12):
                snapshot_date = date.today() - timedelta(days=offset)
                AccountSnapshot.objects.update_or_create(
                    sub_account=sub_account,
                    date=snapshot_date,
                    defaults={
                        'net_equity': base_nav + Decimal(offset * 35000),
                        'daily_profit': base_profit + Decimal(offset * 3000),
                    },
                )

        sector_group, _ = SecuritiesGroup.objects.get_or_create(
            name='Công nghệ dẫn dắt',
            group_type=SecuritiesGroup.GroupType.SECTOR,
            defaults={
                'description': 'Nhóm cổ phiếu công nghệ và bán lẻ để quan sát dòng tiền.',
                'color': '#22c55e',
                'order': 1,
            },
        )
        market_cap_group, _ = SecuritiesGroup.objects.get_or_create(
            name='VN30 theo dõi',
            group_type=SecuritiesGroup.GroupType.MARKET_CAP,
            defaults={
                'description': 'Nhóm vốn hóa lớn để theo dõi thị trường.',
                'color': '#3b82f6',
                'order': 2,
            },
        )
        custom_group, _ = SecuritiesGroup.objects.get_or_create(
            name='Danh mục quan sát cá nhân',
            group_type=SecuritiesGroup.GroupType.CUSTOM,
            defaults={
                'description': 'Nhóm tùy chỉnh để test thêm mã và tracked list.',
                'color': '#f59e0b',
                'order': 3,
            },
        )

        grouped_symbols = {
            sector_group: ['FPT', 'MWG'],
            market_cap_group: ['VCB', 'VNM', 'HPG'],
            custom_group: ['FPT', 'VCB', 'HPG'],
        }
        for group, group_symbols in grouped_symbols.items():
            for order, symbol in enumerate(group_symbols, start=1):
                SecuritiesItem.objects.get_or_create(group=group, symbol=symbol, defaults={'order': order})

        watchlist_momentum, _ = WatchlistGroup.objects.get_or_create(
            user=user,
            name='Theo dõi sát',
            defaults={'description': 'Nhóm mã biến động mạnh trong ngắn hạn.'},
        )
        watchlist_value, _ = WatchlistGroup.objects.get_or_create(
            user=user,
            name='Tích lũy dài hạn',
            defaults={'description': 'Nhóm mã ưu tiên cho nắm giữ trung dài hạn.'},
        )
        for group, watch_symbols in {
            watchlist_momentum: ['FPT', 'HPG', 'MWG'],
            watchlist_value: ['VNM', 'VCB'],
        }.items():
            for symbol in watch_symbols:
                WatchlistItem.objects.get_or_create(group=group, symbol=symbol)

        for symbol, source_group in {
            'FPT': sector_group,
            'HPG': market_cap_group,
            'VCB': market_cap_group,
            'MWG': custom_group,
        }.items():
            TrackedSymbol.objects.get_or_create(user=user, symbol=symbol, defaults={'source_group': source_group})

        ScreenerRule.objects.update_or_create(
            user=user,
            name='Bluechip tăng thanh khoản',
            defaults={
                'rules_json': [
                    {'field': 'rsi_14', 'op': 'lt', 'value': 50},
                    {'field': 'momentum_20d_pct', 'op': 'gte', 'value': 1.5},
                    {'field': 'avg_volume_20', 'op': 'gte', 'value': 500000},
                ],
                'is_active': True,
            },
        )
        ScreenerRule.objects.update_or_create(
            user=user,
            name='Ngân hàng giữ nền',
            defaults={
                'rules_json': [
                    {'field': 'price_vs_sma20_pct', 'op': 'gte', 'value': -5},
                    {'field': 'price_vs_sma50_pct', 'op': 'gte', 'value': 0},
                ],
                'is_active': False,
            },
        )

        self.stdout.write(self.style.SUCCESS(
            f'Seeded comprehensive demo data for {username} / {password}'
        ))