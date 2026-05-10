"""
Management command: seed_securities_groups

Tự động lấy toàn bộ nhóm ngành ICB và nhóm vốn hóa từ vnbroker,
đồng bộ SecuritiesGroup + SecuritiesItem như taxonomy dùng chung toàn hệ thống.

Cách dùng:
    python manage.py seed_securities_groups
    python manage.py seed_securities_groups --mode sectors
    python manage.py seed_securities_groups --mode caps
    python manage.py seed_securities_groups --mode manual
    python manage.py seed_securities_groups --clear
    python manage.py seed_securities_groups --username phamvietdung
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User

from portfolio.services import sync_market_groups_for_user, sync_market_groups_for_users


class Command(BaseCommand):
    help = 'Tạo SecuritiesGroup từ dữ liệu thị trường vnbroker (ICB sectors + VN30/VN100/HNX30)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username', type=str,
            help='Username dùng để ghi log người khởi chạy (tùy chọn).',
        )
        parser.add_argument(
            '--mode', type=str, default='all',
            choices=['all', 'sectors', 'caps', 'manual'],
            help='all=tất cả | sectors=chỉ ngành | caps=chỉ vốn hóa | manual=danh sách cứng',
        )
        parser.add_argument(
            '--clear', action='store_true',
            help='Xóa toàn bộ SecuritiesGroup hiện tại của user trước khi seed',
        )

    def handle(self, *args, **options):
        username = options['username']
        mode = options['mode']
        clear = options['clear']
        requested_by = None

        if username:
            try:
                requested_by = User.objects.get(username=username)
            except User.DoesNotExist:
                raise CommandError(f'User "{username}" không tồn tại.')

        if requested_by:
            result = sync_market_groups_for_user(requested_by, requested_by=requested_by, mode=mode, clear_existing=clear)
        else:
            result = sync_market_groups_for_users([], requested_by=None, mode=mode, clear_existing=clear)
        if result['warning']:
            self.stdout.write(self.style.WARNING(result['warning']))
        if not result['success']:
            raise CommandError(result.get('error') or result['message'])
        self.stdout.write(self.style.SUCCESS(result['message']))

