"""
Comprehensive Demo Data Seeding Script
Tạo dataset lớn với tất cả các feature của hệ thống để test functionality + load capacity.

Phạm vi dữ liệu:
- 30 mã chứng khoán (VN30 + các bluechip khác)
- 3 người dùng khác nhau (testuser, trader1, investor1)
- 180 ngày lịch sử daily prices (6 tháng)
- 1000+ intraday ticks mỗi mã mỗi ngày
- 500+ whale advisory
- 200+ order flow signal
- 100+ AI advisory components
- Multiple portfolios, watchlists, screener rules
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from random import choice, randint, random, shuffle, uniform
import logging

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from portfolio.models import (
    AccountSnapshot,
    AIAdvisoryComponentRecord,
    DailyPrice,
    IntradayTick,
    OrderFlowSignal,
    Portfolio,
    PriceAlertRule,
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
    WhaleAdvisory,
)

logger = logging.getLogger(__name__)

# VN30 + extended bluechip list
VN30_SYMBOLS = {
    'VNM': {'name': 'CTCP Sữa Việt Nam', 'industry': 'Tiêu dùng', 'sector': 'Consumer'},
    'VCB': {'name': 'Ngân hàng TMCP Ngoại thương Việt Nam', 'industry': 'Ngân hàng', 'sector': 'Banking'},
    'HPG': {'name': 'CTCP Tập đoàn Hòa Phát', 'industry': 'Thép', 'sector': 'Materials'},
    'MWG': {'name': 'CTCP Đầu tư Thế Giới Di Động', 'industry': 'Bán lẻ', 'sector': 'Retail'},
    'FPT': {'name': 'CTCP FPT', 'industry': 'Công nghệ', 'sector': 'Technology'},
    'TCB': {'name': 'Ngân hàng TMCP Kỹ Thương Việt Nam', 'industry': 'Ngân hàng', 'sector': 'Banking'},
    'BID': {'name': 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', 'industry': 'Ngân hàng', 'sector': 'Banking'},
    'VIC': {'name': 'CTCP Tập đoàn Mua bán Nước ngoài Việt Nam', 'industry': 'Đa ngành', 'sector': 'Conglomerate'},
    'GAS': {'name': 'PJSC PetroVietnam Gas', 'industry': 'Năng lượng', 'sector': 'Energy'},
    'SAB': {'name': 'CTCP Bia Sài Gòn', 'industry': 'Tiêu dùng', 'sector': 'Consumer'},
    'BVH': {'name': 'CTCP Bến Thành Holdings', 'industry': 'Bất động sản', 'sector': 'Real Estate'},
    'VJC': {'name': 'CTCP Hàng không Vietjet', 'industry': 'Vận tải', 'sector': 'Airlines'},
    'MSN': {'name': 'CTCP Chứng khoán Mirae Asset', 'industry': 'Chứng khoán', 'sector': 'Securities'},
    'VRE': {'name': 'CTCP Bất động sản Văn Phú - Invest', 'industry': 'Bất động sản', 'sector': 'Real Estate'},
    'HDB': {'name': 'Ngân hàng TMCP Phát triển Nhà Việt Nam', 'industry': 'Ngân hàng', 'sector': 'Banking'},
    'ERN': {'name': 'CTCP Năng lượng Tái tạo Ninh Thuận', 'industry': 'Năng lượng', 'sector': 'Energy'},
    'MBB': {'name': 'Ngân hàng TMCP Quân Đội', 'industry': 'Ngân hàng', 'sector': 'Banking'},
    'VPB': {'name': 'Ngân hàng TMCP Việt Á', 'industry': 'Ngân hàng', 'sector': 'Banking'},
    'CTG': {'name': 'PJSC PetroVietnam', 'industry': 'Năng lượng', 'sector': 'Energy'},
    'POW': {'name': 'CTCP Điện lực Dầu khí Việt Nam', 'industry': 'Năng lượng', 'sector': 'Energy'},
    'KDH': {'name': 'CTCP Kinh Đô Holding', 'industry': 'Thực phẩm', 'sector': 'Consumer'},
    'TYA': {'name': 'CTCP Năng lượng Tái tạo Hùng Nhân', 'industry': 'Năng lượng', 'sector': 'Energy'},
    'PNJ': {'name': 'CTCP PNJ', 'industry': 'Bán lẻ', 'sector': 'Retail'},
    'DIG': {'name': 'CTCP Thăm dò và Khai thác Dầu khí', 'industry': 'Năng lượng', 'sector': 'Energy'},
    'STB': {'name': 'Ngân hàng TMCP Sài Gòn Thương Tín', 'industry': 'Ngân hàng', 'sector': 'Banking'},
    'VNPAY': {'name': 'CTCP Thanh toán Quốc tế Việt Nam', 'industry': 'Công nghệ', 'sector': 'FinTech'},
    'SBT': {'name': 'CTCP Chứng khoán Sacombank', 'industry': 'Chứng khoán', 'sector': 'Securities'},
}

BASE_PRICES = {
    'VNM': 70100,
    'VCB': 88500,
    'HPG': 28500,
    'MWG': 61000,
    'FPT': 116000,
    'TCB': 24500,
    'BID': 35200,
    'VIC': 22300,
    'GAS': 7200,
    'SAB': 62500,
    'BVH': 8350,
    'VJC': 19200,
    'MSN': 23400,
    'VRE': 18900,
    'HDB': 27500,
    'ERN': 6800,
    'MBB': 30100,
    'VPB': 39200,
    'CTG': 20300,
    'POW': 8950,
    'KDH': 25600,
    'TYA': 6200,
    'PNJ': 44200,
    'DIG': 7950,
    'STB': 19800,
    'VNPAY': 71500,
    'SBT': 15200,
}

AI_DESCRIPTIONS = [
    'Dong tien lon quay lai sau khoan tich luy nggan hang, tin hieu mua cu the.',
    'Ap luc ban lo lon xuat hien, can theo doi kha nang bung no theo da.',
    'Lenh lo nhap cuoc tai vung gia tro, co the la dau hieu tang dan suc mua theo da.',
    'Dong tien giao dich chot loi sau can bung no manh, lem chinh sach tang tiep.',
    'Thi truong co nhip xoay tru lay tren vung gia tro, duong dan len phai la tien de theo doi.',
]

ORDER_FLOW_SIGNALS = ['absorption', 'iceberg', 'twap_bot', 'mixed']
SUGGESTED_ACTIONS = ['watch', 'buy', 'sell', 'hold_off']


class Command(BaseCommand):
    help = 'Seed comprehensive demo dataset covering all system features and load capacity.'

    def add_arguments(self, parser):
        parser.add_argument('--users', type=int, default=3, help='Number of demo users to create')
        parser.add_argument('--symbols', type=int, default=28, help='Number of symbols to seed')
        parser.add_argument('--days', type=int, default=180, help='Historical days to generate')
        parser.add_argument('--ticks-per-symbol-per-day', type=int, default=50, help='Intraday ticks per symbol per day')
        parser.add_argument('--advisories', type=int, default=500, help='Number of whale advisories')
        parser.add_argument('--signals', type=int, default=200, help='Number of order flow signals')
        parser.add_argument('--components', type=int, default=100, help='Number of AI advisory components')
        parser.add_argument('--reset', action='store_true', help='Clear existing demo data first')

    def handle(self, *args, **options):
        num_users = options['users']
        num_symbols = options['symbols']
        num_days = options['days']
        ticks_per_symbol = options['ticks_per_symbol_per_day']
        num_advisories = options['advisories']
        num_signals = options['signals']
        num_components = options['components']
        reset = options['reset']

        self.stdout.write('🚀 Starting comprehensive demo data seeding...\n')

        if reset:
            self.stdout.write('🧹 Resetting existing demo data...')
            self._reset_demo_data()
            self.stdout.write(self.style.SUCCESS('✓ Demo data reset complete\n'))

        # Create users
        self.stdout.write('👤 Creating demo users...')
        users = self._create_users(num_users)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(users)} users\n'))

        # Create stock profiles
        self.stdout.write('📊 Creating stock profiles...')
        symbols = list(BASE_PRICES.keys())[:num_symbols]
        stock_profiles = self._create_stock_profiles(symbols)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(stock_profiles)} stock profiles\n'))

        # Create historical daily prices
        self.stdout.write(f'📈 Generating {num_days} days of daily prices...')
        daily_prices_created = self._create_daily_prices(symbols, num_days)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {daily_prices_created} daily price records\n'))

        # Create portfolios and transactions for each user
        self.stdout.write('💼 Creating portfolios and transactions...')
        for user in users:
            self._create_user_portfolios(user)
        self.stdout.write(self.style.SUCCESS('✓ Created portfolios and transactions\n'))

        # Create watchlists and tracked symbols
        self.stdout.write('👀 Creating watchlists and tracked symbols...')
        self._create_watchlists_and_trackers(users, symbols)
        self.stdout.write(self.style.SUCCESS('✓ Created watchlists and trackers\n'))

        # Create intraday ticks
        self.stdout.write(f'⏱️  Generating {ticks_per_symbol * num_symbols * 30} intraday ticks (sample)...')
        ticks_created = self._create_intraday_ticks(symbols, num_days=30, ticks_per_symbol=ticks_per_symbol)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {ticks_created} intraday ticks\n'))

        # Create whale advisories
        self.stdout.write(f'🐋 Generating {num_advisories} whale advisories...')
        advisories_created = self._create_whale_advisories(symbols, count=num_advisories)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {advisories_created} whale advisories\n'))

        # Create order flow signals
        self.stdout.write(f'📊 Generating {num_signals} order flow signals...')
        signals_created = self._create_order_flow_signals(symbols, count=num_signals)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {signals_created} order flow signals\n'))

        # Create AI advisory components
        self.stdout.write(f'🤖 Generating {num_components} AI advisory components...')
        components_created = self._create_ai_advisory_components(users, symbols, count=num_components)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {components_created} AI components\n'))

        # Create price alerts
        self.stdout.write('🚨 Creating price alert rules...')
        alerts_created = self._create_price_alerts(users, symbols)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {alerts_created} price alerts\n'))

        # Create screener rules
        self.stdout.write('🔍 Creating screener rules...')
        screeners_created = self._create_screener_rules(users)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {screeners_created} screener rules\n'))

        self.stdout.write(self.style.SUCCESS('\n✅ Comprehensive demo data seeding completed!\n'))
        self.stdout.write(f'📌 Demo accounts: {", ".join([u.username for u in users])}')
        self.stdout.write(f'📌 Password: DemoPass@123')

    @transaction.atomic
    def _reset_demo_data(self):
        """Delete all demo data to start fresh."""
        AIAdvisoryComponentRecord.objects.filter(user__username__startswith='demo_').delete()
        OrderFlowSignal.objects.all().delete()
        WhaleAdvisory.objects.all().delete()
        IntradayTick.objects.filter(stream_id__contains='seed-').delete()
        AccountSnapshot.objects.filter(sub_account__portfolio__user__username__startswith='demo_').delete()
        PriceAlertRule.objects.filter(user__username__startswith='demo_').delete()
        ScreenerRule.objects.filter(user__username__startswith='demo_').delete()
        TrackedSymbol.objects.filter(user__username__startswith='demo_').delete()
        WatchlistItem.objects.filter(group__user__username__startswith='demo_').delete()
        WatchlistGroup.objects.filter(user__username__startswith='demo_').delete()
        Transaction.objects.filter(sub_account__portfolio__user__username__startswith='demo_').delete()
        SubAccount.objects.filter(portfolio__user__username__startswith='demo_').delete()
        Portfolio.objects.filter(user__username__startswith='demo_').delete()
        User.objects.filter(username__startswith='demo_').delete()

    @transaction.atomic
    def _create_users(self, count):
        """Create demo users with config."""
        users = []
        for i in range(count):
            username = f'demo_user{i+1}' if i > 0 else 'testuser'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@vninvest.vn',
                    'is_staff': False,
                    'is_superuser': False,
                    'first_name': f'Demo User {i+1}',
                },
            )
            user.set_password('DemoPass@123')
            user.save()

            UserConfig.objects.update_or_create(
                user=user,
                defaults={
                    'whale_alert_threshold': Decimal(randint(500, 1500)),
                    'theme': choice(['dark', 'light']),
                    'plan': choice(['pro', 'premium']),
                    'plan_expires_at': timezone.now() + timedelta(days=365),
                    'email_verified': True,
                    'email_verified_at': timezone.now(),
                    'ai_provider': 'openclaw',
                },
            )
            users.append(user)
        return users

    def _create_stock_profiles(self, symbols):
        """Create stock profile records."""
        profiles = []
        for symbol in symbols:
            info = VN30_SYMBOLS.get(symbol, {
                'name': f'CTCP {symbol}',
                'industry': 'Công nghệ',
                'sector': 'Technology',
            })
            profile, _ = StockProfile.objects.update_or_create(
                symbol=symbol,
                defaults={
                    'company_name': info['name'],
                    'industry': info['industry'],
                    'exchange': 'HOSE',
                    'is_active': True,
                    'listed_date': date(2010, 1, 1),
                },
            )
            profiles.append(profile)
        return profiles

    @transaction.atomic
    def _create_daily_prices(self, symbols, num_days):
        """Generate historical daily price data. Prices in THOUSAND_VND canonical."""
        created = 0
        for symbol in symbols:
            # BASE_PRICES are in VND — divide by 1000 for canonical THOUSAND_VND storage
            base_price = Decimal(str(BASE_PRICES.get(symbol, 50000))) / Decimal('1000')
            volatility = uniform(0.5, 2.0)  # Daily volatility %

            for offset in range(num_days):
                price_date = date.today() - timedelta(days=offset)
                daily_change = base_price * (Decimal(str(uniform(-volatility/100, volatility/100))))
                close = base_price + daily_change

                _, created_flag = DailyPrice.objects.update_or_create(
                    symbol=symbol,
                    date=price_date,
                    defaults={
                        'open_price': close - Decimal(str(random() * 0.5)),
                        'high_price': close + Decimal(str(random() * 1)),
                        'low_price': close - Decimal(str(random() * 1)),
                        'close_price': close,
                        'volume': randint(500000, 5000000),
                    },
                )
                if created_flag:
                    created += 1
        return created

    @transaction.atomic
    def _create_user_portfolios(self, user):
        """Create portfolios, sub-accounts, and sample transactions."""
        portfolios = [
            {'name': 'Danh mục Dài hạn', 'description': 'Long-term investment'},
            {'name': 'Danh mục Giao dịch', 'description': 'Short-term trading'},
            {'name': 'Danh mục Margin', 'description': 'Margin trading'},
        ]

        for pf_spec in portfolios:
            portfolio, _ = Portfolio.objects.get_or_create(
                user=user,
                name=pf_spec['name'],
                defaults={'description': pf_spec['description']},
            )

            # Create sub-accounts
            cash_sub, _ = SubAccount.objects.get_or_create(
                portfolio=portfolio,
                name='Tiền mặt',
                defaults={'type': SubAccount.TypeChoices.CASH, 'margin_ratio': Decimal('1.000')},
            )
            special_sub, _ = SubAccount.objects.get_or_create(
                portfolio=portfolio,
                name='Chuyên biệt',
                defaults={'type': SubAccount.TypeChoices.SPECIAL, 'margin_ratio': Decimal('1.000')},
            )
            margin_sub, _ = SubAccount.objects.get_or_create(
                portfolio=portfolio,
                name='Margin',
                defaults={'type': SubAccount.TypeChoices.MARGIN, 'margin_ratio': Decimal('0.500')},
            )

            # Create sample transactions — prices in THOUSAND_VND canonical
            symbols = list(BASE_PRICES.keys())
            shuffle(symbols)
            for i, symbol in enumerate(symbols[:8]):  # 8 random tickers
                # BASE_PRICES are in VND — divide by 1000 for canonical THOUSAND_VND
                base_price = Decimal(str(BASE_PRICES[symbol])) / Decimal('1000')
                
                # Buy transaction
                Transaction.objects.get_or_create(
                    sub_account=choice([cash_sub, special_sub, margin_sub]),
                    symbol=symbol,
                    transaction_type=Transaction.TransactionType.BUY,
                    date=date.today() - timedelta(days=randint(10, 100)),
                    price=base_price + Decimal(str(random())),
                    quantity=Decimal(str(randint(10, 500))),
                    fee=Decimal(str(randint(5, 50))),
                )
                
                # Sell transaction for some
                if i % 2 == 0:
                    Transaction.objects.get_or_create(
                        sub_account=choice([cash_sub, special_sub, margin_sub]),
                        symbol=symbol,
                        transaction_type=Transaction.TransactionType.SELL,
                        date=date.today() - timedelta(days=randint(1, 5)),
                        price=base_price + Decimal(str(random())),
                        quantity=Decimal(str(randint(5, 200))),
                        fee=Decimal(str(randint(5, 50))),
                    )

            # Create snapshots
            subs = [cash_sub, special_sub, margin_sub]
            for sub in subs:
                base_nav = Decimal(str(randint(5000000, 50000000)))
                for offset in range(30):
                    AccountSnapshot.objects.get_or_create(
                        sub_account=sub,
                        date=date.today() - timedelta(days=offset),
                        defaults={
                            'net_equity': base_nav + Decimal(offset * randint(10000, 100000)),
                            'daily_profit': Decimal(str(randint(-500000, 500000))),
                        },
                    )

    def _create_watchlists_and_trackers(self, users, symbols):
        """Create watchlists grouped by type."""
        for user in users:
            # Create watchlist groups
            groups_spec = [
                {'name': 'Theo dõi sát', 'description': 'Short-term momentum'},
                {'name': 'Tích lũy dài hạn', 'description': 'Long-term value'},
                {'name': 'Cảnh báo đặc biệt', 'description': 'Whale alerts'},
            ]

            shuffle_symbols = symbols.copy()
            shuffle(shuffle_symbols)

            for group_spec in groups_spec:
                group, _ = WatchlistGroup.objects.get_or_create(
                    user=user,
                    name=group_spec['name'],
                    defaults={'description': group_spec['description']},
                )

                # Add 5-8 random symbols to each group
                for symbol in shuffle_symbols[:randint(5, 8)]:
                    WatchlistItem.objects.get_or_create(group=group, symbol=symbol)

            # Create tracked symbols
            shuffle(shuffle_symbols)
            for symbol in shuffle_symbols[:randint(8, 12)]:
                TrackedSymbol.objects.get_or_create(user=user, symbol=symbol)

        # Create market group structure for securities
        sectors = set([v['sector'] for v in VN30_SYMBOLS.values()])
        for sector in sectors:
            sector_symbols = [s for s, v in VN30_SYMBOLS.items() if v['sector'] == sector]
            group, _ = SecuritiesGroup.objects.get_or_create(
                name=f'Nhóm {sector}',
                group_type=SecuritiesGroup.GroupType.SECTOR,
                defaults={'description': f'All {sector} stocks'},
            )
            for order, symbol in enumerate(sector_symbols[:15], 1):
                SecuritiesItem.objects.get_or_create(
                    group=group,
                    symbol=symbol,
                    defaults={'order': order},
                )

    @transaction.atomic
    def _create_intraday_ticks(self, symbols, num_days=30, ticks_per_symbol=50):
        """Generate intraday tick data."""
        created = 0
        market_open = time(9, 15)
        market_close = time(14, 30)

        for symbol in symbols:
            base_price_vnd = Decimal(str(BASE_PRICES[symbol]))
            base_price = base_price_vnd / Decimal('1000')

            for day_offset in range(num_days):
                trade_date = date.today() - timedelta(days=day_offset)

                for tick_idx in range(ticks_per_symbol):
                    # Random time between market open and close
                    hour = randint(9, 14)
                    minute = randint(0, 59)
                    second = randint(0, 59)
                    trade_time = time(hour, minute, second)

                    price = base_price + Decimal(str(uniform(-2, 2)))
                    volume = randint(1000, 100000)
                    side = choice(['BUY', 'SELL', 'UNKNOWN'])

                    tick, created_flag = IntradayTick.objects.update_or_create(
                        stream_id=f'seed-comp-{symbol.lower()}-{day_offset}-{tick_idx}',
                        defaults={
                            'symbol': symbol,
                            'trade_date': trade_date,
                            'trade_time': trade_time,
                            'price': price,
                            'volume': volume,
                            'side': side,
                            'match_type': choice(['LO', 'ATO', 'MP']),
                        },
                    )
                    if created_flag:
                        created += 1

                    # Set realistic created_at
                    IntradayTick.objects.filter(pk=tick.pk).update(
                        created_at=timezone.make_aware(datetime.combine(trade_date, trade_time))
                    )
        return created

    @transaction.atomic
    def _create_whale_advisories(self, symbols, count):
        """Generate whale advisories with realistic distribution."""
        created = 0
        shuffle_symbols = symbols.copy()
        shuffle(shuffle_symbols)

        for i in range(count):
            symbol = shuffle_symbols[i % len(shuffle_symbols)]
            side = choice(['BUY', 'SELL'])
            matched_value = randint(500_000_000, 5_000_000_000)

            advisory = WhaleAdvisory.objects.create(
                symbol=symbol,
                matched_value=matched_value,
                side=side,
                threshold=750_000_000,
                ai_summary=f'{choice(AI_DESCRIPTIONS)} - {symbol} {side}',
                ai_detail=f'Chi tiết phân tích cho {symbol}: Đây là bản ghi advisory #{i+1} dùng để test khả năng hiển thị feed, pagination, filtering bởi status và symbol. Với quy mô dữ liệu lớn, hệ thống cần xử lý nhanh chóng khi user scroll hay tìm kiếm. Timestamp: {timezone.now()}',
                ai_provider='openclaw',
                prompt_tokens=randint(250, 350),
                completion_tokens=randint(100, 200),
            )
            # Backdated to spread over several days
            days_ago = (i // 20) % 7
            WhaleAdvisory.objects.filter(pk=advisory.pk).update(
                created_at=timezone.now() - timedelta(days=days_ago)
            )
            created += 1

        return created

    @transaction.atomic
    def _create_order_flow_signals(self, symbols, count):
        """Generate order flow signal data."""
        created = 0
        shuffle_symbols = symbols.copy()
        shuffle(shuffle_symbols)

        for i in range(count):
            symbol = shuffle_symbols[i % len(shuffle_symbols)]
            signal_type = choice(ORDER_FLOW_SIGNALS)
            strength = uniform(25, 95)

            signal = OrderFlowSignal.objects.create(
                symbol=symbol,
                signal_type=signal_type,
                strength=strength,
                confidence=choice(['low', 'medium', 'high']),
                tick_rate=uniform(5, 50),
                small_order_ratio=uniform(0.1, 0.9),
                cvd_at_signal=uniform(-100000, 100000),
                price_at_signal=uniform(20000, 200000),
                window_seconds=choice([300, 900, 1800, 3600]),
                components_json={
                    'absorption_strength': uniform(0, 100),
                    'iceberg_score': uniform(0, 100),
                    'twap_likelihood': uniform(0, 100),
                    'detected_at': timezone.now().isoformat(),
                },
            )
            # Backdated
            days_ago = (i // 30) % 5
            OrderFlowSignal.objects.filter(pk=signal.pk).update(
                created_at=timezone.now() - timedelta(days=days_ago, hours=randint(0, 23))
            )
            created += 1

        return created

    @transaction.atomic
    def _create_ai_advisory_components(self, users, symbols, count):
        """Generate AI advisory component records."""
        created = 0
        symbol_list = list(symbols)
        shuffle(symbol_list)

        for i in range(count):
            user = choice(users)
            symbol = symbol_list[i % len(symbol_list)]
            component_type = choice([
                AIAdvisoryComponentRecord.ComponentType.PRICE_ACTION,
                AIAdvisoryComponentRecord.ComponentType.INDICATOR,
                AIAdvisoryComponentRecord.ComponentType.VOLUME_ORDERFLOW,
                AIAdvisoryComponentRecord.ComponentType.SENTIMENT,
            ])
            status = choice([
                AIAdvisoryComponentRecord.StatusChoice.OVERBOUGHT,
                AIAdvisoryComponentRecord.StatusChoice.OVERSOLD,
                AIAdvisoryComponentRecord.StatusChoice.ACCUMULATION,
                AIAdvisoryComponentRecord.StatusChoice.BREAKOUT,
                AIAdvisoryComponentRecord.StatusChoice.NEUTRAL,
            ])

            indicator_names = {
                AIAdvisoryComponentRecord.ComponentType.PRICE_ACTION: ['Support/Resistance', 'Trendline', 'Channel'],
                AIAdvisoryComponentRecord.ComponentType.INDICATOR: ['RSI', 'MACD', 'Stochastic', 'Bollinger Bands'],
                AIAdvisoryComponentRecord.ComponentType.VOLUME_ORDERFLOW: ['Volume Profile', 'CVD', 'Order Flow Delta'],
                AIAdvisoryComponentRecord.ComponentType.SENTIMENT: ['Market Sentiment', 'Whale Activity', 'Retail Bias'],
            }

            indicator_name = choice(indicator_names[component_type])

            component = AIAdvisoryComponentRecord.objects.create(
                user=user,
                symbol=symbol,
                component_type=component_type,
                indicator_name=indicator_name,
                status=status,
                confidence_score=randint(3, 10),
                suggested_action=choice(SUGGESTED_ACTIONS),
                rationale_text=f'{indicator_name} trên {symbol} hiện đang {status.label} với mức tín cậy {randint(50, 95)}%. Khuyến nghị: {choice(SUGGESTED_ACTIONS).upper()}',
                timeframe=choice([
                    AIAdvisoryComponentRecord.TimeframeChoice.M5,
                    AIAdvisoryComponentRecord.TimeframeChoice.M15,
                    AIAdvisoryComponentRecord.TimeframeChoice.M30,
                    AIAdvisoryComponentRecord.TimeframeChoice.H1,
                    AIAdvisoryComponentRecord.TimeframeChoice.D1,
                ]),
                include_in_summary=choice([True, True, True, False]),  # 75% included
            )
            created += 1

        return created

    @transaction.atomic
    def _create_price_alerts(self, users, symbols):
        """Create price alert rules."""
        created = 0
        for user in users:
            shuffle_symbols = symbols.copy()
            shuffle(shuffle_symbols)

            for symbol in shuffle_symbols[:randint(5, 10)]:
                base_price = Decimal(str(BASE_PRICES[symbol]))
                for condition in [PriceAlertRule.Condition.ABOVE, PriceAlertRule.Condition.BELOW]:
                    target = base_price + Decimal(str(random() * 2000)) if condition == PriceAlertRule.Condition.ABOVE else base_price - Decimal(str(random() * 2000))

                    _, created_flag = PriceAlertRule.objects.update_or_create(
                        user=user,
                        symbol=symbol,
                        condition=condition,
                        target_price=target,
                        defaults={
                            'cooldown_seconds': randint(300, 3600),
                            'is_active': choice([True, True, True, False]),
                        },
                    )
                    if created_flag:
                        created += 1

        return created

    @transaction.atomic
    def _create_screener_rules(self, users):
        """Create screener rule definitions."""
        created = 0
        screener_templates = [
            {
                'name': 'Bluechip tăng thanh khoản',
                'rules': [
                    {'field': 'rsi_14', 'op': 'lt', 'value': 50},
                    {'field': 'momentum_20d_pct', 'op': 'gte', 'value': 1.5},
                ],
            },
            {
                'name': 'Ngân hàng giữ nền',
                'rules': [
                    {'field': 'price_vs_sma20_pct', 'op': 'gte', 'value': -5},
                    {'field': 'price_vs_sma50_pct', 'op': 'gte', 'value': 0},
                ],
            },
            {
                'name': 'Momentum breakout',
                'rules': [
                    {'field': 'vol_ratio', 'op': 'gte', 'value': 1.5},
                    {'field': 'price_change_3d', 'op': 'gte', 'value': 2},
                ],
            },
            {
                'name': 'Asymptotic recovery',
                'rules': [
                    {'field': 'dist_52w_low', 'op': 'gte', 'value': 10},
                    {'field': 'rsi_14', 'op': 'gte', 'value': 30},
                ],
            },
        ]

        for user in users:
            for template in screener_templates:
                _, created_flag = ScreenerRule.objects.update_or_create(
                    user=user,
                    name=template['name'],
                    defaults={
                        'rules_json': template['rules'],
                        'is_active': choice([True, True, False]),
                    },
                )
                if created_flag:
                    created += 1

        return created
