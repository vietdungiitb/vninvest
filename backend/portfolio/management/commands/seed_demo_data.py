from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from portfolio.market_calendar import previous_trading_day, resolve_market_phase
from portfolio.models import (
    AccountSnapshot,
    DailyPrice,
    IntradayTick,
    Portfolio,
    ScreenerRule,
    SecuritiesGroup,
    SecuritiesItem,
    StockProfile,
    SubAccount,
    SystemAISettings,
    TrackedSymbol,
    Transaction,
    UserConfig,
    WatchlistGroup,
    WatchlistItem,
    WhaleAdvisory,
)


class Command(BaseCommand):
    help = 'Seed comprehensive demo data for all current visual features.'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='testuser', help='Main demo username.')
        parser.add_argument('--password', default='Test@123456', help='Main demo password.')
        parser.add_argument('--reset', action='store_true', help='Reset existing domain demo data for the user first.')

    def _resolve_demo_tick_datetimes(self, count: int) -> list[datetime]:
        phase_meta = resolve_market_phase()
        profile = str(phase_meta.get('profile') or 'offhours').lower()
        local_now = phase_meta.get('local_now') or timezone.localtime()
        tzinfo = local_now.tzinfo or timezone.get_current_timezone()
        session_open = time(9, 0, 0)
        lunch_start = time(11, 30, 0)
        lunch_end = time(13, 0, 0)
        session_close = time(14, 45, 0)

        def _aware_dt(target_date, target_time):
            return timezone.make_aware(datetime.combine(target_date, target_time), tzinfo)

        def _segment_slots(target_date, segments):
            slots = []
            for start_time, end_time in segments:
                start_dt = _aware_dt(target_date, start_time)
                end_dt = _aware_dt(target_date, end_time)
                cursor = start_dt
                while cursor <= end_dt:
                    slots.append(cursor)
                    cursor += timedelta(seconds=2)
            return slots

        if profile == 'pre_open':
            session_date = previous_trading_day(None, local_now.date() - timedelta(days=1))
            segments = [(session_open, lunch_start), (lunch_end, session_close)]
        elif profile in {'post_close', 'offhours'}:
            session_date = previous_trading_day(None, local_now.date())
            segments = [(session_open, lunch_start), (lunch_end, session_close)]
        elif profile == 'lunch_break':
            session_date = local_now.date()
            segments = [(session_open, time(11, 29, 58))]
        else:
            session_date = local_now.date()
            current_cutoff = (local_now - timedelta(seconds=8)).time().replace(microsecond=0)
            if current_cutoff < lunch_end:
                segments = [(session_open, max(current_cutoff, session_open))]
            else:
                segments = [(session_open, time(11, 29, 58)), (lunch_end, max(current_cutoff, lunch_end))]

        slots = _segment_slots(session_date, segments)
        if not slots:
            fallback_date = previous_trading_day(None, local_now.date() - timedelta(days=1))
            slots = _segment_slots(fallback_date, [(session_open, lunch_start), (lunch_end, session_close)])

        if count <= 1:
            return [slots[-1]]

        selected = []
        max_index = len(slots) - 1
        for index in range(count):
            slot_index = round(index * max_index / (count - 1))
            selected.append(slots[slot_index])
        return selected

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
            WhaleAdvisory.objects.filter(ai_provider='seed_demo_data').delete()
            IntradayTick.objects.filter(stream_id__startswith='seed-demo-').delete()

        UserConfig.objects.update_or_create(
            user=user,
            defaults={
                'whale_alert_threshold': Decimal('750'),
                'theme': 'dark',
                'plan': UserConfig.PlanChoices.PREMIUM,
                'plan_expires_at': timezone.now() + timedelta(days=365),
                'email_verified': True,
                'email_verified_at': timezone.now(),
            },
        )

        # Bootstrap System AI settings for local demo so advisory session can run without
        # manual admin setup right after start_dev.
        SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openclaw',
                'ai_model': '',
                'allow_env_fallback': True,
                'notes': 'Auto-created by seed_demo_data for dev smoke flows.',
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

        advisory_specs = [
            {
                'symbol': 'FPT',
                'matched_value': 1_480_000_000,
                'side': 'BUY',
                'threshold': 750_000_000,
                'ai_summary': 'Dong tien lon quay lai FPT trong nhom cong nghe, ben mua chu dong dang chiem uu the o cac nhat gan day.',
                'ai_detail': 'Frontend demo: FPT duoc dua vao advisory feed de testuser thay ro section Tom tat AI va Phan tich sau. Tin hieu nay phu hop voi tracked symbols va watchlist Theo doi sat, giup Whale Alerts Hub hien dong luc uu tien cao.',
                'created_at': timezone.now() - timedelta(minutes=6),
            },
            {
                'symbol': 'HPG',
                'matched_value': 1_120_000_000,
                'side': 'SELL',
                'threshold': 750_000_000,
                'ai_summary': 'Ap luc ban khoi luong lon xuat hien tren HPG sau nhung nhat hoi phuc ngan, can theo doi kha nang phan phoi.',
                'ai_detail': 'Frontend demo: HPG tao mot advisory doi xung voi FPT de giao dien co ca BUY va SELL. Noi dung duoc viet du dai de kiem tra card layout, line wrap va khung Phan tich sau tren trang Whale Advisory.',
                'created_at': timezone.now() - timedelta(minutes=13),
            },
            {
                'symbol': 'VCB',
                'matched_value': 2_060_000_000,
                'side': 'BUY',
                'threshold': 750_000_000,
                'ai_summary': 'Lenh mua lon tren VCB xuat hien gan vung gia tro, co the la dau hieu do dong tien to chuan bi mo rong sang nhom ngan hang.',
                'ai_detail': 'Frontend demo: VCB duoc seed cho user testuser vi day la ma nam trong tracked list va watchlist gia tri. Advisory nay giup Whale Alerts Workspace hien du advisory trong hub cung luc voi aggregate feed.',
                'created_at': timezone.now() - timedelta(minutes=21),
            },
            {
                'symbol': 'MWG',
                'matched_value': 910_000_000,
                'side': 'BUY',
                'threshold': 750_000_000,
                'ai_summary': 'MWG co dong tien bat day o cuoi phien, quy mo chua lon nhu FPT nhung du de dua vao radar uu tien.',
                'ai_detail': 'Frontend demo: MWG bo sung cho watchlist nhom Theo doi sat va giup danh sach advisory khong bi qua don dieu. Card nay duoc dung de test danh sach 4 advisory tro len.',
                'created_at': timezone.now() - timedelta(minutes=29),
            },
            {
                'symbol': 'VNM',
                'matched_value': 5_420_000_000,
                'side': 'BUY',
                'threshold': 750_000_000,
                'ai_summary': 'VNM xuat hien lenh mua quy mo shark, rat phu hop de demo severity cao va scope watchlist gia tri.',
                'ai_detail': 'Frontend demo: VNM duoc seed de khi chuyen Whale Alerts Workspace sang watchlist Tich luy dai han, user nhin thay ngay khac biet so voi scope tracked. Gia tri khop cao hon 5 ty cung giup card hien size class shark tren aggregate feed.',
                'created_at': timezone.now() - timedelta(minutes=37),
            },
            {
                'symbol': 'FPT',
                'matched_value': 820_000_000,
                'side': 'SELL',
                'threshold': 750_000_000,
                'ai_summary': 'FPT co mot nhip xa hang ngan sau khi tang manh, advisory nay dung de test nhieu card cung mot ma voi side khac nhau.',
                'ai_detail': 'Frontend demo: advisory nay bo sung tinh da dang cho feed. Khi user lam moi AI Advisory feed, ho se thay cung mot ma nhung ngu canh giao dich khac nhau, giup test line wrap va thu tu theo created_at.',
                'created_at': timezone.now() - timedelta(minutes=48),
            },
            {
                'symbol': 'MWG',
                'matched_value': 1_680_000_000,
                'side': 'BUY',
                'threshold': 750_000_000,
                'ai_summary': 'MWG buoc vao pha bung no theo da khi dong tien lon quay lai lien tuc o nhung nhip retest ngan.',
                'ai_detail': 'Momentum breakout demo: MWG duoc seed them mot lenh mua lon nua de mo phong kich ban co phieu bung no theo da, lien tuc co ben mua chu dong hap thu cung quanh vung breakout.',
                'created_at': timezone.now() - timedelta(minutes=4),
            },
            {
                'symbol': 'FPT',
                'matched_value': 2_240_000_000,
                'side': 'BUY',
                'threshold': 750_000_000,
                'ai_summary': 'FPT tiep tuc duoc xoay vong dong tien, lenh mua lon xuat hien sau khi co phieu vuot nen tich luy ngan han.',
                'ai_detail': 'Momentum breakout demo: seed them advisory mua cho FPT de trang Whale Alerts co nhieu card cung mot ma nhung o cac thoi diem khac nhau, phu hop voi boi canh bung no theo da.',
                'created_at': timezone.now() - timedelta(minutes=9),
            },
            {
                'symbol': 'HPG',
                'matched_value': 1_360_000_000,
                'side': 'BUY',
                'threshold': 750_000_000,
                'ai_summary': 'HPG co nhip xoay tru mua tro lai sau pha rung lac, gop phan tao nen boi canh momentum mo rong sang nhom chu ky.',
                'ai_detail': 'Momentum breakout demo: advisory nay bo sung kich ban dong tien bung no khong chi tap trung vao mot ma, ma lan sang HPG khi thi truong bat dau giao dich manh hon.',
                'created_at': timezone.now() - timedelta(minutes=16),
            },
            {
                'symbol': 'MWG',
                'matched_value': 1_140_000_000,
                'side': 'SELL',
                'threshold': 750_000_000,
                'ai_summary': 'Xen giua pha tang toc cua MWG van co cac lenh ban lon chot lai, giup giao dien demo duoc ca hai mat cua dong tien momentum.',
                'ai_detail': 'Momentum breakout demo: seed mot lenh ban lon tren MWG de giao dien hien ro su tranh chap trong phien bung no, khong chi co mua mot chieu.',
                'created_at': timezone.now() - timedelta(minutes=24),
            },
            {
                'symbol': 'VNM',
                'matched_value': 1_260_000_000,
                'side': 'SELL',
                'threshold': 750_000_000,
                'ai_summary': 'VNM xuat hien lenh ban lon sau khi da co lenh mua shark truoc do, mo phong kich ban rung lac khi co phieu thu hut su chu y cao.',
                'ai_detail': 'Momentum breakout demo: cap card sell cho VNM giup test advisory feed trong boi canh mot ma co dong tien rat manh nhung van co luc chot loi.',
                'created_at': timezone.now() - timedelta(minutes=33),
            },
            {
                'symbol': 'VCB',
                'matched_value': 1_340_000_000,
                'side': 'SELL',
                'threshold': 750_000_000,
                'ai_summary': 'VCB co lenh ban lon chen vao sau chuoi mua manh, mo phong pha rung lac ky thuat khi dong tien nong lan rong ra bluechip.',
                'ai_detail': 'Momentum breakout demo: them advisory ban tren VCB de feed AI co them mot tinh huong chot loi o nhom ngan hang trong luc thi truong van dang giao dich so dong.',
                'created_at': timezone.now() - timedelta(minutes=19),
            },
        ]
        for spec in advisory_specs:
            advisory, _ = WhaleAdvisory.objects.update_or_create(
                user=user,
                ai_provider='seed_demo_data',
                symbol=spec['symbol'],
                side=spec['side'],
                matched_value=spec['matched_value'],
                defaults={
                    'threshold': spec['threshold'],
                    'ai_summary': spec['ai_summary'],
                    'ai_detail': spec['ai_detail'],
                    'prompt_tokens': 320,
                    'completion_tokens': 140,
                },
            )
            WhaleAdvisory.objects.filter(pk=advisory.pk).update(created_at=spec['created_at'])

        tick_specs = [
            ('FPT', 'BUY', Decimal('118.5'), 12500),
            ('HPG', 'SELL', Decimal('28.95'), 42000),
            ('VCB', 'BUY', Decimal('89.2'), 24000),
            ('MWG', 'BUY', Decimal('61.8'), 16000),
            ('FPT', 'BUY', Decimal('119.2'), 8200),
            ('HPG', 'SELL', Decimal('29.1'), 30000),
            ('VNM', 'BUY', Decimal('71.2'), 78000),
            ('VCB', 'SELL', Decimal('88.8'), 10500),
            ('VNM', 'BUY', Decimal('71.5'), 16000),
            ('MWG', 'SELL', Decimal('60.5'), 21000),
            ('MWG', 'BUY', Decimal('62.4'), 27000),
            ('FPT', 'BUY', Decimal('120.8'), 19000),
            ('MWG', 'BUY', Decimal('63.1'), 35000),
            ('HPG', 'BUY', Decimal('29.4'), 46000),
            ('FPT', 'SELL', Decimal('121.3'), 14500),
            ('MWG', 'SELL', Decimal('62.8'), 18000),
            ('VNM', 'SELL', Decimal('70.9'), 18500),
            ('MWG', 'BUY', Decimal('63.9'), 41000),
            ('FPT', 'BUY', Decimal('122.1'), 24000),
            ('VCB', 'BUY', Decimal('89.6'), 21000),
            ('MWG', 'BUY', Decimal('64.5'), 52000),
            ('HPG', 'SELL', Decimal('29.25'), 37000),
            ('MWG', 'SELL', Decimal('63.8'), 22000),
            ('FPT', 'BUY', Decimal('123.4'), 28000),
            ('MWG', 'BUY', Decimal('64.8'), 61000),
            ('MWG', 'SELL', Decimal('64.2'), 26000),
            ('FPT', 'SELL', Decimal('122.8'), 17500),
            ('MWG', 'BUY', Decimal('65.1'), 47000),
        ]
        tick_datetimes = self._resolve_demo_tick_datetimes(len(tick_specs))
        for index, ((symbol, side, price, volume), tick_dt) in enumerate(zip(tick_specs, tick_datetimes), start=1):
            trade_date = tick_dt.date()
            trade_time = tick_dt.time().replace(tzinfo=None)
            tick, _ = IntradayTick.objects.update_or_create(
                stream_id=f'seed-demo-{username}-{symbol.lower()}-{index}',
                defaults={
                    'symbol': symbol,
                    'trade_date': trade_date,
                    'trade_time': trade_time,
                    'price': price,
                    'volume': volume,
                    'side': side,
                    'match_type': 'ATO' if index % 2 else 'LO',
                },
            )
            IntradayTick.objects.filter(pk=tick.pk).update(created_at=tick_dt)

        self.stdout.write(self.style.SUCCESS(
            f'Seeded comprehensive demo data for {username} / {password}'
        ))