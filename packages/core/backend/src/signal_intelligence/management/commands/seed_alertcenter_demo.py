"""
Seed demo data for AlertCenter / Signals verification (plan S0).

Creates 12 UnifiedAlert rows (5 alert families, 2 sessions) with
`source_ref` containing `demo:alert-center` for idempotency, plus:
- demo_alert_user: watchlist [VCI, HPG] + UserProfile whale threshold 100M
- demo_blank_user: no watchlist (reproduces 0/0/0 summary)

Idempotent: re-running skips existing rows (unique source_ref).
`--delete` removes all demo rows + demo users.

Usage:
    python manage.py seed_alertcenter_demo
    python manage.py seed_alertcenter_demo --delete
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

SOURCE_MARKER = 'demo:alert-center'


class Command(BaseCommand):
    help = "Seed idempotent demo UnifiedAlert rows + 2 demo users for AlertCenter/Signals verification (S0)."

    def add_arguments(self, parser):
        parser.add_argument('--delete', action='store_true', help='Delete all demo seed rows and demo users')

    def handle(self, *args, **options):
        if options.get('delete'):
            self._delete()
            return
        self._seed()

    def _rows(self):
        from signal_intelligence.models import UnifiedAlert as UA
        now = timezone.now()
        today = now.date()
        yesterday = (now - timedelta(days=1)).date()
        t_today = now.replace(hour=10, minute=30, second=0, microsecond=0)
        t_yday = (now - timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)
        S = UA.SeverityChoices
        D = UA.DirectionChoices
        T = UA.AlertTypeChoices
        return [
            # --- today (6) ---
            dict(symbol='VCI', alert_type=T.WHALE, severity=S.HIGH, confidence=0.9,
                 freshness_state='fresh', title='Cá voi mua VCI', body='Khớp lệnh lớn phía mua.',
                 value=Decimal('2500000000'), direction=D.BUY, session_date=today,
                 triggered_at=t_today, source_ref=f'{SOURCE_MARKER}:today:whale-vci',
                 evidence={'source': 'seed', 'matched_value': 2500000000},
                 canonical=dict(side='buy', price=Decimal('52000'), volume=48000,
                                matched_value=2500000000, executed_at=t_today, order_id='demo-1')),
            dict(symbol='HPG', alert_type=T.DARK_FLOW, severity=S.MEDIUM, confidence=0.8,
                 freshness_state='fresh', title='Dòng tiền ẩn HPG', body='Lệnh lớn ngoài bảng giá.',
                 value=Decimal('1200000000'), direction=D.SELL, session_date=today,
                 triggered_at=t_today, source_ref=f'{SOURCE_MARKER}:today:dark-hpg',
                 evidence={'source': 'seed'}),
            dict(symbol='FPT', alert_type=T.SIGNAL, severity=S.MEDIUM, confidence=0.85,
                 freshness_state='fresh', title='Biến động bất thường FPT', body='Biến động giá -7.50%',
                 value=Decimal('7.5'), direction=D.SELL, session_date=today,
                 triggered_at=t_today, source_ref='market_anomaly:demo:alert-center:today:fpt',
                 metadata={'source': 'seed', 'price_change_pct': -7.5},
                 evidence={'source': 'seed', 'price_change_pct': -7.5}),
            dict(symbol='CMN', alert_type=T.SYSTEM, severity=S.MEDIUM, confidence=0.7,
                 freshness_state='stale', title='Bảng giá chậm CMN',
                 body='Snapshot thị trường đã bị đánh dấu stale.',
                 value=Decimal('1.2'), direction=D.SELL, session_date=today,
                 triggered_at=t_today, source_ref='stale_quote:demo:alert-center:today:cmn',
                 metadata={'source': 'seed', 'price_change_pct': -1.2},
                 evidence={'source': 'seed', 'symbol': 'CMN', 'stale': True, 'price_change_pct': -1.2}),
            dict(symbol='VCI', alert_type=T.AI_ALERT, severity=S.HIGH, confidence=0.88,
                 freshness_state='fresh', title='AI cảnh báo VCI', body='Mô hình AI phát hiện tín hiệu mua.',
                 value=None, direction=D.BUY, session_date=today,
                 triggered_at=t_today, source_ref=f'{SOURCE_MARKER}:today:ai-alert-vci',
                 evidence={'source': 'seed'}),
            dict(symbol='HPG', alert_type=T.AI_SUGGEST, severity=S.MEDIUM, confidence=0.75,
                 freshness_state='fresh', title='AI gợi ý HPG', body='Gợi ý theo dõi thêm.',
                 value=None, direction=D.NEUTRAL, session_date=today,
                 triggered_at=t_today, source_ref=f'{SOURCE_MARKER}:today:ai-suggest-hpg',
                 evidence={'source': 'seed'}),
            # --- yesterday (6) ---
            dict(symbol='FPT', alert_type=T.WHALE, severity=S.HIGH, confidence=0.9,
                 freshness_state='fresh', title='Cá voi mua FPT', body='Khớp lệnh lớn phía mua.',
                 value=Decimal('3000000000'), direction=D.BUY, session_date=yesterday,
                 triggered_at=t_yday, source_ref=f'{SOURCE_MARKER}:yday:whale-fpt',
                 evidence={'source': 'seed', 'matched_value': 3000000000},
                 canonical=dict(side='buy', price=Decimal('98000'), volume=31000,
                                matched_value=3000000000, executed_at=t_yday, order_id='demo-2')),
            dict(symbol='VCI', alert_type=T.DARK_FLOW, severity=S.MEDIUM, confidence=0.8,
                 freshness_state='fresh', title='Dòng tiền ẩn VCI', body='Lệnh lớn ngoài bảng giá.',
                 value=Decimal('800000000'), direction=D.BUY, session_date=yesterday,
                 triggered_at=t_yday, source_ref=f'{SOURCE_MARKER}:yday:dark-vci',
                 evidence={'source': 'seed'}),
            dict(symbol='HPG', alert_type=T.SIGNAL, severity=S.LOW, confidence=0.75,
                 freshness_state='fresh', title='Biến động bất thường HPG', body='Biến động giá 2.10%',
                 value=Decimal('2.1'), direction=D.BUY, session_date=yesterday,
                 triggered_at=t_yday, source_ref='market_anomaly:demo:alert-center:yday:hpg',
                 metadata={'source': 'seed', 'price_change_pct': 2.1},
                 evidence={'source': 'seed', 'price_change_pct': 2.1}),
            dict(symbol='CMS', alert_type=T.SYSTEM, severity=S.MEDIUM, confidence=0.7,
                 freshness_state='stale', title='Bảng giá chậm CMS',
                 body='Snapshot thị trường đã bị đánh dấu stale.',
                 value=Decimal('0.8'), direction=D.SELL, session_date=yesterday,
                 triggered_at=t_yday, source_ref='stale_quote:demo:alert-center:yday:cms',
                 metadata={'source': 'seed', 'price_change_pct': -0.8},
                 evidence={'source': 'seed', 'symbol': 'CMS', 'stale': True, 'price_change_pct': -0.8}),
            dict(symbol='FPT', alert_type=T.AI_ALERT, severity=S.MEDIUM, confidence=0.8,
                 freshness_state='fresh', title='AI cảnh báo FPT', body='Mô hình AI phát hiện tín hiệu.',
                 value=None, direction=D.NEUTRAL, session_date=yesterday,
                 triggered_at=t_yday, source_ref=f'{SOURCE_MARKER}:yday:ai-alert-fpt',
                 evidence={'source': 'seed'}),
            dict(symbol='VCI', alert_type=T.AI_SUGGEST, severity=S.LOW, confidence=0.7,
                 freshness_state='fresh', title='AI gợi ý VCI', body='Gợi ý theo dõi thêm.',
                 value=None, direction=D.NEUTRAL, session_date=yesterday,
                 triggered_at=t_yday, source_ref=f'{SOURCE_MARKER}:yday:ai-suggest-vci',
                 evidence={'source': 'seed'}),
        ]

    @transaction.atomic
    def _seed(self):
        from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical
        User = get_user_model()
        created, skipped = 0, 0
        for row in self._rows():
            canonical = row.pop('canonical', None)
            metadata = row.pop('metadata', None)
            alert, was_created = UnifiedAlert.objects.get_or_create(
                source_ref=row['source_ref'],
                defaults={**row, 'metadata': metadata or {}},
            )
            if was_created:
                created += 1
                if canonical:
                    WhaleAlertCanonical.objects.create(
                        alert=alert, symbol=alert.symbol, session_date=alert.session_date, **canonical)
            else:
                skipped += 1
        seed_user, _ = User.objects.get_or_create(username='demo_alert_user')
        seed_user.set_password('demo1234')
        seed_user.save()
        try:
            from identity_access.models import UserProfile
            UserProfile.objects.update_or_create(
                user=seed_user, defaults={'whale_alert_threshold': 100})
        except Exception:
            pass
        from user_workspace.models import Watchlist, WatchlistItem
        watchlist, _ = Watchlist.objects.get_or_create(
            user=seed_user, name='Demo AlertCenter', defaults={'is_default': True})
        for symbol in ('VCI', 'HPG'):
            WatchlistItem.objects.get_or_create(watchlist=watchlist, symbol=symbol)
        blank_user, _ = User.objects.get_or_create(username='demo_blank_user')
        blank_user.set_password('demo1234')
        blank_user.save()
        self.stdout.write(self.style.SUCCESS(
            f'[seed_alertcenter_demo] alerts created={created} skipped={skipped} '
            f'(total demo={UnifiedAlert.objects.filter(source_ref__contains=SOURCE_MARKER).count()}); '
            'users demo_alert_user (watchlist VCI,HPG) + demo_blank_user ready.'))

    @transaction.atomic
    def _delete(self):
        from signal_intelligence.models import UnifiedAlert
        User = get_user_model()
        n_alerts, _ = UnifiedAlert.objects.filter(source_ref__contains=SOURCE_MARKER).delete()
        n_users, _ = User.objects.filter(username__in=('demo_alert_user', 'demo_blank_user')).delete()
        self.stdout.write(self.style.SUCCESS(
            f'[seed_alertcenter_demo] deleted alerts={n_alerts} demo_users={n_users}'))
